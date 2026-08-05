import { Audio } from '@core/audio';
import { GameLoop } from '@core/loop';
import type { Input } from '@core/input';
import { buySkin, equipSkin, recordClear, type Progress } from '@core/storage';
import { SKINS, isSkinUnlocked } from '@game/skins';
import { RULES, TILE_SIZE } from '@game/config';
import { LEVELS } from '@game/levels';
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
        tile === TILE.BOSS_BRICK;
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
    const world = lair({ 8: '     H' });
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
    const world = lair({ 8: '     H', 12: '     @' });
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
      const world = lair({ 8: '     H', 12: '     @' });
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

// ---------------------------------------------------------------- i gatti
//
// Le skin non toccano il gioco — stessa cassa, stessa fisica, stessi comandi —
// quindi qui non si verifica il gameplay ma tre cose che possono rompersi in
// silenzio: che ogni gatto si disegni davvero (uno solo che esplode e il gioco
// è inservibile per chi l'ha comprato), che i cubi nascosti siano *presi* dove
// sono stati messi, e che le monete si comportino come un portafoglio.
console.log('\nI gatti (skin)');
{
  const skinAudio = new Audio();
  const idle = { isDown: () => false, justPressed: () => false, endTick: () => {} } as unknown as Input;

  const ids = new Set(SKINS.map((skin) => skin.id));
  check(ids.size === SKINS.length, `${SKINS.length} gatti, nessun id ripetuto`);
  check(
    SKINS.some((skin) => skin.unlock.kind === 'free'),
    'almeno un gatto è disponibile da subito',
  );

  // Disegno: ogni mantello passa davanti al renderer che intercetta i NaN.
  {
    const level = LEVELS[0]!;
    const world = new World(level, skinAudio, { onTaunt: () => {}, onWin: () => {} });
    const renderer = new NullRenderer();
    let crashed: unknown = null;
    try {
      for (const skin of SKINS) {
        world.player.skin = skin;
        world.draw(renderer, 0);
        // Un tick diverso, e in corsa: baffi, coda e scia cambiano disegno.
        world.player.vx = 4;
        world.player.onGround = true;
        world.draw(renderer, 37);
      }
    } catch (error) {
      crashed = error;
    }
    check(crashed === null, `tutti i ${SKINS.length} gatti si disegnano senza eccezioni`);
    if (crashed) console.error(crashed);
    check(renderer.transformDepth === 0, 'disegnando i gatti, push/pop restano bilanciati');
    check(
      renderer.problems.length === 0,
      `nessuna coordinata invalida in nessun gatto${renderer.problems.length ? ` (${renderer.problems.slice(0, 3).join('; ')})` : ''}`,
    );
  }

  // I cubi nascosti: uno per livello dichiarato, e raggiungibile per davvero.
  // Il controllo è lo stesso del risolutore, con l'arrivo spostato sul cubo e
  // quello vero cancellato — altrimenti "ci si arriva" sarebbe una bugia
  // comoda: si arriverebbe alla bandiera senza passare mai di lì.
  for (const skin of SKINS) {
    const unlock = skin.unlock;
    if (unlock.kind !== 'secret') continue;
    const level = LEVELS.find((l) => l.id === unlock.levelId);
    check(level !== undefined, `${skin.name}: il livello ${unlock.levelId} esiste`);
    if (!level) continue;

    const cubes = level.rows.reduce(
      (n, row) => n + [...row].filter((c) => c === TILE.SKIN_CUBE).length,
      0,
    );
    check(cubes === 1, `${level.name}: contiene esattamente un cubo (trovati ${cubes})`);

    const probe = level.rows.map((row) =>
      [...row]
        .map((c) => (c === TILE.SKIN_CUBE ? TILE.GOAL : c === TILE.GOAL ? TILE.EMPTY : c))
        .join(''),
    );
    const result = solve({ ...level, id: `cube-${level.id}`, rows: probe });
    check(
      result.solved,
      result.solved
        ? `${level.name}: il cubo di ${skin.name} è raggiungibile davvero`
        : `${level.name}: il cubo di ${skin.name} NON è raggiungibile (fermo alla colonna ${result.furthestColumn})`,
    );
  }

  // Raccoglierlo avvisa chi sta fuori, e non è una moneta.
  {
    const level = defineLevel({
      id: 'cube-test',
      name: 'TEST',
      title: 'cubo',
      sky: 'day',
      spawn: { c: 1, r: 12 },
      segments: [segment({ ground: true, rows: { 12: '     *' } })],
    });
    const found: string[] = [];
    const world = new World(level, skinAudio, {
      onTaunt: () => {},
      onWin: () => {},
      onSecret: (id) => found.push(id),
    });
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    world.update(idle);

    check(found.length === 1 && found[0] === 'cube-test', 'raccogliere il cubo avvisa il mondo di fuori');
    check(world.coins === 0, 'il cubo non è una moneta e non entra nel punteggio');
    check(world.state === 'playing', 'il cubo non uccide: per una volta è quello che sembra');
    check(world.map.get(5, 12) === TILE.EMPTY, 'il cubo sparisce dopo essere stato preso');

    // Morire non lo rimette al suo posto: si prende una volta sola.
    world.kill();
    for (let tick = 0; tick < 120; tick++) world.update(idle);
    check(world.map.get(5, 12) === TILE.EMPTY, 'morendo il cubo non ricompare');
  }

  // Il portafoglio.
  {
    const wallet: Progress = { levels: {}, totalDeaths: 0, coins: 100, skins: [], skin: 'classic' };

    const bought = buySkin(wallet, 'soot', 20);
    check(bought.coins === 80 && bought.skins.includes('soot'), 'comprare un gatto scala le monete');

    const broke = buySkin(bought, 'gilded', 150);
    check(broke === bought, 'senza monete abbastanza non si compra niente');

    const twice = buySkin(bought, 'soot', 20);
    check(twice === bought, 'un gatto già preso non si ricompra');

    const worn = equipSkin(bought, 'soot');
    check(worn.skin === 'soot', 'il gatto scelto resta scelto');

    const paid = recordClear(bought, 'w1-1', { deaths: 2, ticks: 100, coins: 7 });
    check(paid.coins === 87, 'le monete di un livello finito entrano in tasca');
    check(paid.skins.includes('soot'), 'finire un livello non fa perdere la collezione');

    const dead = { ...wallet, totalDeaths: 299 };
    const grim = SKINS.find((skin) => skin.unlock.kind === 'deaths');
    if (grim) {
      check(!isSkinUnlocked(grim, dead), `${grim.name} non si sblocca un morto prima`);
      check(isSkinUnlocked(grim, { ...dead, totalDeaths: 300 }), `${grim.name} si sblocca morendo abbastanza`);
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

// ---------------------------------------------------------------- nastri
//
// Il nastro è l'unica cosa del gioco che muove il gatto senza che nessuno
// gliel'abbia chiesto, quindi è anche l'unica che rischia di sembrare un
// controllo che non risponde. Il contratto è preciso: trasporta chi ci poggia
// sopra, non tocca la velocità di nessuno, e contro il nastro si cammina
// comunque — più piano, ma si cammina. Se un giorno queste tre cose smettono
// di essere vere, il nastro è diventato un bug (vedi CLAUDE.md).
console.log('\nNastri trasportatori');
{
  const beltAudio = new Audio();
  const beltWorld = (rows: Record<number, string>) => {
    const level = defineLevel({
      id: 'belt-test',
      name: 'TEST',
      title: 'nastri',
      sky: 'day',
      spawn: { c: 1, r: 12 },
      segments: [segment({ ground: true, rows })],
    });
    return new World(level, beltAudio, { onTaunt: () => {}, onWin: () => {} });
  };

  const idle = { isDown: () => false, justPressed: () => false, endTick: () => {} } as unknown as Input;
  const runLeft = {
    isDown: (a: string) => a === 'left',
    justPressed: () => false,
    endTick: () => {},
  } as unknown as Input;

  // Fermo sul nastro: il gatto viene portato via lo stesso.
  {
    const world = beltWorld({ 13: '####>>>>>>>>>>######' });
    world.player.reset(5 * TILE_SIZE, 12 * TILE_SIZE);
    const startX = world.player.x;
    for (let tick = 0; tick < 40; tick++) world.update(idle);
    check(world.player.x - startX > 30, `il nastro trasporta chi sta fermo (+${Math.round(world.player.x - startX)}px)`);
    check(world.player.vx === 0, 'il nastro non tocca la velocità del gatto');
  }

  // Contro il nastro si cammina comunque: più piano, ma si avanza.
  {
    const world = beltWorld({ 13: '####>>>>>>>>>>>>####' });
    world.player.reset(12 * TILE_SIZE, 12 * TILE_SIZE);
    const startX = world.player.x;
    for (let tick = 0; tick < 60; tick++) world.update(runLeft);
    check(world.player.x < startX - 60, `contro il nastro il gatto avanza lo stesso (${Math.round(world.player.x - startX)}px in 60 tick)`);
  }

  // Il nastro spinge, non incastra: contro un muro il gatto si ferma e basta.
  {
    const world = beltWorld({ 12: '        P', 13: '####>>>>>###########' });
    world.player.reset(6 * TILE_SIZE, 12 * TILE_SIZE);
    for (let tick = 0; tick < 60; tick++) world.update(idle);
    check(
      world.player.x + world.player.w <= 8 * TILE_SIZE,
      'il nastro non spinge il gatto dentro il muro',
    );
  }

  // Il nastro non uccide da solo: se ti butta nel vuoto la battuta è la sua.
  {
    const level = defineLevel({
      id: 'belt-pit',
      name: 'TEST',
      title: 'nastri',
      sky: 'day',
      spawn: { c: 1, r: 12 },
      segments: [segment({ rows: { 13: '####>>>>>>', 14: '####      ' } })],
    });
    const said: string[] = [];
    const world = new World(level, beltAudio, { onTaunt: (t) => said.push(t), onWin: () => {} });
    world.player.reset(8 * TILE_SIZE, 12 * TILE_SIZE);
    for (let tick = 0; tick < 200 && world.state === 'playing'; tick++) world.update(idle);
    check(world.state === 'dying', 'il nastro accompagna il gatto fin dentro il vuoto');
    check(
      said.some((t) => t.includes('nastro') || t.includes('pavimento')),
      `la caduta dal nastro è attribuita al nastro ("${said[0] ?? ''}")`,
    );
  }
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

console.log(failures === 0 ? '\nTutto ok.\n' : `\n${failures} controlli falliti.\n`);
process.exit(failures === 0 ? 0 : 1);
