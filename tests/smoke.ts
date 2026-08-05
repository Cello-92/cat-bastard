import { Audio } from '@core/audio';
import { GameLoop, msToTicks, ticksToMs } from '@core/loop';
import type { Input } from '@core/input';
import type { Progress } from '@core/storage';
import { applyRemote, errorMessage, toPayload } from '@net/payload';
import { formatMs } from '@ui/format';
import { TILE_SIZE } from '@game/config';
import { LEVELS, SECRET_COUNT } from '@game/levels';
import { CATS } from '@game/cats';
import { SEGMENT_COLS, LEVEL_ROWS } from '@game/config';
import { defineLevel, segment } from '@game/levels/level';
import { TILE, isSolid } from '@game/tiles';
import { World } from '@game/world';
import { NullRenderer } from './null-renderer';
import { solve } from './solver';

/**
 * Smoke test headless.
 *
 * Non verifica che il gioco sia divertente — quello si vede solo giocando.
 * Verifica che non esploda: nessuna eccezione, nessuna coordinata NaN,
 * nessuna trasformazione lasciata aperta, morte e vittoria funzionanti.
 *
 * Gira in CI prima del deploy: se questo passa, il gioco almeno si avvia.
 */

/**
 * Colonne di vuoto che il gatto riesce a scavalcare.
 * Con l'impulso di salto e la velocità massima di config.ts la gittata reale
 * è poco sopra le sei colonne: cinque è il limite che ci si concede, così un
 * livello resta difficile senza diventare impossibile.
 */
const MAX_GAP = 5;

/** Riga di terreno pieno larga un segmento, per i livelli costruiti nei test. */
const FULL_GROUND = '#'.repeat(SEGMENT_COLS);

/**
 * Tutti i caratteri che hanno un significato.
 *
 * Serve a intercettare i refusi nelle mappe ASCII, che è il bug più facile da
 * fare e il più difficile da vedere: una `o` al posto di una `O` non rompe
 * niente e non compare da nessuna parte — semplicemente la trappola non c'è
 * più, e il livello che era stato progettato non è quello che si gioca.
 */
const KNOWN_TILES = new Set<string>(Object.values(TILE));

