import { Audio } from '@core/audio';
import { GameLoop, msToTicks, ticksToMs } from '@core/loop';
import type { Input } from '@core/input';
import type { Progress } from '@core/storage';
import { applyRemote, errorMessage, toPayload } from '@net/payload';
import { formatMs } from '@ui/format';
import { TILE_SIZE } from '@game/config';
import { LEVELS, SECRET_COUNT } from '@game/levels';
import { CATS } from '@game/cats';
import { SEGMENT_COLS, LEVEL_ROWS, RULES } from '@game/config';
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

// ------------------------------------------------------- raccolta e respawn
//
// La mappa non sopravvive alla morte: `rebuild()` la ricostruisce dalle righe
// del livello, e per un po' questo ha voluto dire che ogni moneta e ogni
// gomitolo tornavano al loro posto a ogni respawn. Bastava ammazzarsi accanto
// a una moneta per raccoglierla all'infinito, e le monete di un livello vanno
// in `bestCoins`, che finisce in classifica.
//
// Le due cose ora si comportano in modo diverso, ed è voluto: il gomitolo
// sparisce (un segreto trovato non è più un segreto), la moneta torna ma non
// conta (toglierla lascerebbe buchi in un livello che si impara a memoria).
// Nessuna delle due si vede fallire giocando — si vede solo in classifica, a
// danno fatto — quindi va provata qui.
console.log('\nRaccolta e respawn');
{
  const farmAudio = new Audio();

  const withRows = (rows: Record<number, string>) => {
    const level = defineLevel({
      id: 'farm-test',
      name: 'TEST',
      title: 'raccolta',
      sky: 'day',
      spawn: { c: 1, r: 12 },
      segments: [segment({ ground: true, rows })],
    });
    let secrets = 0;
    const world = new World(level, farmAudio, {
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

  /** Ammazza il gatto e aspetta che il livello si ricomponga. */
  const dieAndRespawn = (world: World): void => {
    world.kill();
    for (let tick = 0; tick < RULES.deathFreezeTicks + 20; tick++) world.update(idle);
  };

  /** Mette il gatto sulla cella indicata e lascia passare un tick. */
  const touch = (world: World, c: number, r: number): void => {
    world.player.x = c * TILE_SIZE;
    world.player.y = r * TILE_SIZE;
    world.update(idle);
  };

  // La moneta sparsa: torna al suo posto, ma la seconda volta non vale.
  {
    const { world } = withRows({ 12: '    C' });
    touch(world, 4, 12);
    check(world.coins === 1, 'la prima raccolta conta');

    dieAndRespawn(world);
    check(world.map.get(4, 12) === TILE.COIN, 'dopo la morte la moneta è tornata al suo posto');

    touch(world, 4, 12);
    check(world.coins === 1, 'riprenderla dopo la morte non la conta una seconda volta');
    check(world.map.get(4, 12) === TILE.EMPTY, 'si raccoglie lo stesso: sparisce come sempre');

    // E non basta insistere.
    for (let i = 0; i < 5; i++) {
      dieAndRespawn(world);
      touch(world, 4, 12);
    }
    check(world.coins === 1, 'nemmeno morendo sei volte di fila');
  }

  // Il blocco onesto: stessa regola, ed è la sorgente più comoda di tutte
  // perché il blocco torna intatto e basta saltarci sotto.
  {
    const { world } = withRows({ 10: '    Q' });
    world.onPlayerHeadbutt(4, 10, TILE.HONEST);
    check(world.coins === 1, 'il blocco onesto dà la sua moneta');

    dieAndRespawn(world);
    check(world.map.get(4, 10) === TILE.HONEST, 'dopo la morte il blocco è di nuovo pieno');

    world.onPlayerHeadbutt(4, 10, TILE.HONEST);
    check(world.coins === 1, 'ma la sua moneta non si conta due volte');
  }

  // Due monete diverse restano due monete diverse: il ricordo è per cella, non
  // "una moneta l'hai già presa".
  {
    const { world } = withRows({ 12: '    CC' });
    touch(world, 4, 12);
    touch(world, 5, 12);
    check(world.coins === 2, 'monete diverse contano tutte');

    dieAndRespawn(world);
    touch(world, 4, 12);
    touch(world, 5, 12);
    check(world.coins === 2, 'e dopo la morte nessuna delle due conta di nuovo');
  }

  // Il gomitolo invece non torna proprio.
  {
    const { world, secrets } = withRows({ 12: '    *' });
    touch(world, 4, 12);
    check(secrets() === 1, 'il gomitolo si prende');

    dieAndRespawn(world);
    check(world.map.get(4, 12) === TILE.EMPTY, 'dopo la morte il gomitolo non è tornato');
    check(world.secretFound, 'e resta preso: morire non lo fa perdere');

    touch(world, 4, 12);
    check(secrets() === 1, 'non c\'è più niente da raccogliere lì');
  }

  // `restart()` è un tentativo nuovo: rimette tutto in gioco, ma azzera anche
  // il contatore. Senza questo secondo pezzo sarebbe di nuovo una scorciatoia.
  {
    const { world } = withRows({ 12: '    C*' });
    touch(world, 4, 12);
    touch(world, 5, 12);
    check(world.coins === 1 && world.secretFound, 'presi entrambi');

    world.restart();
    check(world.coins === 0, 'ricominciando il contatore riparte da zero');
    check(world.map.get(4, 12) === TILE.COIN, 'e la moneta torna in gioco');
    check(world.map.get(5, 12) === TILE.YARN, 'e anche il gomitolo');

    touch(world, 4, 12);
    check(world.coins === 1, 'la moneta torna a contare, ma da un totale azzerato');
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

// ---------------------------------------------------------------- lo scontro col Padrone
//
// Il risolutore sa dire se l'arena si attraversa, non se il boss si può
// battere: non conosce le entità, e non è il posto giusto per insegnarglielo.
// Il contratto del combattimento si verifica qui, ed è fatto di poche cose che
// non possono smettere di essere vere senza che 1-11 diventi ingiocabile.
//
//   - toccarlo uccide, e schiacciarlo pure (è un boss, non un fungo);
//   - salire su un mattone del soffitto lo stacca;
//   - la muratura si ricompone, quindi non si può restare senza armi;
//   - un masso addosso spegne una gemma, e quattro gemme aprono il portone;
//   - mentre cammina scansa, mentre è impegnato no: è il modo in cui bara, ed
//     è anche l'unico motivo per cui lo scontro ha una strategia.
console.log('\nLo scontro col Padrone');
{
  const bossAudio = new Audio();
  const idle = { isDown: () => false, justPressed: () => false, endTick: () => {} } as unknown as Input;

  /** Tana minima: pavimento di roccia più quello che serve alla prova. */
  const lair = (rows: Record<number, string>): World => {
    const level = defineLevel({
      id: 'boss-test',
      name: 'TEST',
      title: 'padrone',
      sky: 'cave',
      boss: true,
      spawn: { c: 1, r: 12 },
      segments: [segment({ rows: { ...rows, 13: FULL_GROUND, 14: FULL_GROUND } })],
    });
    return new World(level, bossAudio, { onTaunt: () => {}, onWin: () => {} });
  };

  const arena = LEVELS.find((level) => level.boss);
  check(arena !== undefined, "esiste un livello dichiarato come arena di un boss");
  check(
    arena?.rows.some((row) => row.includes(TILE.BOSS)) === true,
    "l'arena contiene il marcatore del Padrone",
  );
  check(
    arena?.rows.some((row) => row.includes(TILE.BOSS_GATE)) === true,
    "l'arena è chiusa da un portone",
  );
  check(
    (arena?.rows.reduce((n, row) => n + [...row].filter((c) => c === TILE.BOSS_BRICK).length, 0) ?? 0) >= 4,
    "l'arena ha almeno quattro mattoni staccabili (uno per gemma)",
  );

  // Ogni mattone dev'essere raggiungibile davvero, saltando.
  //
  // È lo stesso ragionamento del risolutore applicato all'arma invece che
  // all'uscita: quattro gemme si spengono con quattro massi, e un mattone su
  // cui non si riesce a salire è un masso che non esiste. Qui il livello viene
  // riscritto un mattone alla volta — quello sotto esame diventa roccia (finché
  // non ci sali sopra è solido per davvero) e sopra ci si mette un arrivo
  // finto: se il risolutore ci arriva, ci arriva anche il gatto.
  if (arena) {
    const unreachable: string[] = [];
    arena.rows.forEach((row, r) => {
      [...row].forEach((tile, c) => {
        if (tile !== TILE.BOSS_BRICK) return;
        const probe = arena.rows.map((line, i) => {
          const chars = [...line];
          if (i === r) chars[c] = TILE.ROCK;
          if (i === r - 1) chars[c] = TILE.GOAL;
          return chars.join('');
        });
        const result = solve({ ...arena, id: `probe-${c}-${r}`, rows: probe });
        if (!result.solved) unreachable.push(`colonna ${c} riga ${r}`);
      });
    });
    check(
      unreachable.length === 0,
      `ogni mattone dell'arena è raggiungibile${unreachable.length ? ` (irraggiungibili: ${unreachable.join('; ')})` : ''}`,
    );
  }

  // Toccarlo, in qualunque modo, è un modo di morire.
  {
    const world = lair({ 12: '     @' });
    const boss = world.boss;
    check(boss !== null, 'il marcatore "@" diventa davvero un Padrone');
    if (boss) {
      world.player.x = boss.x + 10;
      world.player.y = boss.y + 20;
      world.update(idle);
      check(world.state === 'dying', 'toccare il Padrone uccide');
    }
  }
  {
    const world = lair({ 12: '     @' });
    world.boss?.onStomp(world);
    check(world.state === 'dying', 'saltargli in testa uccide: ha una corona di punte');
  }

  // Il mattone del soffitto: si stacca se ci sali, e poi il soffitto si rifà.
  {
    const world = lair({ 8: '     ?' });
    world.player.reset(5 * TILE_SIZE + 4, 8 * TILE_SIZE - world.player.h);
    world.update(idle);
    check(world.player.onGround, 'sul mattone del soffitto ci si sta in piedi');

    for (let tick = 0; tick < RULES.bossBrickDelayTicks + 4; tick++) world.update(idle);
    check(world.map.get(5, 8) === TILE.EMPTY, 'salirci sopra stacca il mattone');

    // Il gatto è caduto insieme al masso: lo si sposta, altrimenti la muratura
    // non può ricomporsi addosso a lui (ed è giusto che non lo faccia).
    world.player.reset(1 * TILE_SIZE, 12 * TILE_SIZE);
    for (let tick = 0; tick < RULES.bossBrickRespawnTicks + 20; tick++) world.update(idle);
    check(
      world.map.get(5, 8) === TILE.BOSS_BRICK,
      'la muratura si ricompone: non si resta mai senza armi',
    );
  }

  // Un masso in testa mentre è impegnato: gemma spenta.
  {
    const world = lair({ 8: '     ?', 12: '     @' });
    const boss = world.boss;
    if (boss) {
      world.player.reset(1 * TILE_SIZE, 12 * TILE_SIZE);
      // "Stordito" è uno degli stati in cui non può barare.
      boss.state = 'stun';
      world.bossSlam(boss);
      for (let tick = 0; tick < 60; tick++) world.update(idle);
      check(boss.hits === 1, `un masso addosso spegne una gemma (colpi: ${boss.hits})`);
    }
  }

  // Mentre cammina, invece, scansa: è esattamente il suo modo di barare.
  //
  // Il confronto è tra due tane identiche, una col masso in arrivo e una
  // senza: lo scarto si vede nella distanza percorsa, perché schivare è più
  // veloce che camminare. Misurare "si è spostato" e basta non direbbe niente,
  // visto che il Padrone cammina comunque.
  {
    const walked = (drop: boolean): { distance: number; hits: number; state: string } => {
      const world = lair({ 8: '     ?', 12: '     @' });
      const boss = world.boss;
      if (!boss) return { distance: 0, hits: -1, state: 'assente' };

      world.player.reset(1 * TILE_SIZE, 12 * TILE_SIZE);
      // Due tick per accorgersi che il gatto è entrato: poi cammina.
      world.update(idle);
      world.update(idle);
      const from = boss.centerX;
      if (drop) world.bossSlam(boss);
      for (let tick = 0; tick < 30; tick++) world.update(idle);
      return { distance: Math.abs(boss.centerX - from), hits: boss.hits, state: boss.state };
    };

    const calm = walked(false);
    const scared = walked(true);
    check(calm.state === 'stalk', `sveglio, il Padrone cammina (stato: ${calm.state})`);
    check(scared.hits === 0, 'un masso onesto non lo prende mai: si sposta e basta');
    check(
      scared.distance > calm.distance + 15,
      `scansare è più veloce che camminare (${Math.round(scared.distance)}px contro ${Math.round(calm.distance)}px)`,
    );
  }

  // Impegnato in qualcosa, invece, non può più barare: è la finestra buona.
  {
    const world = lair({ 12: '     @' });
    const boss = world.boss;
    if (boss) {
      for (const state of ['charge', 'stun', 'slam', 'wind'] as const) {
        boss.state = state;
        check(!boss.canDodge, `in stato "${state}" non può scansare`);
      }
    }
  }

  // Quattro gemme, due fasi, e il portone che si apre solo alla fine.
  if (arena) {
    const world = new World(arena, bossAudio, { onTaunt: () => {}, onWin: () => {} });
    const boss = world.boss;
    const gate = findTile(arena.rows, TILE.BOSS_GATE);
    check(boss !== null && gate !== null, "l'arena vera carica boss e portone");

    if (boss && gate) {
      check(world.map.get(gate.c, gate.r) === TILE.BOSS_GATE, 'il portone parte chiuso');

      // Il gatto si mette su una mensola: da lì il Padrone non lo raggiunge, e
      // la prova può concentrarsi sui colpi invece che sulla sopravvivenza.
      const perch = (): void => world.player.reset(6 * TILE_SIZE, 7 * TILE_SIZE - world.player.h);
      perch();

      for (let hit = 1; hit <= 4; hit++) {
        for (let guard = 0; guard < 400 && !boss.vulnerable; guard++) {
          perch();
          world.update(idle);
        }
        check(boss.vulnerable, `prima del colpo ${hit} il Padrone torna colpibile`);
        boss.takeHit(world);
        if (hit === 2) {
          for (let guard = 0; guard < 400 && boss.phase === 1; guard++) {
            perch();
            world.update(idle);
          }
          check(boss.phase === 2, 'due gemme spente e il Padrone cambia fase');
        }
      }

      check(boss.hits === 4, 'quattro colpi spengono tutte le gemme');
      check(boss.isDead, 'con la corona spenta il Padrone cade');

      // La morte del Padrone congela l'immagine per qualche tick (è un boss,
      // se ne va con calma): il portone si apre quando la simulazione riparte.
      for (let tick = 0; tick < 20; tick++) {
        perch();
        world.update(idle);
      }
      check(world.map.get(gate.c, gate.r) === TILE.EMPTY, 'il portone si apre quando il boss cade');

      const goal = findTile(arena.rows, TILE.GOAL);
      if (goal) {
        world.player.x = goal.c * TILE_SIZE;
        world.player.y = goal.r * TILE_SIZE;
        world.update(idle);
        check(world.state === 'won', "dopo il portone l'arrivo è raggiungibile");
      }
    }
  }
}

// ---------------------------------------------------------------- disegno di tutti i tile
//
// La simulazione disegna solo le colonne inquadrate, quindi un tile che compare
// a metà livello può non essere mai disegnato da nessun test: basta che una
// primitiva riceva una coordinata NaN o dimentichi un pop() e il gioco si
// spacca in un punto che nessuno ha guardato. Qui si mette l'intero
// vocabolario in un livello solo, davanti alla telecamera, e si disegna.
console.log('\nDisegno: tutti i tile del vocabolario');
{
  const vocabulary = Object.values(TILE).filter((t) => t !== TILE.EMPTY);
  const rows: Record<number, string> = {};
  vocabulary.forEach((tile, i) => {
    const row = 2 + Math.floor(i / SEGMENT_COLS) * 2;
    rows[row] = (rows[row] ?? '').padEnd(i % SEGMENT_COLS, ' ') + tile;
  });
  rows[13] = FULL_GROUND;
  rows[14] = FULL_GROUND;

  const level = defineLevel({
    id: 'draw-test',
    name: 'TEST',
    title: 'vocabolario',
    sky: 'day',
    spawn: { c: 1, r: 12 },
    segments: [segment({ rows })],
  });

  const renderer = new NullRenderer();
  const world = new World(level, audio, { onTaunt: () => {}, onWin: () => {} });
  let crashed: unknown = null;
  try {
    // Due passate a tick diversi: quasi tutti i tile animano su `tick`.
    world.draw(renderer, 0);
    world.draw(renderer, 37);
  } catch (error) {
    crashed = error;
  }

  check(crashed === null, `tutti i ${vocabulary.length} tile si disegnano senza eccezioni`);
  if (crashed) console.error(crashed);
  check(renderer.transformDepth === 0, 'disegnandoli tutti, push/pop restano bilanciati');
  check(
    renderer.problems.length === 0,
    `nessuna coordinata invalida in nessun tile${renderer.problems.length ? ` (${renderer.problems.slice(0, 3).join('; ')})` : ''}`,
  );
}

// ---------------------------------------------------------------- il ritmo del loop
//
// Il difetto che questo controllo fissa non è un calo di frame rate: è peggio,
// perché non si vede in nessun contatore. Il browser non consegna 16.6667ms tra
// un frame e l'altro — consegna 16.6 o 16.7, perché arrotonda i timestamp — e
// con 16.6 l'accumulatore resta indietro di sette centesimi di millisecondo a
// frame. Ogni ~250 frame arriva un frame che non fa nessun update, seguito da
// uno che ne fa due: lo schermo non ha perso niente, ma il gatto sta fermo un
// frame e poi salta il doppio. È lo scatto che si vede su qualunque computer,
// veloce o lento, ed è per questo che sembrava non dipendere dall'hardware.
//
// La cura è agganciare il tempo trascorso al multiplo di tick più vicino,
// quando ci va vicinissimo. Qui si verifica che l'aggancio ci sia (cadenza
// perfettamente regolare) e che NON mangi i rallentamenti veri, che vanno
// recuperati come prima.
console.log('\nIl ritmo del loop');
{
  const pending: FrameRequestCallback[] = [];
  const globals = globalThis as unknown as {
    requestAnimationFrame: (cb: FrameRequestCallback) => number;
    cancelAnimationFrame: (id: number) => void;
  };
  globals.requestAnimationFrame = (cb: FrameRequestCallback): number => pending.push(cb);
  globals.cancelAnimationFrame = (): void => {};

  /** Fa girare il loop con tempi decisi da noi e riporta cosa è successo. */
  const run = (deltas: readonly number[]): { perFrame: number[]; renders: number } => {
    pending.length = 0;
    let updates = 0;
    let renders = 0;
    const loop = new GameLoop(
      () => updates++,
      () => renders++,
    );
    let now = performance.now();
    loop.start();

    const perFrame: number[] = [];
    for (const delta of deltas) {
      const frame = pending.pop();
      pending.length = 0;
      if (!frame) break;
      now += delta;
      const before = updates;
      frame(now);
      perFrame.push(updates - before);
    }
    loop.stop();
    return { perFrame, renders };
  };

  const steady = (delta: number, frames: number): number[] =>
    new Array<number>(frames).fill(delta);

  // 60Hz con i timestamp arrotondati per difetto: il caso che rompeva tutto.
  {
    const { perFrame } = run(steady(16.6, 300));
    const irregular = perFrame.filter((n) => n !== 1).length;
    check(irregular === 0, `a 16.6ms per frame ogni frame fa un update solo (irregolari: ${irregular})`);
  }
  // ...e per eccesso.
  {
    const { perFrame } = run(steady(16.7, 300));
    const irregular = perFrame.filter((n) => n !== 1).length;
    check(irregular === 0, `a 16.7ms per frame ogni frame fa un update solo (irregolari: ${irregular})`);
  }
  // Schermo a 30Hz: due update a frame, sempre gli stessi due.
  {
    const { perFrame } = run(steady(33.3, 200));
    const irregular = perFrame.filter((n) => n !== 2).length;
    check(irregular === 0, `a 33.3ms per frame ogni frame fa due update (irregolari: ${irregular})`);
  }
  // Schermo a 120Hz: un update ogni due frame, e i frame senza update non si
  // ridisegnano — sarebbero copie identiche di quello prima.
  {
    const { perFrame, renders } = run(steady(8.33, 200));
    const updates = perFrame.reduce((a, b) => a + b, 0);
    check(updates > 90 && updates < 110, `a 120Hz la simulazione resta a 60 update (${updates} in 200 frame)`);
    check(renders <= updates + 1, `a 120Hz non si disegna due volte la stessa immagine (${renders} disegni)`);
  }
  // Un rallentamento vero non deve essere confuso con l'arrotondamento: va
  // recuperato, non nascosto. Il tetto di cinque tick resta quello di prima —
  // serve a non finire in una spirale quando la scheda torna in primo piano.
  {
    const recovered = run([16.6, 16.6, 100, 16.6, 16.6]).perFrame[2] ?? 0;
    check(
      recovered >= 4 && recovered <= 5,
      `un frame da 100ms recupera il tempo perso senza spirale (${recovered} update)`,
    );
  }
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

// Il formato degli id di livello è un contratto col database.
//
// `cb_sync` scarta le chiavi che non hanno la forma giusta, e lo fa con un
// `continue`: niente errore, niente eccezione, solo un salvataggio che arriva
// e non viene scritto. È il modo più silenzioso che questo progetto abbia di
// rompersi, e infatti si è rotto — la regex accettava "1-11" mentre il gioco
// manda "w1-11", quindi per ogni account il server teneva le morti totali e
// buttava via tempi, monete e gomitoli.
//
// Qui la regex sta scritta due volte apposta, com'è già per le regole di
// fusione: se qualcuno rinomina i livelli, questo controllo fallisce prima
// del deploy invece di svuotare la classifica dopo.
console.log('\nGli id dei livelli sono quelli che il server accetta');
{
  const ACCEPTED_BY_CB_SYNC = /^w[0-9]{1,3}-[0-9]{1,3}$/;
  const rejected = LEVELS.filter((level) => !ACCEPTED_BY_CB_SYNC.test(level.id)).map((l) => l.id);
  check(
    rejected.length === 0,
    `ogni id di livello passa il filtro di cb_sync${rejected.length ? ` (scartati: ${rejected.join(', ')})` : ''}`,
  );

  // E il payload che parte davvero usa quegli id, non altri.
  const everyLevel: Progress = {
    levels: Object.fromEntries(
      LEVELS.map((level) => [level.id, { cleared: true, bestDeaths: 1, bestTicks: 600, bestCoins: 1 }]),
    ),
    totalDeaths: 1,
    secrets: LEVELS.map((level) => level.id),
  };
  const sent = toPayload(everyLevel) as { levels: Record<string, unknown>; secrets: string[] };
  check(
    Object.keys(sent.levels).every((id) => ACCEPTED_BY_CB_SYNC.test(id)),
    `i ${Object.keys(sent.levels).length} livelli del payload arrivano tutti in fondo a cb_sync`,
  );
  check(
    sent.secrets.every((id) => ACCEPTED_BY_CB_SYNC.test(id)),
    'nessun gomitolo viene scartato dal server: sarebbe un gatto perso',
  );
}

console.log('\nSincronizzazione dei progressi');
{
  const local: Progress = {
    levels: {
      'w1-1': { cleared: true, bestDeaths: 4, bestTicks: 600, bestCoins: 2 },
      'w1-2': { cleared: false, bestDeaths: 0, bestTicks: 0, bestCoins: 0 },
    },
    totalDeaths: 40,
    secrets: ['w1-1'],
  };

  const payload = toPayload(local) as {
    levels: Record<string, { ms: number }>;
    secrets: string[];
  };
  check(payload.levels['w1-1']?.ms === 10000, 'un record di 600 tick parte come 10000ms');
  check(payload.levels['w1-2'] === undefined, 'un livello mai finito non ha un tempo da mandare');
  check(payload.secrets.includes('w1-1'), 'i gomitoli trovati partono con tutto il resto');

  // Il server ha un tempo migliore su 1-1, un livello che qui non c'è, e un
  // gomitolo trovato su un altro computer.
  const merged = applyRemote(
    {
      ok: true,
      nickname: 'gatto',
      total_deaths: 12,
      secrets: ['w2-3'],
      levels: {
        'w1-1': { ms: 9000, deaths: 9, coins: 1 },
        'w1-3': { ms: 20000, deaths: 2, coins: 5 },
      },
    },
    local,
  );

  check(merged.levels['w1-1']?.bestTicks === 540, 'del tempo vince il più basso dei due');
  check(merged.levels['w1-1']?.bestDeaths === 4, 'delle morti vince il numero più basso');
  check(
    merged.levels['w1-1']?.bestCoins === 2,
    'delle monete di un livello vince il numero più alto',
  );
  check(merged.levels['w1-3']?.cleared === true, 'un livello finito altrove arriva qui');
  check(merged.levels['w1-2']?.cleared === false, 'un livello mai finito resta mai finito');
  check(merged.totalDeaths === 40, 'le morti totali non scendono mai');
  check(
    merged.secrets.includes('w1-1') && merged.secrets.includes('w2-3'),
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