let failures = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ok   ${message}`);
  } else {
    console.error(`  FAIL ${message}`);
    failures++;
  }
}

/** Input finto: tiene premuto "destra" e salta a intervalli regolari. */
function fakeInput(tick: number): Input {
  const jumping = tick % 40 < 12;
  return {
    isDown: (action: string) => action === 'right' || (action === 'jump' && jumping),
    justPressed: (action: string) => action === 'jump' && tick % 40 === 0,
    endTick: () => {},
  } as unknown as Input;
}

// ---------------------------------------------------------------- struttura livelli
console.log('\nStruttura dei livelli');
for (const level of LEVELS) {
  const rows = level.rows;
  const widths = new Set(rows.map((r) => r.length));

  check(rows.length === LEVEL_ROWS, `${level.name}: ${LEVEL_ROWS} righe`);
  check(widths.size === 1, `${level.name}: tutte le righe hanno la stessa larghezza`);
  check(
    (rows[0]?.length ?? 0) % SEGMENT_COLS === 0,
    `${level.name}: larghezza multipla di ${SEGMENT_COLS}`,
  );
  check(rows.some((r) => r.includes(TILE.GOAL)), `${level.name}: ha un arrivo`);
  // Le arene dei boss sono l'unica eccezione alla regola dei checkpoint, ed è
  // una scelta di design dichiarata nel livello: uno scontro si ricomincia da
  // capo. In cambio si rinasce dentro l'arena (vedi levels/level.ts).
  if (!level.boss) {
    check(
      rows.some((r) => r.includes(TILE.CHECKPOINT)),
      `${level.name}: ha almeno un checkpoint`,
    );
  }

  const spawnRow = rows[level.spawn.r];
  check(
    spawnRow?.[level.spawn.c] === TILE.EMPTY,
    `${level.name}: lo spawn non è dentro un muro`,
  );

  // Refusi nella mappa: un carattere sconosciuto è aria, quindi non si vede
  // mai — né giocando né leggendo il sorgente, dove sembra una trappola.
  const unknown = new Set<string>();
  for (const row of rows) {
    for (const char of row) if (!KNOWN_TILES.has(char)) unknown.add(char);
  }
  check(
    unknown.size === 0,
    `${level.name}: nessun carattere sconosciuto nella mappa${unknown.size ? ` (trovati: ${[...unknown].map((c) => `"${c}"`).join(', ')})` : ''}`,
  );

  // Il gatto salta al massimo MAX_GAP colonne (vedi PHYSICS): un vuoto più
  // largo rende il livello impossibile, e un livello impossibile non è
  // "difficile", è rotto. È l'unico limite che le trappole non possono violare.
  const cols = rows[0]?.length ?? 0;
  let void_ = 0;
  let worstGap = 0;
  let gapAt = -1;
  for (let c = 0; c < cols; c++) {
    let hasFloor = false;
    for (let r = 0; r < LEVEL_ROWS; r++) {
      const tile = rows[r]?.[c] ?? TILE.EMPTY;
      // Terreno finto, piattaforme fantasma e massi che crollano spariscono
      // appena li tocchi: come appoggio non contano, quindi il livello deve
      // restare attraversabile anche senza di loro.
      const vanishes =
        tile === TILE.FAKE_GROUND ||
        tile === TILE.GHOST ||
        tile === TILE.COLLAPSE ||
        tile === TILE.BRITTLE_ICE;
      if (tile !== TILE.EMPTY && !vanishes && isSolid(tile)) {
        hasFloor = true;
        break;
      }
    }
    void_ = hasFloor ? 0 : void_ + 1;
    if (void_ > worstGap) {
      worstGap = void_;
      gapAt = c - void_ + 1;
    }
  }
  check(
    worstGap <= MAX_GAP,
    `${level.name}: nessun vuoto più largo di ${MAX_GAP} colonne (max ${worstGap}${gapAt >= 0 ? ` alla colonna ${gapAt}` : ''})`,
  );
}

// ---------------------------------------------------------------- igiene delle mappe
//
// Errori che non rompono niente e non si vedono nei test: una molla disegnata
// a mezz'aria sopra una fossa, degli spuntoni invisibili sospesi nel vuoto, un
// nemico che nasce dentro un muro, un nastro con un solido sopra (cioè un
// nastro che non tocca nessuno). Il gioco gira lo stesso — e proprio per
// questo restano lì finché non li nota qualcuno che gioca.
//
// Le lame a soffitto sono escluse di proposito: nel gioco pendono dal nulla
// da sempre, è una convenzione di disegno, non una svista. E gli spuntoni
// sull'ultima riga non hanno pavimento sotto perché sotto non c'è più mappa.
console.log('\nIgiene delle mappe');
for (const level of LEVELS) {
  const rows = level.rows;
  const cols = rows[0]?.length ?? 0;
  const at = (c: number, r: number): string =>
    r < 0 || r >= LEVEL_ROWS ? TILE.EMPTY : (rows[r]?.[c] ?? TILE.EMPTY);
  const problems: string[] = [];
  const flag = (c: number, r: number, what: string): void => {
    problems.push(`${what} (segmento ${Math.floor(c / SEGMENT_COLS)}, colonna ${c % SEGMENT_COLS}, riga ${r})`);
  };

  for (let r = 0; r < LEVEL_ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = at(c, r);
      const below = at(c, r + 1);
      const grounded = isSolid(below) || r === LEVEL_ROWS - 1;

      if ((tile === TILE.SPRING || tile === TILE.TRAP_SPRING) && !grounded)
        flag(c, r, `molla "${tile}" appesa in aria`);
      if ((tile === TILE.SPIKES || tile === TILE.POP_SPIKES || tile === TILE.SNAP_SPIKES) && !grounded)
        flag(c, r, `spuntoni "${tile}" senza pavimento sotto`);
      if (tile === TILE.HIDDEN_SPIKES && !grounded)
        flag(c, r, 'spuntoni invisibili sospesi nel vuoto');
      if ((tile === TILE.WALKER || tile === TILE.EVIL_WALKER) && !grounded)
        flag(c, r, `nemico "${tile}" senza pavimento sotto`);
      if (tile !== TILE.EMPTY && isSolid(at(c, r - 1)) && (tile === TILE.BELT_LEFT || tile === TILE.BELT_RIGHT))
        flag(c, r, 'nastro murato: non ci si può salire');
      if ((tile === TILE.COIN || tile === TILE.LURE_COIN) && isSolid(at(c, r - 1)) && isSolid(below))
        flag(c, r, 'moneta sepolta nel terreno');
    }
  }

  check(
    problems.length === 0,
    `${level.name}: niente appeso al nulla${problems.length ? ` — ${problems.slice(0, 4).join('; ')}` : ''}`,
  );

  // L'arrivo sta in fondo, e il checkpoint da qualche parte nel mezzo: un
  // checkpoint nelle prime colonne non salva niente, uno dopo l'arrivo è
  // decorazione.
  let goalColumn = -1;
  const checkpoints: number[] = [];
  for (const row of rows) {
    const g = row.indexOf(TILE.GOAL);
    if (g >= 0 && goalColumn < 0) goalColumn = g;
    for (let c = 0; c < row.length; c++) if (row[c] === TILE.CHECKPOINT) checkpoints.push(c);
  }
  check(goalColumn > cols * 0.8, `${level.name}: l'arrivo è in fondo (colonna ${goalColumn} su ${cols})`);
  if (!level.boss) {
    check(
      checkpoints.some((c) => c > cols * 0.2 && c < goalColumn),
      `${level.name}: almeno un checkpoint utile tra l'inizio e l'arrivo (${checkpoints.join(', ') || 'nessuno'})`,
    );
  }
}

// ---------------------------------------------------------------- attraversabilità
//
// Il controllo più importante di tutti, e quello che è costato di più impararlo.
//
// Un livello può essere geometricamente ineccepibile — nessun salto troppo
// lungo, nessun buco senza fondo — e restare comunque impossibile, perché a non
// essere percorribile non è la mappa ma la *traiettoria*: era bastata una
// moneta avvelenata piazzata dentro l'unico arco utile per scavalcare una fossa
// di spuntoni, con una lama a soffitto a chiudere l'alternativa. Due trappole
// sensate prese una per una, un muro invalicabile prese insieme.
//
// Quindi qui non si guarda la mappa: si gioca. Il risolutore cerca una
// sequenza di comandi che porti dallo spawn all'arrivo usando la fisica vera,
// e considera perso in partenza tutto ciò che sparisce sotto le zampe.
console.log('\nAttraversabilità (il risolutore gioca il livello)');
for (const level of LEVELS) {
  const result = solve(level);
  check(
    result.solved,
    result.solved
      ? `${level.name}: esiste un percorso fino all'arrivo (${result.statesExplored} stati esplorati)`
      : `${level.name}: NESSUN PERCORSO — bloccato alla colonna ${result.furthestColumn}, ` +
        `cioè al segmento ${Math.floor(result.furthestColumn / SEGMENT_COLS)} colonna ${result.furthestColumn % SEGMENT_COLS}`,
  );
}

// ---------------------------------------------------------------- simulazione
console.log('\nSimulazione (600 tick per livello, con rendering)');
const audio = new Audio();

for (const level of LEVELS) {
  const renderer = new NullRenderer();
  let taunts = 0;
  let wins = 0;

  const world = new World(level, audio, {
    onTaunt: () => taunts++,
    onWin: () => wins++,
  });

  let crashed: unknown = null;
  try {
    for (let tick = 0; tick < 600; tick++) {
      world.update(fakeInput(tick));
      world.draw(renderer, tick);
    }
  } catch (error) {
    crashed = error;
  }

  check(crashed === null, `${level.name}: 600 tick senza eccezioni`);
  if (crashed) console.error(crashed);

  check(renderer.transformDepth === 0, `${level.name}: push/pop bilanciati`);
  check(
    renderer.problems.length === 0,
    `${level.name}: nessuna coordinata invalida${renderer.problems.length ? ` (${renderer.problems.slice(0, 3).join('; ')})` : ''}`,
  );
  check(renderer.calls > 1000, `${level.name}: ha davvero disegnato qualcosa`);

  // Morte e respawn.
  // Dopo 600 tick il gatto può trovarsi a metà di una morte, e `kill()`
  // ignora di proposito le richieste in quello stato: si aspetta che il mondo
  // sia tornato giocabile, altrimenti si starebbe testando il caso sbagliato.
  //
  // Da qui in poi si usa l'input fermo, non quello che corre a destra: nelle
  // arene dei boss un gatto che corre in avanti muore di nuovo prima di aver
  // finito di rinascere, e si finirebbe per misurare quello invece del respawn.
  const stand = { isDown: () => false, justPressed: () => false, endTick: () => {} } as unknown as Input;
  for (let tick = 0; tick < 200 && world.state !== 'playing'; tick++) world.update(stand);
  check(world.state === 'playing', `${level.name}: il mondo torna sempre giocabile`);

  const deathsBefore = world.deaths;
  world.kill();
  check(world.deaths === deathsBefore + 1, `${level.name}: kill() incrementa le morti`);
  check(world.state === 'dying', `${level.name}: kill() entra in stato "dying"`);
  check(taunts > 0, `${level.name}: la morte produce una battuta`);

  for (let tick = 0; tick < 120; tick++) world.update(stand);
  check(world.state === 'playing', `${level.name}: dopo la morte si torna a giocare`);

  // Vittoria: si teletrasporta il gatto sull'arrivo.
  const goal = findTile(level.rows, TILE.GOAL);
  check(goal !== null, `${level.name}: arrivo localizzato`);
  if (goal) {
    world.player.x = goal.c * TILE_SIZE;
    world.player.y = goal.r * TILE_SIZE;
    world.update(stand);
    check(world.state === 'won', `${level.name}: toccare l'arrivo vince`);
    check(wins === 1, `${level.name}: onWin chiamato una sola volta`);
  }
}

// ---------------------------------------------------------------- trappole nascoste
//
// Le trappole di questo gioco sono spietate ma non sleali: uccidono senza
// preavviso, però sempre nello stesso punto e per un motivo che il giocatore
// può ricostruire. Questi controlli fissano proprio quel contratto — che una
// moneta avvelenata uccida, che una lanterna finta non salvi, che una
// piattaforma fantasma sparisca e che gli spuntoni invisibili, una volta che
// ti hanno preso, restino visibili per il resto del tentativo.
console.log('\nTrappole nascoste');
{
  const trapAudio = new Audio();

  /** Mondo minimo con una sola trappola, e il gatto piazzato sopra. */
  const withTrap = (rows: Record<number, string>) => {
    const level = defineLevel({
      id: 'trap-test',
      name: 'TEST',
      title: 'trappole',
      sky: 'day',
      spawn: { c: 1, r: 12 },
      segments: [segment({ ground: true, rows })],
    });
    const causes: string[] = [];
    const world = new World(level, trapAudio, {
      onTaunt: (text) => causes.push(text),
      onWin: () => {},
    });
    return { world, causes };
  };

  const idle = {
    isDown: () => false,
    justPressed: () => false,
    endTick: () => {},
  } as unknown as Input;

  // Moneta avvelenata: identica a una moneta, uccide invece di dare un punto.
  {
    const { world } = withTrap({ 12: '     E' });
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    world.update(idle);
    check(world.state === 'dying', 'la moneta esca uccide invece di dare un punto');
    check(world.coins === 0, 'la moneta esca non viene contata');
  }

  // Checkpoint finto: non salva, ammazza, e non sposta il punto di respawn.
  {
    const { world } = withTrap({ 12: '     N' });
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    world.update(idle);
    check(world.state === 'dying', 'il checkpoint finto uccide');
  }

  // Spuntoni invisibili: uccidono, poi restano visibili fino a fine tentativo.
  {
    const { world } = withTrap({ 12: '     !' });
    const renderer = new NullRenderer();
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;

    const before = renderer.calls;
    world.draw(renderer, 0);
    const invisibleCost = renderer.calls - before;

    world.update(idle);
    check(world.state === 'dying', 'gli spuntoni invisibili uccidono');

    // Passata la morte, la cella va disegnata: adesso si vedono.
    for (let tick = 0; tick < 200 && world.state !== 'playing'; tick++) world.update(idle);
    const afterDeath = renderer.calls;
    world.draw(renderer, 1);
    check(
      renderer.calls - afterDeath > invisibleCost,
      'dopo la prima morte gli spuntoni invisibili si vedono',
    );

    // Ricominciare da capo li fa tornare invisibili: si riparte a non sapere.
    world.restart();
    const afterRestart = renderer.calls;
    world.draw(renderer, 2);
    check(
      renderer.calls - afterRestart <= invisibleCost,
      'ricominciando il livello tornano invisibili',
    );
  }

  // Piattaforma fantasma: regge un istante, poi non c\'è più.
  {
    const { world } = withTrap({ 11: '     L' });
    world.player.x = 5 * TILE_SIZE + 4;
    world.player.y = 11 * TILE_SIZE - world.player.h;
    for (let tick = 0; tick < 4; tick++) world.update(idle);
    check(world.map.get(5, 11) === TILE.EMPTY, 'la piattaforma fantasma sparisce quasi subito');
  }

  // Molla-tagliola: identica a una molla, non lancia niente, uccide.
  {
    const { world } = withTrap({ 12: '     m' });
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    world.update(idle);
    check(world.state === 'dying', 'la molla-tagliola uccide invece di lanciare');
    check(world.player.vy >= 0, 'la molla-tagliola non dà nessuna spinta');
  }

  // Masso che crolla: parte senza il tremolio di preavviso della stalattite.
  {
    const { world } = withTrap({ 8: '     K' });
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    world.update(idle);
    check(world.map.get(5, 8) === TILE.EMPTY, 'il masso si stacca appena gli passi sotto');
  }
}

// ---------------------------------------------------------------- superfici del mondo 2
//
// Il secondo mondo introduce le prime cose che cambiano *come risponde il
// pavimento*: ghiaccio, nastri, getti di vapore. Sono le uniche modifiche alla
// fisica di tutto il gioco, quindi hanno bisogno di un contratto scritto —
// altrimenti al primo ritocco delle costanti si scopre che un livello tarato
// sul ghiaccio è diventato impossibile, e lo si scopre giocando.
console.log('\nSuperfici del mondo 2');
{
  const surfaceAudio = new Audio();

  const withRows = (rows: Record<number, string>, spawn = { c: 1, r: 12 }) => {
    const level = defineLevel({
      id: 'surface-test',
      name: 'TEST',
      title: 'superfici',
      sky: 'frost',
      spawn,
      segments: [segment({ rows })],
    });
    let secrets = 0;
    const world = new World(level, surfaceAudio, {
      onTaunt: () => {},
      onWin: () => {},
      onSecret: () => secrets++,
    });
    return { world, secrets: () => secrets };
  };

  const idle = {
    isDown: () => false,
    justPressed: () => false,
    endTick: () => {},
  } as unknown as Input;
  /** Quanto scivola, senza toccare niente, chi arriva a velocità piena. */
  const slideDistance = (floor: string): number => {
    const { world } = withRows({ 13: floor, 14: floor });
    world.player.x = 2 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    const start = world.player.x;
    world.player.vx = 4;
    for (let tick = 0; tick < 40; tick++) world.update(idle);
    return world.player.x - start;
  };

  const onSnow = slideDistance('+'.repeat(SEGMENT_COLS));
  const onIce = slideDistance('~'.repeat(SEGMENT_COLS));
  check(onIce > onSnow * 2, `sul ghiaccio si scivola molto più a lungo (${Math.round(onIce)}px contro ${Math.round(onSnow)}px)`);

  // Nastro: sposta anche chi non preme niente, e nel verso disegnato.
  {
    const { world } = withRows({ 13: '>'.repeat(SEGMENT_COLS), 14: '>'.repeat(SEGMENT_COLS) });
    world.player.x = 3 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    const start = world.player.x;
    for (let tick = 0; tick < 30; tick++) world.update(idle);
    check(world.player.x > start + 20, 'il nastro trascina anche chi sta fermo');
  }

  // Getto di vapore: solleva. Il gemello spento è identico e non fa niente.
  {
    const shaft = (tile: string): number => {
      const column = ' '.repeat(5) + tile;
      const { world } = withRows({
        9: column,
        10: column,
        11: column,
        12: column,
        13: '#'.repeat(SEGMENT_COLS),
        14: '#'.repeat(SEGMENT_COLS),
      });
      world.player.x = 5 * TILE_SIZE;
      world.player.y = 12 * TILE_SIZE;
      const start = world.player.y;
      for (let tick = 0; tick < 20; tick++) world.update(idle);
      return start - world.player.y;
    };

    check(shaft('^') > TILE_SIZE, 'il getto di vapore solleva il gatto');
    check(shaft(',') <= 0, 'il getto spento, identico a vedersi, non solleva niente');
  }

  // Ghiaccio sottile: regge un istante, poi cede come un'asse marcia.
  {
    const { world } = withRows({ 13: '#####;##############', 14: '#####' });
    world.player.x = 5 * TILE_SIZE + 4;
    world.player.y = 12 * TILE_SIZE;
    for (let tick = 0; tick < 20; tick++) world.update(idle);
    check(world.map.get(5, 13) === TILE.EMPTY, 'il ghiaccio sottile si crepa e cede');
  }
}

// ---------------------------------------------------------------- segreti
//
// I gomitoli sono l'unica cosa del gioco che non tradisce nessuno, e proprio
// per questo hanno bisogno di un test: se un giorno il muro finto tornasse
// solido o il gomitolo smettesse di segnalarsi, nessuno se ne accorgerebbe
// morendo — ci si accorge solo di quello che uccide.
console.log('\nSegreti');
{
  const secretAudio = new Audio();

  const withRows = (rows: Record<number, string>) => {
    const level = defineLevel({
      id: 'secret-test',
      name: 'TEST',
      title: 'segreti',
      sky: 'foundry',
      spawn: { c: 1, r: 12 },
      segments: [segment({ ground: true, rows })],
    });
    let secrets = 0;
    const world = new World(level, secretAudio, {
      onTaunt: () => {},
      onWin: () => {},
      onSecret: () => secrets++,
    });
    return { world, secrets: () => secrets };
  };

  const idle = {
    isDown: () => false,
    justPressed: () => false,
    endTick: () => {},
  } as unknown as Input;
  const runRight = {
    isDown: (a: string) => a === 'right',
    justPressed: () => false,
    endTick: () => {},
  } as unknown as Input;

  // La parete finta: sembra lamiera, non ferma niente.
  {
    const { world } = withRows({ 12: '    :' });
    world.player.x = 2 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    for (let tick = 0; tick < 60; tick++) world.update(runRight);
    check(world.player.x > 5 * TILE_SIZE, 'la parete finta si attraversa');
  }

  // Il gomitolo: si prende una volta sola, non conta come moneta, e avvisa.
  {
    const { world, secrets } = withRows({ 12: '    *' });
    world.player.x = 4 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    world.update(idle);
    check(world.secretFound, 'il gomitolo viene registrato quando lo si prende');
    check(secrets() === 1, 'il gomitolo avvisa il gioco una volta sola');
    check(world.coins === 0, 'il gomitolo non è una moneta');
    check(world.state === 'playing', 'il gomitolo non uccide (è l\'unico)');

    world.update(idle);
    check(secrets() === 1, 'restare fermi sopra non lo fa contare due volte');
  }
}

// ---------------------------------------------------------------- nemici del mondo 2
//
// Tre nemici nuovi, tre contratti diversi, e l'unica cosa che il giocatore può
// verificare è cosa succede saltandoci sopra: il drone si schiaccia, la
// sentinella no. Se questi due si invertissero il livello resterebbe
// "giocabile" e diventerebbe un imbroglio.
console.log('\nNemici del mondo 2');
{
  const enemyAudio = new Audio();

  /** Lascia cadere il gatto sulla testa del nemico e dice com'è finita. */
  const stomp = (marker: string): { dying: boolean; bounced: boolean } => {
    const level = defineLevel({
      id: 'enemy-test',
      name: 'TEST',
      title: 'nemici',
      sky: 'foundry',
      spawn: { c: 1, r: 12 },
      segments: [segment({ ground: true, rows: { 12: `    ${marker}` } })],
    });
    const world = new World(level, enemyAudio, { onTaunt: () => {}, onWin: () => {} });
    const idle = {
      isDown: () => false,
      justPressed: () => false,
      endTick: () => {},
    } as unknown as Input;

    // Piazzato sopra il nemico e in caduta: è la definizione di stomp. Gli si
    // concedono pochi tick perché il contatto avvenga davvero.
    world.player.x = 4 * TILE_SIZE + 4;
    world.player.y = 12 * TILE_SIZE - world.player.h - 6;
    world.player.vy = 3;
    world.player.onGround = false;

    let bounced = false;
    for (let tick = 0; tick < 12 && world.state === 'playing'; tick++) {
      world.update(idle);
      if (world.player.vy < -1) bounced = true;
    }
    return { dying: world.state === 'dying', bounced };
  };

  const sentry = stomp(TILE.SENTRY);
  check(sentry.dying, 'schiacciare la sentinella uccide: l\'elmo è chiodato');

  const drone = stomp(TILE.DRONE);
  check(!drone.dying && drone.bounced, 'schiacciare il drone funziona e fa rimbalzare');

  const walker = stomp(TILE.WALKER);
  check(!walker.dying && walker.bounced, 'il nemico normale si schiaccia ancora come prima');

  // La palla di ghiaccio parte verso il gatto e lo raggiunge: non è un
  // ostacolo fermo, è una scadenza.
  {
    const level = defineLevel({
      id: 'snowball-test',
      name: 'TEST',
      title: 'palla',
      sky: 'frost',
      spawn: { c: 1, r: 12 },
      segments: [segment({ ground: true, rows: { 12: '     &' } })],
    });
    const world = new World(level, enemyAudio, { onTaunt: () => {}, onWin: () => {} });
    const idle = {
      isDown: () => false,
      justPressed: () => false,
      endTick: () => {},
    } as unknown as Input;

    world.player.x = TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    let killed = false;
    for (let tick = 0; tick < 90 && !killed; tick++) {
      world.update(idle);
      killed = world.state !== 'playing';
    }
    check(killed, 'la palla di ghiaccio rotola verso il gatto e lo prende');
  }
}

// ---------------------------------------------------------------- gatti
//
// I manti sbloccabili cambiano quali materiali entrano nel disegno del gatto,
// e ogni manto ha marcature diverse: basta un materiale dimenticato perché una
// coordinata diventi NaN e il gatto sparisca — ma solo per chi ha trovato
// abbastanza gomitoli, cioè per nessuno finché non è troppo tardi.
console.log('\nGatti');
{
  const catAudio = new Audio();
  const level = LEVELS[0]!;
  const world = new World(level, catAudio, { onTaunt: () => {}, onWin: () => {} });
  const idle = {
    isDown: () => false,
    justPressed: () => false,
    endTick: () => {},
  } as unknown as Input;

  for (const cat of CATS) {
    const renderer = new NullRenderer();
    world.player.skin = cat;
    let crashed: unknown = null;
    try {
      for (let tick = 0; tick < 30; tick++) {
        world.update(idle);
        world.draw(renderer, tick);
      }
    } catch (error) {
      crashed = error;
    }
    check(
      crashed === null && renderer.problems.length === 0 && renderer.transformDepth === 0,
      `${cat.name}: si disegna senza coordinate invalide`,
    );
  }

  check(
    CATS.filter((cat) => cat.yarn === 0).length === 1,
    'esiste un solo gatto disponibile da subito',
  );
  check(
    CATS.every((cat) => cat.yarn <= SECRET_COUNT),
    `nessun gatto chiede più gomitoli di quanti ne esistano (${SECRET_COUNT})`,
  );
}

// ---------------------------------------------------------------- regressione: corsa piatta
//
// Bug storico: `onGround` veniva dedotto dall'ultima collisione invece di essere
// sondato. Un gatto fermo a terra non collide con niente, quindi risultava "in
// aria" un tick sì e uno no. Conseguenze: suono di atterraggio 30 volte al
// secondo, polvere sparata di continuo, animazione delle zampe a singhiozzo e
// attrito che alternava tra suolo e aria.
console.log('\nRegressione: corsa su terreno piatto');
{
  const level = LEVELS[0]!;
  const runAudio = new Audio();
  const played: Record<string, number> = {};
  (runAudio as unknown as { play: (n: string) => void }).play = (name: string) => {
    played[name] = (played[name] ?? 0) + 1;
  };

  const world = new World(level, runAudio, { onTaunt: () => {}, onWin: () => {} });
  const runRight = {
    isDown: (a: string) => a === 'right',
    justPressed: () => false,
    endTick: () => {},
  } as unknown as Input;

  let groundFlips = 0;
  let previousGround = world.player.onGround;
  const heights = new Set<number>();

  for (let tick = 0; tick < 150; tick++) {
    world.update(runRight);
    if (world.player.onGround !== previousGround) groundFlips++;
    previousGround = world.player.onGround;
    // Dopo l'atterraggio iniziale l'altezza non deve più oscillare.
    if (tick > 10 && world.player.onGround) heights.add(Math.round(world.player.y * 100));
  }

  check(groundFlips <= 2, `onGround cambia al massimo 2 volte in 150 tick (osservato: ${groundFlips})`);
  check(
    (played['land'] ?? 0) <= 2,
    `il suono di atterraggio non si ripete durante la corsa (osservato: ${played['land'] ?? 0})`,
  );
  check(
    heights.size <= 2,
    `il gatto non trema in verticale mentre corre (altezze distinte: ${heights.size})`,
  );

  const steps = (played['step'] ?? 0) + (played['stepAlt'] ?? 0);
  check(steps > 0, `la corsa produce dei passi (${steps} in 150 tick)`);
  check(steps < 40, `i passi non sono uno per tick (${steps} in 150 tick)`);
}

// ---------------------------------------------------------------- assi marce
//
// Il trigger è passato da "sono atterrato qui" a "sto poggiando qui": serviva
// perché su una piattaforma ci si arriva anche camminandoci sopra di lato,
// senza mai cadere. Questo verifica che ceda comunque.
console.log('\nPiattaforme che si sbriciolano');
{
  const level = LEVELS[0]!;
  const world = new World(level, audio, { onTaunt: () => {}, onWin: () => {} });
  const plank = findTile(level.rows, TILE.CRUMBLE);
  check(plank !== null, 'trovata una piattaforma marcia in 1-1');

  if (plank) {
    world.player.reset(plank.c * TILE_SIZE + 4, plank.r * TILE_SIZE - world.player.h);
    const still = { isDown: () => false, justPressed: () => false, endTick: () => {} } as unknown as Input;

    world.update(still);
    check(world.player.onGround, 'il gatto poggia sull\'asse');

    for (let tick = 0; tick < 30; tick++) world.update(still);
    check(
      world.map.get(plank.c, plank.r) === TILE.EMPTY,
      'restando fermo sopra, l\'asse cede',
    );
  }
}

function findTile(rows: readonly string[], tile: string): { c: number; r: number } | null {
  for (let r = 0; r < rows.length; r++) {
    const c = rows[r]?.indexOf(tile) ?? -1;
    if (c >= 0) return { c, r };
  }
  return null;
}

// ---------------------------------------------------------------- account e classifica
//
// Del backend si prova solo la parte che si può sbagliare in silenzio: la
// conversione dei tempi e la fusione dei progressi. Una fusione fatta male non
// lancia niente e non rompe niente — restituisce un record peggiore di quello
// che il giocatore aveva, e se ne accorge lui, dopo, quando è tardi.
//
// La rete non si prova qui: non c'è, e non deve servire. Il gioco senza
// backend è il gioco di prima.
console.log('\nTempi in millisecondi');
{
  let exact = true;
  for (let ticks = 0; ticks <= 5000; ticks++) {
    if (msToTicks(ticksToMs(ticks)) !== ticks) exact = false;
  }
  check(exact, 'il giro tick → millisecondi → tick non perde mai un tick');
  check(ticksToMs(60) === 1000, 'sessanta tick sono un secondo esatto');
  check(formatMs(0) === '0:00.000', 'zero si scrive 0:00.000');
  check(formatMs(61234) === '1:01.234', '61234ms si scrivono 1:01.234');
  check(formatMs(9) === '0:00.009', 'i millesimi hanno sempre tre cifre');
}

console.log('\nSincronizzazione dei progressi');
{
  const local: Progress = {
    levels: {
      '1-1': { cleared: true, bestDeaths: 4, bestTicks: 600, bestCoins: 2 },
      '1-2': { cleared: false, bestDeaths: 0, bestTicks: 0, bestCoins: 0 },
    },
    totalDeaths: 40,
    secrets: ['1-1'],
  };

  const payload = toPayload(local) as {
    levels: Record<string, { ms: number }>;
    secrets: string[];
  };
  check(payload.levels['1-1']?.ms === 10000, 'un record di 600 tick parte come 10000ms');
  check(payload.levels['1-2'] === undefined, 'un livello mai finito non ha un tempo da mandare');
  check(payload.secrets.includes('1-1'), 'i gomitoli trovati partono con tutto il resto');

  // Il server ha un tempo migliore su 1-1, un livello che qui non c'è, e un
  // gomitolo trovato su un altro computer.
  const merged = applyRemote(
    {
      ok: true,
      nickname: 'gatto',
      total_deaths: 12,
      secrets: ['2-3'],
      levels: {
        '1-1': { ms: 9000, deaths: 9, coins: 1 },
        '1-3': { ms: 20000, deaths: 2, coins: 5 },
      },
    },
    local,
  );

  check(merged.levels['1-1']?.bestTicks === 540, 'del tempo vince il più basso dei due');
  check(merged.levels['1-1']?.bestDeaths === 4, 'delle morti vince il numero più basso');
  check(
    merged.levels['1-1']?.bestCoins === 2,
    'delle monete di un livello vince il numero più alto',
  );
  check(merged.levels['1-3']?.cleared === true, 'un livello finito altrove arriva qui');
  check(merged.levels['1-2']?.cleared === false, 'un livello mai finito resta mai finito');
  check(merged.totalDeaths === 40, 'le morti totali non scendono mai');
  check(
    merged.secrets.includes('1-1') && merged.secrets.includes('2-3'),
    'i gomitoli si sommano: uno trovato non si perde, nemmeno cambiando computer',
  );
  check(
    merged.secrets.length === new Set(merged.secrets).size,
    'lo stesso gomitolo non si conta due volte (varrebbe due gatti)',
  );
}

console.log('\nMessaggi di errore');
{
  check(
    errorMessage('NICKNAME_TAKEN').includes('già'),
    'un codice conosciuto diventa una frase in italiano',
  );
  check(
    errorMessage('BOH_NON_ESISTE') === 'Qualcosa è andato storto. Riprova.',
    'un codice sconosciuto non finisce mai davanti al giocatore così com\'è',
  );
}

console.log(failures === 0 ? '\nTutto ok.\n' : `\n${failures} controlli falliti.\n`);
process.exit(failures === 0 ? 0 : 1);
