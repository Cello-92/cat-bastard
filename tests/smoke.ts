import { Audio } from '@core/audio';
import { GameLoop, msToTicks, ticksToMs } from '@core/loop';
import { bindKeySequence, type Input } from '@core/input';
import type { Progress } from '@core/storage';
import { applyRemote, errorMessage, toPayload } from '@net/payload';
import { formatMs } from '@ui/format';
import { TILE_SIZE } from '@game/config';
import { LEVELS, SECRET_COUNT } from '@game/levels';
import { CATS, catRequirement, isCatUnlocked, type UnlockState } from '@game/cats';
import { AMBUSH_FEATS, FEAT, KONAMI } from '@game/feats';
import { BOSS, LUCIO, ROVESCIO, SPHINX, SEGMENT_COLS, LEVEL_ROWS, RULES } from '@game/config';
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

/**
 * C'è un campo rovescio nella colonna, all'altezza di questa cella?
 *
 * Serve all'igiene delle mappe del quarto mondo: una zavorra dentro un campo
 * cade **in su**, quindi l'appoggio glielo si deve mettere sopra, e cercarlo
 * dalla parte sbagliata darebbe un errore dove non c'è. Si guarda solo la
 * cella stessa e le due vicine in verticale, che è quanto basta a un peso
 * appoggiato dentro una colonna d'aria capovolta.
 */
function columnHasField(rows: readonly string[], c: number, r: number): boolean {
  for (let rr = r - 1; rr <= r + 1; rr++) {
    if (rows[rr]?.[c] === TILE.REVERSE) return true;
  }
  return false;
}

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
      // Una piastra murata è una trappola che non scatterà mai, e una piastra
      // che non sgancia niente è una lastra decorativa: due errori che non
      // rompono nulla e che nessuno noterebbe giocando, perché il livello si
      // finisce lo stesso — semplicemente senza la trappola che ci avevi messo.
      if (tile === TILE.PLATE && isSolid(at(c, r - 1)))
        flag(c, r, 'piastra murata: non ci si può salire sopra');
      if (tile === TILE.PLATE) {
        let bricks = 0;
        for (let cc = c - RULES.plateRange; cc <= c + RULES.plateRange; cc++) {
          for (let rr = 0; rr < LEVEL_ROWS; rr++) if (at(cc, rr) === TILE.TRAP_BRICK) bricks++;
        }
        if (bricks === 0) flag(c, r, 'piastra senza mattoni da sganciare nel raggio');
      }
      // Sabbie mobili col coperchio: non ci si entra e, se ci si entra, non se
      // ne esce. Non è una trappola cattiva, è una cella sprecata.
      if (tile === TILE.QUICKSAND && isSolid(at(c, r - 1)) && at(c, r - 1) !== TILE.EMPTY)
        flag(c, r, 'sabbie mobili murate: nuotare in su non porta da nessuna parte');
      if ((tile === TILE.COIN || tile === TILE.LURE_COIN) && isSolid(at(c, r - 1)) && isSolid(below))
        flag(c, r, 'moneta sepolta nel terreno');

      // --- Mondo 4. Le tre bestie nuove hanno tutte bisogno di qualcosa a cui
      //     stare attaccate, e sbagliare quel qualcosa non rompe niente: il
      //     ragno oscilla per aria, la zavorra esce dal mondo al primo tick e
      //     il pendolo pende dal vuoto. Tre errori invisibili, tre trappole che
      //     credevi di aver messo e che non ci sono.
      const above = at(c, r - 1);
      const field = tile === TILE.REVERSE;
      if (tile === TILE.SPIDER && !isSolid(above) && !isSolid(below))
        flag(c, r, 'ragno senza una superficie a cui attaccarsi');
      if (tile === TILE.BALLAST) {
        // Dentro un campo cade in su, quindi l'appoggio lo deve avere sopra.
        const inField = at(c, r) === TILE.BALLAST && columnHasField(rows, c, r);
        let lands = false;
        for (let rr = inField ? r - 1 : r + 1; rr >= 0 && rr < LEVEL_ROWS; rr += inField ? -1 : 1) {
          if (isSolid(at(c, rr))) {
            lands = true;
            break;
          }
        }
        if (!lands) flag(c, r, 'zavorra senza niente su cui fermarsi: esce dal mondo');
      }
      if (tile === TILE.PENDULUM && !isSolid(above) && !isSolid(below))
        flag(c, r, 'pendolo appeso al nulla: il perno non è fissato a niente');
      if (field && isSolid(above) && isSolid(below) && isSolid(at(c - 1, r)) && isSolid(at(c + 1, r)))
        flag(c, r, 'campo rovescio murato: non ci entra nessuno');
    }
  }

  // Campi rovesci che non arrivano al soffitto.
  //
  // Costa una riga scriverlo e costa un livello non scriverlo. Il gatto è alto
  // 28 pixel su celle da 32: appoggiato a una superficie occupa **una riga
  // sola**, quella subito attaccata. Se la colonna di campo si ferma una cella
  // prima del soffitto, il gatto sale, esce dal campo proprio nell'istante in
  // cui ci arriva, ricade, rientra nel campo, risale — e resta lì a rimbalzare
  // per sempre in mezzo all'aria. Non è una trappola e non è un livello
  // difficile: è un livello rotto, e non lo vede nessun altro controllo perché
  // la geometria è ineccepibile e il risolutore trova comunque un'altra strada.
  //
  // Una colonna aperta sul cielo invece va benissimo: quella è una trappola
  // vera (si cade in su e si muore), ed è dichiarata.
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < LEVEL_ROWS; r++) {
      if (at(c, r) !== TILE.REVERSE) continue;
      if (at(c, r - 1) === TILE.REVERSE) continue;

      let above = r - 1;
      while (above >= 0 && at(c, above) === TILE.EMPTY) above--;
      // `above < r - 1` vuol dire che in mezzo c'era del vuoto: il campo si
      // ferma prima del soffitto. Un campo attaccato al soffitto (il caso
      // normale, e l'unico giusto) non entra qui, e nemmeno una colonna aperta
      // sul cielo, che è una trappola dichiarata e non un errore.
      if (above < r - 1 && above >= 0 && isSolid(at(c, above))) {
        flag(c, r, 'campo rovescio che non arriva al soffitto: il gatto ci rimbalza dentro');
      }
    }
  }

  check(
    problems.length === 0,
    `${level.name}: niente appeso al nulla${problems.length ? ` — ${problems.slice(0, 4).join('; ')}` : ''}`,
  );

  // Buche sotto un risucchio che arriva fino a terra.
  //
  // È l'unico caso in cui la regola dei cinque salti mente, e l'ha trovato un
  // giocatore vero in 3-6 dopo che tutti i test erano verdi. Dentro una colonna
  // che scende l'accelerazione verso il basso è `gravity + downdraftPull`,
  // quindi il salto pieno passa da 122px a 48 e da sei colonne a due e mezzo:
  // una pozza larga quattro con il risucchio piantato sopra fino al pavimento
  // non si scavalca, e basta.
  //
  // Il risolutore non se ne accorge perché la sabbia sa nuotarla — attraversava
  // quella pozza affondando, in una manciata di tick di margine, cioè per una
  // via che nessuno troverebbe giocando. Quindi la regola va scritta qui: sotto
  // un risucchio che scende fino in fondo, il vuoto vale al massimo due colonne.
  {
    const DEEP = LEVEL_ROWS - 4;
    let run = 0;
    let worst = 0;
    let start = -1;
    for (let c = 0; c < cols; c++) {
      let solid = false;
      let deepDraft = false;
      for (let r = 0; r < LEVEL_ROWS; r++) {
        const tile = at(c, r);
        if (tile === TILE.DOWNDRAFT && r >= DEEP) deepDraft = true;
        const vanishes =
          tile === TILE.FAKE_GROUND ||
          tile === TILE.GHOST ||
          tile === TILE.COLLAPSE ||
          tile === TILE.BRITTLE_ICE;
        if (!vanishes && isSolid(tile)) solid = true;
      }
      run = !solid && deepDraft ? run + 1 : 0;
      if (run > worst) {
        worst = run;
        start = c - run + 1;
      }
    }
    check(
      worst <= 2,
      `${level.name}: nessun vuoto più largo di 2 colonne sotto un risucchio che arriva a terra` +
        `${worst > 2 ? ` (${worst} alla colonna ${start}: lì il salto pieno copre due colonne e mezzo)` : ''}`,
    );
  }

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

// ---------------------------------------------------------------- gomitoli
//
// Un gomitolo murato in una stanza dove non si entra non rompe niente: il
// livello si finisce lo stesso, i test passano, e l'unico effetto è un gatto
// che non si sblocca mai — cioè l'unica ricompensa del gioco che sparisce
// senza un messaggio d'errore. È esattamente il tipo di bug che questa
// cartella esiste per prendere.
//
// Si riusa il risolutore, con due accorgimenti. Primo: il gomitolo diventa
// l'arrivo, perché il risolutore sa cercare solo `W`. Secondo: il livello si
// taglia subito dopo di lui, perché la ricerca espande sempre la colonna più
// avanzata e col livello intero se ne andrebbe in fondo a consumare il budget
// invece di infilarsi nella stanza. Un percorso trovato nel livello tagliato è
// un percorso che esiste anche in quello vero: la mappa a sinistra è la stessa.
console.log('\nI gomitoli si possono prendere');
for (const level of LEVELS) {
  const column = level.rows.reduce(
    (found, row) => (row.indexOf(TILE.YARN) >= 0 ? row.indexOf(TILE.YARN) : found),
    -1,
  );
  if (column < 0) continue;

  const rows = level.rows.map((row) =>
    row.slice(0, column + 3).split(TILE.GOAL).join(TILE.EMPTY).split(TILE.YARN).join(TILE.GOAL),
  );
  const result = solve({ ...level, rows });
  check(
    result.solved,
    result.solved
      ? `${level.name}: al gomitolo della colonna ${column} ci si arriva`
      : `${level.name}: GOMITOLO IRRAGGIUNGIBILE alla colonna ${column} — ` +
        `la ricerca si ferma alla colonna ${result.furthestColumn}`,
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

// ------------------------------------------------- correnti e congegni del mondo 3
//
// Il mondo 2 aveva cambiato il pavimento, il mondo 3 cambia l'aria: una
// corrente sposta il gatto **mentre è a mezz'aria**, cioè nell'unico momento
// in cui non può correggere. È la modifica alla fisica più invasiva del gioco,
// quindi ha bisogno del contratto scritto più stretto — e tutto quello che
// c'è qui sotto deve valere identico in `tests/solver.ts`, altrimenti il
// risolutore approva un livello che nessuno può giocare (o viceversa).
console.log('\nCorrenti e congegni del mondo 3');
{
  const windAudio = new Audio();
  const SAND_FLOOR = '.'.repeat(SEGMENT_COLS);

  const withRows = (rows: Record<number, string>) => {
    const level = defineLevel({
      id: 'wind-test',
      name: 'TEST',
      title: 'correnti',
      sky: 'desert',
      spawn: { c: 1, r: 12 },
      segments: [segment({ rows })],
    });
    const feats: string[] = [];
    const world = new World(level, windAudio, {
      onTaunt: () => {},
      onWin: () => {},
      onFeat: (feat) => feats.push(feat),
    });
    return { world, feats };
  };

  const idle = { isDown: () => false, justPressed: () => false, endTick: () => {} } as unknown as Input;
  /** Tiene premuto "destra" e martella il salto: è come si nuota. */
  const swim = (tick: number) =>
    ({
      isDown: (a: string) => a === 'right' || (a === 'jump' && tick % 8 < 3),
      justPressed: (a: string) => a === 'jump' && tick % 8 === 0,
      endTick: () => {},
    }) as unknown as Input;

  // Il vento sposta chi è in aria, nel verso disegnato, e la corrente morta —
  // identica in tutto — non sposta niente.
  const driftInAir = (tile: string): number => {
    const band = '   ' + tile.repeat(12);
    const { world } = withRows({ 8: band, 9: band, 10: band, 11: band, 12: band });
    world.player.x = 6 * TILE_SIZE;
    world.player.y = 8 * TILE_SIZE;
    const start = world.player.x;
    for (let tick = 0; tick < 20; tick++) world.update(idle);
    return world.player.x - start;
  };

  check(driftInAir(TILE.WIND_RIGHT) > 20, 'la corrente d\'aria trascina a destra chi non tocca terra');
  check(driftInAir(TILE.WIND_LEFT) < -20, 'e a sinistra, se è disegnata a sinistra');
  check(
    Math.abs(driftInAir(TILE.DEAD_WIND)) < 1,
    'la corrente morta, identica a vedersi, non sposta un pixel',
  );

  // A terra il vento non conta: gli artigli tengono. È l'esatto contrario del
  // nastro trasportatore, ed è la regola che rende leggibili tutti e due.
  {
    const band = '.'.repeat(20);
    const { world } = withRows({ 11: ')'.repeat(20), 12: ')'.repeat(20), 13: band, 14: band });
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    for (let tick = 0; tick < 10; tick++) world.update(idle);
    const settled = world.player.x;
    for (let tick = 0; tick < 40; tick++) world.update(idle);
    check(
      Math.abs(world.player.x - settled) < 1 && world.player.onGround,
      'a terra la corrente non sposta niente: il vento non è un nastro',
    );
  }

  // E non tocca la velocità del gatto: sposta il mondo sotto di lui, come il
  // nastro. Se toccasse `vx`, i comandi risponderebbero diverso dentro una
  // corrente — cioè il gioco tradirebbe i controlli, che è l'unica cosa che
  // non può fare.
  {
    const band = '   ' + ')'.repeat(12);
    const { world } = withRows({ 8: band, 9: band, 10: band, 11: band });
    world.player.x = 6 * TILE_SIZE;
    world.player.y = 8 * TILE_SIZE;
    world.player.vx = 0;
    for (let tick = 0; tick < 12; tick++) world.update(idle);
    check(world.player.vx === 0, 'la corrente non tocca la velocità del gatto');
  }

  // Il risucchio: schiaccia il salto, e lo schiaccia sempre della stessa cosa.
  {
    const jumpApex = (column: string): number => {
      const shaft = ' '.repeat(5) + column;
      const { world } = withRows({
        8: shaft,
        9: shaft,
        10: shaft,
        11: shaft,
        12: shaft,
        13: SAND_FLOOR,
        14: SAND_FLOOR,
      });
      world.player.x = 5 * TILE_SIZE;
      world.player.y = 12 * TILE_SIZE;
      for (let tick = 0; tick < 5; tick++) world.update(idle);
      const floor = world.player.y;
      let apex = floor;
      for (let tick = 0; tick < 60; tick++) {
        const held = {
          isDown: (a: string) => a === 'jump',
          justPressed: (a: string) => a === 'jump' && tick === 0,
          endTick: () => {},
        } as unknown as Input;
        world.update(held);
        apex = Math.min(apex, world.player.y);
      }
      return floor - apex;
    };

    const free = jumpApex(' ');
    const sucked = jumpApex(TILE.DOWNDRAFT);
    check(free > 100, `il salto pieno sale di ${Math.round(free)}px`);
    check(sucked < free * 0.6, `dentro il risucchio sale ${Math.round(sucked)}px, molto meno`);
  }

  // Sabbie mobili: si affonda, ma piano. La differenza col vuoto è tutto il
  // margine che il giocatore ha per accorgersene e reagire.
  {
    const pool = ' '.repeat(4) + 's'.repeat(6);
    const rows: Record<number, string> = { 9: pool, 10: pool, 11: pool, 12: pool, 13: pool, 14: pool };
    const { world } = withRows(rows);
    world.player.x = 6 * TILE_SIZE;
    world.player.y = 9 * TILE_SIZE;
    const start = world.player.y;
    for (let tick = 0; tick < 30; tick++) world.update(idle);
    const sunk = world.player.y - start;

    const { world: air } = withRows({});
    air.player.x = 6 * TILE_SIZE;
    air.player.y = 9 * TILE_SIZE;
    const airStart = air.player.y;
    for (let tick = 0; tick < 30; tick++) air.update(idle);
    const fell = air.player.y - airStart;

    check(sunk > 0 && sunk < fell / 3, `nella sabbia si scende ${Math.round(sunk)}px invece di ${Math.round(fell)}px`);
  }

  // E se ne esce: a bracciate, tenendo una direzione. Non è una trappola —
  // è una superficie, e una superficie deve avere una risposta giusta.
  {
    const { world } = withRows({
      12: '    ssss',
      13: '....ssss............',
      14: '....ssss............',
    });
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    let escaped = false;
    for (let tick = 0; tick < 240 && !escaped; tick++) {
      world.update(swim(tick));
      escaped = world.player.onGround && world.player.x > 8 * TILE_SIZE;
    }
    check(escaped, 'dalle sabbie mobili si esce nuotando, se si insiste');
    check(world.state === 'playing', 'e uscirne non richiede di morire prima');
  }

  // Lo scarabeo: se lo porta la corrente, con lo stesso numero del gatto.
  //
  // Non è un dettaglio estetico ed è per questo che ha un test: è l'unico modo
  // che il giocatore ha di *vedere* dove lo porterà il salto prima di farlo. Se
  // un giorno smettesse di farsi trascinare resterebbe un nemico qualunque, il
  // livello continuerebbe a funzionare, e nessuno capirebbe più il vento.
  //
  // Non essendoci un modo di guardare dentro la lista delle entità, si usa il
  // gatto come sonda: lo si piazza a terra (dove il vento non lo tocca) sulla
  // traiettoria che lo scarabeo avrà solo se la corrente lo vince.
  {
    const probe = (tile: string): boolean => {
      const band = '  ' + tile.repeat(7) + 'k' + tile.repeat(9);
      const { world } = withRows({ 9: band, 10: SAND_FLOOR, 11: SAND_FLOOR });
      world.player.x = 4 * TILE_SIZE;
      world.player.y = 9 * TILE_SIZE;
      for (let tick = 0; tick < 200 && world.state === 'playing'; tick++) world.update(idle);
      return world.state !== 'playing';
    };

    check(probe(TILE.WIND_LEFT), 'la corrente contraria vince il volo dello scarabeo e se lo porta');
    check(!probe(TILE.WIND_RIGHT), 'a favore invece se ne va, e non torna a cercarti');
  }

  // La piastra a pressione: sgancia i mattoni nel raggio, non quelli fuori, e
  // una volta sola. È l'unico congegno del gioco in cui causa ed effetto stanno
  // in due posti diversi, quindi è anche l'unico che può rompersi in silenzio.
  {
    const { world } = withRows({
      6: '     T             T',
      13: '..p.................',
      14: SAND_FLOOR,
    });
    world.player.x = 2 * TILE_SIZE + 4;
    world.player.y = 12 * TILE_SIZE;
    for (let tick = 0; tick < 6; tick++) world.update(idle);

    check(world.map.get(5, 6) === TILE.EMPTY, 'pestare la piastra fa cadere il mattone vicino');
    check(
      world.map.get(19, 6) === TILE.TRAP_BRICK,
      `il mattone a ${19 - 2} colonne resta su: la piastra sente fino a ${RULES.plateRange}`,
    );
  }

  // L'impresa del vento: quattro secondi senza toccare niente. Non la chiede
  // nessuno, quindi nessuno si accorgerebbe se smettesse di funzionare.
  {
    const shaft = ' '.repeat(5) + '^';
    const { world, feats } = withRows({
      6: shaft,
      7: shaft,
      8: shaft,
      9: shaft,
      10: shaft,
      11: shaft,
      12: shaft,
      13: '.....' + ' ' + '..............',
      14: '.....' + ' ' + '..............',
    });
    world.player.x = 5 * TILE_SIZE + 5;
    world.player.y = 10 * TILE_SIZE;
    for (let tick = 0; tick < RULES.aloftTicks + 30; tick++) world.update(idle);
    check(feats.includes(FEAT.aloft), 'restare in aria quattro secondi vale il gatto ALISEO');

    // E toccare terra azzera: non si mette insieme a pezzi.
    const { world: grounded, feats: none } = withRows({ 13: SAND_FLOOR, 14: SAND_FLOOR });
    grounded.player.x = 5 * TILE_SIZE;
    grounded.player.y = 12 * TILE_SIZE;
    for (let tick = 0; tick < RULES.aloftTicks + 60; tick++) grounded.update(idle);
    check(!none.includes(FEAT.aloft), 'e stare fermi a terra per lo stesso tempo non vale niente');
  }
}

// ------------------------------------------------- il campo rovescio (mondo 4)
//
// Il mondo 2 ha cambiato il pavimento, il mondo 3 ha cambiato l'aria, il mondo
// 4 cambia **il basso**. È la modifica più radicale che la fisica del gioco
// abbia mai subito, quindi ha il contratto più stretto di tutti: che dentro un
// campo si cada in su, che il campo spento sia identico e non faccia niente,
// che i comandi restino esattamente gli stessi (destra è destra anche a testa
// in giù, e il salto va sempre via dal pavimento), che due inversioni si
// annullino, che si possa morire anche verso l'alto, che il checkpoint si
// ricordi come eri messo, e che la zavorra dica la verità — perché se smette
// di dirla, il mondo diventa illeggibile senza che si rompa niente.
console.log('\nIl campo rovescio (mondo 4)');
{
  const fieldAudio = new Audio();
  const CEILING = '#'.repeat(SEGMENT_COLS);

  const withField = (rows: Record<number, string>, spawn = { c: 5, r: 12 }) => {
    const level = defineLevel({
      id: 'field-test',
      name: 'TEST',
      title: 'campo rovescio',
      sky: 'spire',
      spawn,
      segments: [segment({ rows })],
    });
    return new World(level, fieldAudio, { onTaunt: () => {}, onWin: () => {} });
  };

  const idle = {
    isDown: () => false,
    justPressed: () => false,
    endTick: () => {},
  } as unknown as Input;
  const goRight = {
    isDown: (a: string) => a === 'right',
    justPressed: () => false,
    endTick: () => {},
  } as unknown as Input;
  const jump = {
    isDown: (a: string) => a === 'jump',
    justPressed: (a: string) => a === 'jump',
    endTick: () => {},
  } as unknown as Input;

  /** Una colonna alta quattro celle del tile dato, fra soffitto e pavimento. */
  const shaft = (tile: string): Record<number, string> => {
    const column = ' '.repeat(5) + tile;
    return {
      8: CEILING,
      9: column,
      10: column,
      11: column,
      12: column,
      13: FULL_GROUND,
      14: FULL_GROUND,
    };
  };

  // Il fatto fondamentale, e il gemello spento che lo rende una trappola.
  {
    const rise = (tile: string): number => {
      const world = withField(shaft(tile));
      world.player.x = 5 * TILE_SIZE + 5;
      world.player.y = 12 * TILE_SIZE;
      const start = world.player.y;
      for (let tick = 0; tick < 40; tick++) world.update(idle);
      return start - world.player.y;
    };

    check(rise(TILE.REVERSE) > TILE_SIZE * 2, 'dentro un campo rovescio si cade verso il soffitto');
    check(rise(TILE.DEAD_REVERSE) <= 0, 'il campo spento, identico a vedersi, non capovolge niente');
  }

  // I comandi non tradiscono mai: è il punto 5 del patto, ed è la cosa che
  // rende questa regola accettabile invece che sleale.
  {
    const world = withField(shaft(TILE.REVERSE));
    world.player.x = 5 * TILE_SIZE + 5;
    world.player.y = 12 * TILE_SIZE;
    for (let tick = 0; tick < 30; tick++) world.update(idle);
    check(world.player.gravity === -1, 'appeso al soffitto, il basso del gatto è in su');

    const before = world.player.x;
    for (let tick = 0; tick < 20; tick++) world.update(goRight);
    check(world.player.x > before + 10, 'a testa in giù, destra è ancora destra');

    world.update(jump);
    check(world.player.vy > 0, 'a testa in giù il salto va via dal pavimento, cioè verso il basso');
  }

  // Due inversioni si annullano: è quello che rende componibile la mossa del
  // Rovescio senza dover spiegare in che ordine si applicano le cose.
  {
    const world = withField(shaft(TILE.REVERSE));
    world.player.x = 5 * TILE_SIZE + 5;
    world.player.y = 12 * TILE_SIZE;
    check(world.gravityAt(world.player) === -1, 'stanza diritta + campo rovescio = capovolto');
    world.gravityFlipped = true;
    check(world.gravityAt(world.player) === 1, 'stanza capovolta + campo rovescio = diritto');
    world.player.x = 1 * TILE_SIZE;
    check(world.gravityAt(world.player) === -1, 'stanza capovolta fuori dal campo = capovolto');
  }

  // Si muore anche in su. Senza, il quarto mondo avrebbe un bordo invisibile
  // oltre il quale il gatto se ne va per sempre e il livello non finisce più.
  {
    const world = withField(shaft(TILE.REVERSE));
    world.player.y = -400;
    world.update(idle);
    check(world.state === 'dying', 'sopra il bordo del mondo si muore, come sotto');
  }

  // Il checkpoint si ricorda da che parte era il basso: rinascere diritti su
  // una lanterna attaccata al soffitto vorrebbe dire cadere ogni volta.
  {
    const world = withField({
      8: CEILING,
      10: '      S',
      11: '      u',
      12: '      u',
      13: FULL_GROUND,
      14: FULL_GROUND,
    });
    world.player.x = 6 * TILE_SIZE + 2;
    world.player.y = 10 * TILE_SIZE + 20;
    world.update(idle);
    check(world.player.gravity === -1, 'il gatto sulla lanterna è dentro il campo');

    world.kill();
    for (let tick = 0; tick < RULES.deathFreezeTicks + 2; tick++) {
      world.update(idle);
      if (world.state === 'playing') break;
    }
    check(world.player.gravity === -1, 'si rinasce al checkpoint con lo stesso peso di quando lo si è preso');
  }

  // La zavorra: il campo reso visibile. Se smette di obbedire non si rompe
  // niente — semplicemente il mondo comincia a mentire su dove si cade.
  {
    const restY = (tile: string): number => {
      // Colonna larga due: il campo sta a sinistra, la zavorra a destra. Il
      // marcatore viene tolto dalla griglia, quindi la cella della zavorra è
      // vuota per costruzione — ed è esattamente il caso che la sagoma
      // allargata di `Ballast.update` esiste per non sbagliare.
      const pair = ' '.repeat(5) + tile + tile;
      const world = withField({
        8: CEILING,
        9: pair,
        10: pair,
        11: ' '.repeat(5) + tile + 'z',
        12: pair,
        13: FULL_GROUND,
        14: FULL_GROUND,
      });
      for (let tick = 0; tick < 90; tick++) world.update(idle);
      const ballast = world.creatures.find((e) => e.constructor.name === 'Ballast');
      return ballast ? ballast.y : NaN;
    };

    const inField = restY(TILE.REVERSE);
    const inDead = restY(TILE.DEAD_REVERSE);
    check(
      inField < 10 * TILE_SIZE,
      `dentro un campo vero la zavorra si appoggia al soffitto (y=${Math.round(inField)})`,
    );
    check(
      inDead > 10 * TILE_SIZE,
      `sotto un campo spento la zavorra resta a terra, e lo dice (y=${Math.round(inDead)})`,
    );
  }

  // Schiacciare a testa in giù: la regola dello stomp è sempre la stessa, ed è
  // misurata rispetto al proprio peso. Il ragno sul soffitto è il posto in cui
  // questo si vede, ed è anche l'unico modo di toglierselo dai piedi.
  {
    // Stanza tutta capovolta invece di una colonna, e non è una scorciatoia:
    // il ragno sta attaccato al soffitto, quindi occuperebbe proprio la cella
    // in cui dovrebbe esserci il campo. Ribaltare la stanza è il modo di
    // provare la regola dello stomp senza provare anche altro.
    const world = withField({ 8: CEILING, 9: '     a', 13: FULL_GROUND, 14: FULL_GROUND });
    world.gravityFlipped = true;
    world.player.x = 5 * TILE_SIZE + 5;
    world.player.y = 12 * TILE_SIZE;
    for (let tick = 0; tick < 40; tick++) world.update(idle);
    const spiders = world.creatures.filter((e) => e.constructor.name === 'Spider').length;
    check(
      spiders === 0 && world.state === 'playing',
      'salendo verso il soffitto il ragno si schiaccia invece di uccidere',
    );
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
    CATS.filter((cat) => cat.yarn === 0 && !cat.feats && !cat.needsEveryLevel).length === 1,
    'esiste un solo gatto disponibile da subito',
  );
  check(
    CATS.every((cat) => cat.yarn <= SECRET_COUNT),
    `nessun gatto chiede più gomitoli di quanti ne esistano (${SECRET_COUNT})`,
  );

  // Un gatto per gomitolo, e nessuna soglia saltata.
  //
  // Non è pignoleria: un gomitolo sta in una stanza murata che non serve a
  // finire il livello, quindi l'unico motivo per andarci è quello che dà. Se
  // due gomitoli diversi dessero la stessa identica cosa — cioè niente —
  // cercare il secondo sarebbe una perdita di tempo *dimostrabile*, e la
  // collezione smetterebbe di essere una collezione. Chi aggiunge un livello
  // col suo `*` deve aggiungere anche il manto, e lo scopre qui.
  //
  // I gatti delle imprese restano fuori dal conto, e devono restarci: hanno
  // tutti `yarn: 0` perché la loro strada è un'altra, quindi contarli qui
  // direbbe che a quota 0 ci sono sei manti e che le quote sono piene quando
  // non lo sono. La scala dei gomitoli si misura solo sui gatti dei gomitoli.
  const byYarn = CATS.filter((cat) => !cat.feats?.length);
  const thresholds = new Set(byYarn.map((cat) => cat.yarn));
  const orphans: number[] = [];
  for (let n = 0; n <= SECRET_COUNT; n++) if (!thresholds.has(n)) orphans.push(n);
  check(
    orphans.length === 0,
    `ogni gomitolo sblocca un gatto${orphans.length ? ` — nessun manto a quota ${orphans.join(', ')}` : ` (${byYarn.length} manti per ${SECRET_COUNT} gomitoli, più ${CATS.length - byYarn.length} imprese)`}`,
  );
  check(
    thresholds.size === byYarn.length,
    'due gatti non chiedono lo stesso numero di gomitoli: il secondo sarebbe gratis',
  );

  // Le sagome dei gatti chiusi si disegnano come i gatti aperti: la galleria
  // mostra la forma di quello che manca, e una forma che esplode è un menu che
  // esplode. Il disegno vero sopra ha già coperto ogni manto; qui si controlla
  // che ogni motivo del manto sia davvero disegnato da qualcuno, perché un
  // `pattern` senza gatti che lo usano è codice che nessun test tocca.
  const patterns = new Set(CATS.map((cat) => cat.pattern));
  check(patterns.size >= 4, `i manti usano ${patterns.size} motivi diversi, non uno solo`);
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

// ------------------------------------------------------ lo scontro con Lucio
//
// Gothic Lucio non ha niente in comune col Padrone, e proprio per questo niente
// di quello che è stato provato qui sopra dice qualcosa su di lui.
//
// Il punto delicato è uno solo, ed è la ragione per cui questa sezione esiste:
// **l'unica arma dell'arena è una cella della mappa**. Il colpo non è un
// incontro fra due entità che volano, è un'entità che finisce sopra un tile
// acceso — e un tile acceso non esplode se smette di funzionare, si limita a
// non fare niente. Un Lucio che atterra sui ceri e non prende fuoco è un boss
// invincibile che passa tutti gli altri test.
console.log('\nGothic Lucio');
{
  const lucioAudio = new Audio();
  const idle = { isDown: () => false, justPressed: () => false, endTick: () => {} } as unknown as Input;

  /**
   * Cappella minima: volta, pietre, e una nicchia sopra lo spawn.
   *
   * La nicchia non è arredamento. Lucio si tuffa sulla colonna del gatto, e in
   * una stanza vuota qualunque attesa lunga finisce con lui che ammazza un
   * giocatore che non si muove: il livello si ricostruisce, `world.lucio`
   * diventa un altro oggetto e la prova misura un boss che non è quello che
   * stava esaminando. Sotto la mensola il tuffo atterra sopra la testa del
   * gatto senza toccarlo, e il tempo si può far passare davvero.
   */
  const chapel = (rows: Record<number, string>): World => {
    const level = defineLevel({
      id: 'lucio-test',
      name: 'TEST',
      title: 'lucio',
      sky: 'cave',
      boss: true,
      spawn: { c: 1, r: 12 },
      segments: [
        segment({ rows: { 0: FULL_GROUND, 11: '###', ...rows, 13: FULL_GROUND, 14: FULL_GROUND } }),
      ],
    });
    return new World(level, lucioAudio, { onTaunt: () => {}, onWin: () => {} });
  };

  /** Lo porta dal soffitto dentro il pavimento, che è l'unica cosa che conta. */
  const dropOn = (world: World, column: number): void => {
    const lucio = world.lucio;
    if (!lucio) return;
    lucio.x = column * TILE_SIZE + (TILE_SIZE - lucio.w) / 2;
    lucio.y = lucio.ceilingY;
    lucio.state = 'dive';
    for (let tick = 0; tick < 120 && lucio.state === 'dive'; tick++) world.update(idle);
  };

  const arena = LEVELS.find((level) => level.rows.some((row) => row.includes(TILE.GOTHIC_BOSS)));
  check(arena !== undefined, 'esiste una cappella con dentro Gothic Lucio');
  check(arena?.boss === true, "la cappella è dichiarata arena di un boss (niente checkpoint)");
  check(
    arena?.rows.some((row) => row.includes(TILE.BOSS_GATE)) === true,
    'anche la cappella è chiusa da un portone',
  );
  check(
    (arena?.rows.reduce((n, row) => n + [...row].filter((c) => c === TILE.CANDLE).length, 0) ?? 0) >= 4,
    "la cappella ha almeno quattro ceri (uno per candela del candelabro)",
  );
  // Ogni cero dev'essere posato su qualcosa. Un cero a mezz'aria non è un
  // errore che si vede: è semplicemente un posto in cui Lucio non atterrerà
  // mai, cioè un'arma che non esiste.
  if (arena) {
    const floating = arena.rows.flatMap((row, r) =>
      [...row].flatMap((tile, c) =>
        tile === TILE.CANDLE && !isSolid(arena.rows[r + 1]?.[c] ?? ' ') ? [`${c},${r}`] : [],
      ),
    );
    check(floating.length === 0, `nessun cero è appeso al nulla${floating.length ? ` (${floating.join('; ')})` : ''}`);
  }

  // Nasce appeso, e ci resta.
  {
    const world = chapel({ 2: '     $' });
    const lucio = world.lucio;
    check(lucio !== null, 'il marcatore "$" diventa davvero un Gothic Lucio');
    if (lucio) {
      const start = lucio.y;
      for (let tick = 0; tick < 40; tick++) world.update(idle);
      check(lucio.y <= start + 1, 'appeso alla volta ci resta: non cade da solo');
    }
  }

  // Toccarlo, in qualunque modo, è un modo di morire.
  {
    const world = chapel({ 2: '     $' });
    const lucio = world.lucio;
    if (lucio) {
      world.player.x = lucio.x + 8;
      world.player.y = lucio.y + 10;
      world.update(idle);
      check(world.state === 'dying', 'toccare Lucio uccide');
    }
  }
  {
    const world = chapel({ 2: '     $' });
    world.lucio?.onStomp(world);
    check(world.state === 'dying', 'saltargli addosso uccide: il collare ha le borchie in su');
  }

  // Il colpo: si tuffa dentro un cero acceso e brucia. È l'unico modo che
  // esiste di fargli male in tutta la cappella.
  {
    const world = chapel({ 2: '     $', 12: '     "' });
    const lucio = world.lucio;
    if (lucio) {
      dropOn(world, 5);
      check(lucio.hits === 1, `finire dentro un cero acceso spegne una candela (colpi: ${lucio.hits})`);
    }
  }

  // E il tuffo sulle pietre nude non fa niente: se bastasse atterrare, lo
  // scontro si vincerebbe aspettando, e non sarebbe uno scontro.
  {
    const world = chapel({ 2: '     $' });
    const lucio = world.lucio;
    if (lucio) {
      dropOn(world, 5);
      check(lucio.hits === 0, 'atterrare sulle pietre nude non gli fa niente');
      check(lucio.isStuck, 'ma ci resta conficcato: il tuffo sbagliato costa comunque');
    }
  }

  // Il cero su cui atterra se lo porta via, e poi torna.
  {
    const world = chapel({ 2: '     $', 12: '     "' });
    const lucio = world.lucio;
    if (lucio) {
      dropOn(world, 5);
      check(!world.candleLit(5, 12), "il cero su cui è atterrato si spegne: schiacciato");
      const afterFirst = lucio.hits;
      dropOn(world, 5);
      check(lucio.hits === afterFirst, 'e finché è spento lo stesso posto non funziona più');

      // Ma torna. Senza, la cappella diventerebbe una stanza con dentro un boss
      // e niente con cui spegnerlo: partita finita, non partita persa.
      for (let tick = 0; tick < LUCIO.candleRelightTicks + 40 && !world.candleLit(5, 12); tick++) {
        world.update(idle);
      }
      check(world.candleLit(5, 12), 'il cero si riaccende da solo');
      dropOn(world, 5);
      check(lucio.hits === afterFirst + 1, 'e allora ricolpisce');
    }
  }

  // Quattro candele, due fasi, e il portone che si apre solo alla fine.
  //
  // I colpi si danno a mano, come per il Padrone: che il cero faccia male è
  // già provato qui sopra, e legare questa prova all'economia dei ceri
  // vorrebbe dire misurare due cose insieme e non sapere quale delle due si è
  // rotta il giorno che diventa rossa.
  {
    const world = chapel({ 2: '     $', 12: '        |' });
    const lucio = world.lucio;
    if (lucio) {
      check(world.map.get(8, 12) === TILE.BOSS_GATE, 'il portone parte chiuso');

      for (let hit = 1; hit <= 4; hit++) {
        lucio.state = 'stuck';
        check(lucio.takeHit(world), `il colpo ${hit} va a segno`);
        if (hit === 2) {
          for (let guard = 0; guard < 400 && lucio.phase === 1; guard++) world.update(idle);
          check(lucio.phase === 2, 'due candele spente e Lucio cambia fase');
        }
      }

      check(lucio.hits === 4, 'quattro colpi spengono tutto il candelabro');
      check(lucio.isDead, 'con il candelabro spento Lucio cade');
      for (let tick = 0; tick < 20; tick++) world.update(idle);
      check(world.map.get(8, 12) === TILE.EMPTY, 'il portone si apre quando Lucio cade');
    }
  }

  // Colpirlo mentre non è conficcato non conta: la finestra è quella lì, e non
  // esiste nessun altro momento in cui sia raggiungibile.
  {
    const world = chapel({ 2: '     $' });
    const lucio = world.lucio;
    if (lucio) {
      for (const state of ['hang', 'aim', 'dive', 'climb'] as const) {
        lucio.state = state;
        check(!lucio.takeHit(world), `in stato "${state}" non si fa niente`);
      }
    }
  }

  // In seconda fase l'onda dell'atterraggio spegne anche i ceri lì intorno: i
  // quattro colpi non si possono dare tutti dallo stesso angolo di cappella.
  // In prima fase no — quella metà dello scontro serve a insegnare il tuffo.
  {
    const neighbourAfterDive = (phase: 1 | 2): boolean => {
      // Due ceri vicini: si atterra sul primo e si guarda il secondo.
      const world = chapel({ 2: '     $', 12: '     "  "' });
      const lucio = world.lucio;
      if (!lucio) return false;
      lucio.phase = phase;
      dropOn(world, 5);
      return world.candleLit(8, 12);
    };
    check(neighbourAfterDive(1), "in prima fase l'atterraggio non tocca i ceri vicini");
    check(!neighbourAfterDive(2), "in seconda fase l'onda spegne anche quelli intorno");
  }

  // ------------------------------------------------------------------------
  // E adesso la domanda che nessuno dei controlli qui sopra pone: **si vince?**
  //
  // È il controllo più importante della sezione, ed è costato quanto il
  // risolutore. Tutti i contratti possono essere verdi e lo scontro essere
  // matematicamente impossibile: è successo davvero, ed è successo in modo
  // istruttivo. La cattiveria di seconda fase, scritta la prima volta, spegneva
  // i ceri che Lucio sorvolava mentre scorreva — solo che per tuffarsi deve
  // arrivare *sopra* il gatto, e il gatto per farsi esca deve stare *sopra il
  // cero*: quindi spegneva sempre il bersaglio qualche tick prima di poterci
  // finire dentro. Seconda fase invincibile, tutti i test verdi.
  //
  // Quindi qui non si controlla lo scontro: si combatte. Un giocatore finto
  // gioca la strategia dichiarata dal livello — piazzarsi sul cero acceso più
  // vicino, aspettare che Lucio si stacchi, togliersi — e deve vincere. Non
  // dimostra che sia divertente, né che sia facile: dimostra che una strada
  // esiste, che è l'unica cosa che un test può dire di un boss.
  {
    const arenaLevel = LEVELS.find((level) => level.rows.some((row) => row.includes(TILE.GOTHIC_BOSS)));
    if (arenaLevel) {
      const world = new World(arenaLevel, lucioAudio, { onTaunt: () => {}, onWin: () => {} });
      const lit: { c: number; r: number }[] = [];
      arenaLevel.rows.forEach((row, r) =>
        [...row].forEach((tile, c) => {
          if (tile === TILE.CANDLE) lit.push({ c, r });
        }),
      );

      let held: string | null = null;
      let jumping = false;
      const bot = {
        isDown: (action: string) => action === held || (action === 'jump' && jumping),
        justPressed: () => false,
        endTick: () => {},
      } as unknown as Input;

      let won = false;
      let ticks = 0;
      for (; ticks < 12000; ticks++) {
        const boss = world.lucio;
        if (!boss) break;
        if (boss.isDead) {
          won = true;
          break;
        }

        const px = world.player.centerX;
        if (boss.state === 'aim' || boss.state === 'dive') {
          // Sta arrivando: togliersi, e in seconda fase saltare l'onda.
          held = px < boss.centerX ? 'left' : 'right';
          jumping = boss.phase === 2 && boss.state === 'dive';
        } else {
          // Piazzarsi sul cero acceso più vicino e aspettare lì.
          jumping = false;
          let target: number | null = null;
          for (const { c, r } of lit) {
            if (!world.candleLit(c, r)) continue;
            const x = c * TILE_SIZE + TILE_SIZE / 2;
            if (target === null || Math.abs(x - px) < Math.abs(target - px)) target = x;
          }
          held =
            target === null ? null : Math.abs(target - px) < 6 ? null : target > px ? 'right' : 'left';
        }

        world.update(bot);
      }

      check(won, `lo scontro con Lucio si può vincere davvero (${ticks} tick, ${world.deaths} morti)`);
    }
  }
}

// ---------------------------------------------------------------- la Sfinge
//
// Il terzo boss non ha niente in comune coi primi due, e quindi niente di
// quello che è stato provato là sopra dice qualcosa su di lui.
//
// Il punto delicato è nuovo. Nel Padrone l'arma sta nella mappa da prima
// (i mattoni), in Lucio pure (i ceri): un test può guardare se c'è. Qui
// **l'arma non esiste finché la Sfinge non la fabbrica**, e la fabbrica
// rompendo il pavimento su cui si combatte. Quindi ci sono due modi nuovi di
// rompere lo scontro in silenzio: un'eruzione che non sbriciola più niente
// (e allora non c'è nessun colpo possibile, per sempre), e un pavimento che si
// ricompatta troppo in fretta (e allora la sabbia non fa in tempo a servire).
// Nessuno dei due lancia un'eccezione: rendono la Sfinge immortale e basta.
console.log('\nLa Sfinge');
{
  const sphinxAudio = new Audio();
  const idle = { isDown: () => false, justPressed: () => false, endTick: () => {} } as unknown as Input;
  const SAND_HALL = '-'.repeat(SEGMENT_COLS);

  /** Sala minima: volta, pavimento d'arenaria e lei sepolta sotto. */
  const hall = (rows: Record<number, string>): World => {
    const level = defineLevel({
      id: 'sphinx-test',
      name: 'TEST',
      title: 'sfinge',
      sky: 'tomb',
      boss: true,
      spawn: { c: 1, r: 12 },
      // I default vanno PRIMA dello spread, o una riga passata da chi chiama
      // (per esempio un pavimento già sbriciolato) verrebbe sovrascritta dal
      // pavimento sano — e la prova misurerebbe l'esatto contrario di quello
      // che voleva misurare.
      segments: [segment({ rows: { 0: SAND_HALL, 13: SAND_HALL, 14: SAND_HALL, ...rows } })],
    });
    return new World(level, sphinxAudio, { onTaunt: () => {}, onWin: () => {} });
  };

  /**
   * Fa eruttare la Sfinge in un punto scelto, col gatto al sicuro dall'altra
   * parte della sala.
   *
   * La colonna va **inchiodata** a ogni tick, non solo all'inizio: lei scava
   * verso il gatto, e se la si lascia arrivare gli erutta sotto e lo ammazza —
   * a quel punto il livello si ricostruisce, `world.sphinx` diventa un altro
   * oggetto, e la prova sta misurando un boss che non è quello che stava
   * esaminando. È lo stesso inciampo della nicchia nel test di Lucio.
   */
  const eruptAt = (world: World, column: number, limit = 900): void => {
    const boss = world.sphinx;
    if (!boss) return;
    for (let tick = 0; tick < limit && boss.state !== 'crest' && boss.state !== 'sink'; tick++) {
      boss.x = column * TILE_SIZE;
      world.player.reset(18 * TILE_SIZE, 12 * TILE_SIZE);
      world.update(idle);
    }
  };

  // Sepolta non tocca nessuno: metà scontro le si cammina sopra.
  {
    const world = hall({ 12: '      0' });
    const sphinx = world.sphinx;
    check(sphinx !== null, "la sala carica la Sfinge");
    if (sphinx) {
      world.player.x = sphinx.centerX - world.player.w / 2;
      world.player.y = 12 * TILE_SIZE;
      for (let tick = 0; tick < 3; tick++) world.update(idle);
      check(world.state === 'playing', 'sepolta non uccide chi le sta sopra');
      check(sphinx.isBuried, 'e resta sepolta finché non decide lei');
    }
  }

  // L'eruzione sbriciola il pavimento sotto di lei: è l'unico modo in cui
  // l'arma dello scontro viene al mondo. Se un giorno smettesse di sbriciolare,
  // la Sfinge diventerebbe imbattibile senza che niente si rompa.
  {
    const world = hall({ 12: '      0' });
    const sphinx = world.sphinx;
    if (sphinx) {
      const row = sphinx.floorRow;
      const sandCount = (): number =>
        [...Array(SEGMENT_COLS).keys()].filter((c) => world.map.get(c, row) === TILE.QUICKSAND).length;

      eruptAt(world, 5);
      const ruined = sandCount();
      check(ruined >= 3, `l'eruzione sbriciola il pavimento (${ruined} celle)`);

      // E il vento lo ricompatta: senza, dopo otto eruzioni la sala non
      // avrebbe più un pezzo di pavimento su cui stare in piedi.
      for (let tick = 0; tick < SPHINX.floorHealTicks + 200; tick++) {
        sphinx.x = 5 * TILE_SIZE;
        world.player.reset(18 * TILE_SIZE, 12 * TILE_SIZE);
        world.update(idle);
      }
      check(sandCount() < ruined, `il pavimento si ricompatta da solo (${ruined} -> ${sandCount()} celle)`);
    }
  }

  // Erutta dentro la propria sabbia: non trova presa, resta conficcata, e
  // quello è il colpo. È il contratto centrale di tutto lo scontro.
  {
    const world = hall({ 12: '      0', 13: '----ssss------------' });
    const sphinx = world.sphinx;
    if (sphinx) {
      // La si porta sopra la sabbia a mano: qui si prova la regola, non la
      // strategia — quella la prova il giocatore finto più sotto.
      eruptAt(world, 5);
      check(sphinx.hits > 0, 'eruttando nella propria sabbia resta conficcata e incassa');
      check(sphinx.state === 'sink' || sphinx.state === 'hurt', 'e resta lì dentro invece di uscire');
    }
  }

  // Toccarla mentre è fuori uccide, e schiacciarla pure: è una statua.
  {
    const world = hall({ 12: '      0' });
    const sphinx = world.sphinx;
    if (sphinx) {
      sphinx.state = 'crest';
      sphinx.y = sphinx.floorY - 80;
      world.player.x = sphinx.centerX - world.player.w / 2;
      world.player.y = sphinx.y + 10;
      world.update(idle);
      check(world.state === 'dying', 'toccarla mentre è fuori uccide');
    }
    {
      const stompWorld = hall({ 12: '      0' });
      const boss = stompWorld.sphinx;
      if (boss) {
        boss.state = 'crest';
        boss.y = boss.floorY - 80;
        check(!boss.onStomp(stompWorld), 'schiacciarla non funziona: è arenaria');
        check(stompWorld.state === 'dying', 'e ci si muore');
      }
    }
  }

  // Colpirla quando non è conficcata non conta: la finestra è quella lì.
  {
    const world = hall({ 12: '      0' });
    const sphinx = world.sphinx;
    if (sphinx) {
      for (const state of ['burrow', 'rumble', 'erupt', 'crest', 'dive'] as const) {
        sphinx.state = state;
        check(!sphinx.takeHit(world), `in stato "${state}" non si fa niente`);
      }
    }
  }

  // Quattro colpi, due fasi, e il portone della sala vera che si apre in fondo.
  {
    const arenaLevel = LEVELS.find((level) => level.rows.some((row) => row.includes(TILE.SPHINX)));
    check(arenaLevel !== undefined, "3-11 esiste ed è l'arena della Sfinge");
    if (arenaLevel) {
      const world = new World(arenaLevel, sphinxAudio, { onTaunt: () => {}, onWin: () => {} });
      const sphinx = world.sphinx;
      const gate = findTile(arenaLevel.rows, TILE.BOSS_GATE);
      if (sphinx && gate) {
        check(world.map.get(gate.c, gate.r) === TILE.BOSS_GATE, 'il portone parte chiuso');

        for (let hit = 1; hit <= SPHINX.hitsPerPhase * 2; hit++) {
          sphinx.state = 'sink';
          world.player.reset(2 * TILE_SIZE, 12 * TILE_SIZE);
          sphinx.takeHit(world);
          if (hit === SPHINX.hitsPerPhase) {
            for (let guard = 0; guard < 400 && sphinx.phase === 1; guard++) {
              world.player.reset(2 * TILE_SIZE, 12 * TILE_SIZE);
              world.update(idle);
            }
            check(sphinx.phase === 2, 'due colpi e la Sfinge cambia fase');
          }
        }
        check(sphinx.isDead, 'quattro colpi la seppelliscono');

        for (let tick = 0; tick < 20; tick++) {
          world.player.reset(2 * TILE_SIZE, 12 * TILE_SIZE);
          world.update(idle);
        }
        check(world.map.get(gate.c, gate.r) === TILE.EMPTY, 'il portone si apre quando cade');
      }
    }
  }

  // In seconda fase sbriciola più largo: è il suo modo di barare, ed è anche
  // il modo in cui si condanna — più stanza rompe, più posti ci sono in cui
  // può restare conficcata, e meno ce ne sono in cui puoi stare tu.
  {
    const ruinedBy = (phase: 1 | 2): number => {
      const world = hall({ 12: '      0' });
      const sphinx = world.sphinx;
      if (!sphinx) return 0;
      sphinx.phase = phase;
      const row = sphinx.floorRow;
      eruptAt(world, 8);
      return [...Array(SEGMENT_COLS).keys()].filter((c) => world.map.get(c, row) === TILE.QUICKSAND)
        .length;
    };
    const first = ruinedBy(1);
    const second = ruinedBy(2);
    check(second > first, `in seconda fase l'eruzione rompe più stanza (${first} -> ${second} celle)`);
  }

  // ------------------------------------------------------------------------
  // E la domanda che nessuno dei controlli qui sopra pone: **si vince?**
  //
  // Vale qui esattamente la lezione di Lucio, e vale doppio, perché questo
  // scontro ha una parte in più che può rompersi da sola: l'arma se la deve
  // costruire il giocatore, sbagliando. Se i tempi non tornassero — la sabbia
  // che si ricompatta prima che lei ci ripassi, il corpo troppo stretto per
  // toccare una cella guasta, il rimbombo troppo corto per scappare — tutti i
  // contratti resterebbero verdi e la sala sarebbe una stanza in cui si gira a
  // vuoto finché non ci si stanca.
  //
  // Quindi un giocatore finto gioca la strategia dichiarata dal livello: si
  // piazza sul bordo delle macerie, aspetta il rimbombo, scappa. E deve vincere.
  {
    const arenaLevel = LEVELS.find((level) => level.rows.some((row) => row.includes(TILE.SPHINX)));
    if (arenaLevel) {
      const world = new World(arenaLevel, sphinxAudio, { onTaunt: () => {}, onWin: () => {} });
      let held: string | null = null;
      const bot = {
        isDown: (action: string) => action === held,
        justPressed: () => false,
        endTick: () => {},
      } as unknown as Input;

      let won = false;
      let ticks = 0;
      for (; ticks < 20000; ticks++) {
        const boss = world.sphinx;
        if (!boss) break;
        if (boss.isDead) {
          won = true;
          break;
        }

        const px = world.player.centerX;
        const row = boss.floorRow;

        if (boss.state === 'rumble' || !boss.isBuried) {
          // Sta per uscire, o è già fuori: togliersi, e restare lontani.
          held = px < boss.centerX ? 'left' : 'right';
          // Contro il muro si scappa dall'altra parte, altrimenti si resta lì
          // a farsi prendere addosso al bordo della sala.
          if (px < 2.5 * TILE_SIZE) held = 'right';
          else if (px > world.map.widthPx - 2.5 * TILE_SIZE) held = 'left';
        } else {
          // Si cerca il bordo della sabbia più vicina e ci si mette accanto:
          // accanto, non sopra, o si affonda mentre si aspetta.
          let bait: number | null = null;
          for (let c = 1; c < world.map.cols - 1; c++) {
            if (world.map.get(c, row) !== TILE.QUICKSAND) continue;
            for (const side of [-1, 1] as const) {
              const near = c + side;
              if (world.map.get(near, row) !== TILE.SANDSTONE) continue;
              const x = near * TILE_SIZE + TILE_SIZE / 2;
              if (bait === null || Math.abs(x - px) < Math.abs(bait - px)) bait = x;
            }
          }
          // Nessuna macerie ancora: ci si mette in mezzo alla sala e la si
          // lascia arrivare. La prima eruzione è quella che crea l'arma.
          const target = bait ?? world.map.widthPx / 2;
          held = Math.abs(target - px) < 5 ? null : target > px ? 'right' : 'left';
        }

        world.update(bot);
      }

      check(won, `lo scontro con la Sfinge si può vincere davvero (${ticks} tick, ${world.deaths} morti)`);
    }
  }
}

// ------------------------------------------------- lo scontro col Rovescio
//
// Il quarto boss ha la stessa parte fragile della Sfinge, e in più una sua: la
// sua arma non è un pezzo di mappa che sta lì fermo (il soffitto del Padrone, i
// ceri di Lucio) ma **una conseguenza della sua stessa mossa**. Ribalta la
// stanza, e ribaltando la stanza fa cadere le zavorre — comprese quelle ferme
// dove sta lui. Se un giorno una zavorra smettesse di obbedire al campo, o se
// il suo scarto diventasse abbastanza lungo da uscire sempre dalla fascia, non
// si romperebbe niente: il Rovescio diventerebbe immortale in silenzio, che è
// esattamente il modo in cui la fase 2 di Lucio è stata invincibile per un po'.
//
// Quindi qui si verifica il contratto, e poi un giocatore finto combatte
// davvero e deve vincere.
console.log('\nLo scontro col Rovescio');
{
  const arenaAudio = new Audio();
  const STONE = 'b'.repeat(SEGMENT_COLS);

  // Il gatto sta dietro un pilastro, e non è pigrizia: il Rovescio cammina
  // verso di lui e toccarlo uccide, quindi senza muro ogni prova finirebbe con
  // la morte del gatto, la ricostruzione del livello e un boss nuovo di zecca —
  // cioè misurando un'altra cosa.
  const WALL = { 9: '    b', 10: '    b', 11: '    b', 12: '    b' };

  const arena = (rows: Record<number, string>, spawn = { c: 2, r: 12 }) => {
    const level = defineLevel({
      id: 'rovescio-test',
      name: 'TEST',
      title: 'il Rovescio',
      sky: 'reverse',
      boss: true,
      spawn,
      segments: [segment({ rows })],
    });
    return new World(level, arenaAudio, { onTaunt: () => {}, onWin: () => {} });
  };

  const idle = {
    isDown: () => false,
    justPressed: () => false,
    endTick: () => {},
  } as unknown as Input;

  /** Sala minima: lui a destra, una zavorra esattamente sotto di lui. */
  const withBoss = (bossRow = '          z1        ') =>
    arena({ 0: STONE, 1: STONE, ...WALL, 12: bossRow, 13: STONE, 14: STONE });

  // Toccarlo uccide, da qualunque parte. È di ferro e pesa quanto la stanza.
  {
    const world = withBoss();
    const boss = world.rovescio!;
    world.player.x = boss.x + 4;
    world.player.y = boss.y + 8;
    world.update(idle);
    check(world.state === 'dying', 'toccare il Rovescio uccide');
  }

  // E schiacciarlo pure: ha una piastra d'acciaio sulla schiena, e ce l'ha da
  // tutte e due le parti perché per metà scontro la schiena è di sotto.
  {
    const world = withBoss();
    const boss = world.rovescio!;
    world.player.x = boss.centerX - world.player.w / 2;
    world.player.y = boss.y - world.player.h + 4;
    world.player.vy = 6;
    world.update(idle);
    check(world.state === 'dying', 'saltargli in testa uccide come toccarlo');
  }

  // Una zavorra ferma addosso a lui non gli fa niente: quello che schiaccia è
  // il peso che cade. Senza questa regola morirebbe da solo al primo tick.
  {
    const world = withBoss();
    const boss = world.rovescio!;
    for (let tick = 0; tick < 40; tick++) world.update(idle);
    check(boss.hits === 0, 'una zavorra appoggiata addosso a lui non è un colpo');
  }

  // Ribaltata la stanza, la stessa zavorra parte e lo prende. È l'unico modo
  // di fargli male che esista, e non lo esegue il giocatore: lo esegue lui.
  {
    const world = withBoss();
    const boss = world.rovescio!;
    // Lontano, così non lo sveglia e non si muove da dove sta la zavorra.
    world.player.x = 1 * TILE_SIZE;
    world.flipRoom();
    for (let tick = 0; tick < 12; tick++) world.update(idle);
    check(boss.hits === 1, `ribaltare la stanza gli fa cadere addosso il suo peso (colpi: ${boss.hits})`);
  }

  // Il rimbombo prima del ribaltamento esiste ed è l'unico preavviso: un boss
  // che capovolgesse la stanza senza annunciarlo non sarebbe difficile,
  // sarebbe un dado (CLAUDE.md, punto 1).
  {
    const world = withBoss();
    const boss = world.rovescio!;
    let sawWind = false;
    let flips = 0;
    let wasFlipped = world.gravityFlipped;
    for (let tick = 0; tick < 900; tick++) {
      world.update(idle);
      if (boss.isWinding) sawWind = true;
      if (world.gravityFlipped !== wasFlipped) {
        wasFlipped = world.gravityFlipped;
        flips++;
        check(sawWind, 'il ribaltamento arriva sempre dopo un rimbombo');
        break;
      }
    }
    check(flips > 0, 'prima o poi ribalta la stanza da solo');
  }

  // I colpi previsti aprono il portone. Se non lo aprissero, la sala sarebbe
  // una stanza vinta da cui non si esce.
  {
    const world = arena({
      0: STONE,
      1: STONE,
      ...WALL,
      11: '            ||      ',
      12: '       z1   ||     W',
      13: STONE,
      14: STONE,
    });
    const boss = world.rovescio!;
    world.player.x = 1 * TILE_SIZE;
    for (let hit = 0; hit < ROVESCIO.hitsPerPhase * 2; hit++) {
      boss.takeHit(world);
      // Il rinculo lo rende invulnerabile: va lasciato scorrere, o il secondo
      // colpo non conta e il test misurerebbe un'altra cosa.
      for (let tick = 0; tick < ROVESCIO.rageTicks + ROVESCIO.hurtTicks + 4; tick++) {
        world.update(idle);
      }
    }
    check(boss.isDead, `${ROVESCIO.hitsPerPhase * 2} colpi lo spengono`);
    check(
      world.map.get(12, 11) === TILE.EMPTY && world.map.get(13, 12) === TILE.EMPTY,
      'quando cade, il portone si apre',
    );
  }

  // E adesso la cosa che conta: un giocatore finto combatte davvero.
  //
  // I controlli qui sopra dicono che i pezzi funzionano, non che lo scontro si
  // possa vincere — ed è esattamente la distinzione che in 2-11 aveva lasciato
  // passare una fase 2 matematicamente invincibile con tutti i controlli verdi.
  // La strategia è quella dichiarata nel commento del livello: entrare nella
  // fascia fitta, piazzarsi su una colonna dispari (dove i pesi non passano) e
  // **non fare più niente**. Lui arriva, non trova dove scansarsi, e si ribalta
  // la stanza addosso da solo.
  {
    const level = LEVELS.find((l) => l.id === 'w4-11');
    check(level !== undefined, 'il livello del Rovescio esiste');

    if (level) {
      const world = new World(level, arenaAudio, { onTaunt: () => {}, onWin: () => {} });
      // Colonna 29: dispari (quindi fuori dalla traiettoria delle zavorre,
      // che stanno sulle pari), senza spuntoni né sul pavimento né sul
      // soffitto, e abbastanza dentro la fascia fitta perché nemmeno uno
      // scarto intero porti il Rovescio fuori. È il posto che il livello
      // descrive a parole, e un giocatore vero lo trova morendo.
      const target = 29 * TILE_SIZE + TILE_SIZE / 2;
      // Il gatto viene messo direttamente sulla colonna giusta, e non è una
      // scorciatoia: che l'arena si attraversi lo dimostra già il risolutore,
      // qui si vuole provare **lo scontro**. La strategia è quella scritta nel
      // livello — piazzarsi sulla colonna dispari senza spuntoni, restarci, e
      // non fare più niente. Lui arriva, non trova dove scansarsi, e si
      // ribalta la stanza addosso da solo.
      world.player.x = target - world.player.w / 2;
      const fighter = {
        isDown: (action: string) =>
          (action === 'right' && world.player.centerX < target - 2) ||
          (action === 'left' && world.player.centerX > target + 2),
        justPressed: () => false,
        endTick: () => {},
      } as unknown as Input;

      let ticks = 0;
      while (ticks < 6000 && !(world.rovescio?.isDead ?? false)) {
        world.update(fighter);
        ticks++;
      }

      const boss = world.rovescio;
      check(
        boss?.isDead === true,
        boss?.isDead
          ? `un giocatore finto lo batte in ${ticks} tick stando fermo nel posto giusto`
          : `IL ROVESCIO NON SI BATTE: ${boss?.hits ?? 0} colpi su ${ROVESCIO.hitsPerPhase * 2} in 6000 tick`,
      );
      check(
        world.deaths === 0,
        `sulla colonna giusta non si muore mai, nemmeno quando la stanza si ribalta (morti: ${world.deaths})`,
      );
    }
  }
}

// ---------------------------------------------------------------- le imprese
//
// Gli easter egg sono l'unica parte del gioco che nessuno andrà a controllare
// giocando: chi non sa che ci sono non si accorge se smettono di funzionare, e
// chi lo sa dà per scontato di averli già fatti. Una marca che non parte è un
// gatto che non arriva mai, e non lo segnala nessuno.
//
// Quello che si verifica qui è il contratto di ognuna: la condizione giusta la
// fa scattare, la condizione quasi giusta no — perché un'impresa che si prende
// per sbaglio non è un segreto, è un regalo.
console.log('\nImprese');
{
  const featAudio = new Audio();
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

  const withRows = (rows: Record<number, string>, ground = true) => {
    const level = defineLevel({
      id: 'feat-test',
      name: 'TEST',
      title: 'imprese',
      sky: 'day',
      spawn: { c: 1, r: 12 },
      segments: [segment({ ground, rows })],
    });
    const feats: string[] = [];
    const world = new World(level, featAudio, {
      onTaunt: () => {},
      onWin: () => {},
      onFeat: (feat) => feats.push(feat),
    });
    return { world, feats };
  };

  // La statua: mezzo minuto senza toccare niente.
  {
    const { world, feats } = withRows({});
    for (let tick = 0; tick < RULES.stillTicks + 2; tick++) world.update(idle);
    check(feats.includes(FEAT.still), 'restare fermi mezzo minuto vale il gatto OMBRA');
    check(
      feats.filter((f) => f === FEAT.still).length === 1,
      'e continuare a stare fermi non lo assegna altre mille volte',
    );
  }
  {
    const { world, feats } = withRows({});
    for (let tick = 0; tick < RULES.stillTicks + 2; tick++) world.update(runRight);
    check(!feats.includes(FEAT.still), 'chi cammina non è fermo, per quanto a lungo lo faccia');
  }
  {
    // Il conto riparte da zero a ogni morte: mezzo minuto vero, non a pezzi.
    const { world, feats } = withRows({});
    for (let tick = 0; tick < RULES.stillTicks - 40; tick++) world.update(idle);
    world.kill();
    for (let tick = 0; tick < RULES.deathFreezeTicks + 60; tick++) world.update(idle);
    check(!feats.includes(FEAT.still), 'morire azzera il conto di chi stava fermo');
  }

  // Il digiuno: un livello finito senza morire e senza toccare una moneta.
  {
    const { world, feats } = withRows({ 12: '     CW' });
    world.player.x = 6 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    world.update(idle);
    check(world.state === 'won', 'la prova arriva davvero in fondo al livello');
    check(feats.includes(FEAT.ascetic), 'finire senza morti e senza monete vale il gatto MONACO');
  }
  {
    const { world, feats } = withRows({ 12: '     CW' });
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    // Prima la moneta, poi l'arrivo: una moneta sola e il digiuno è rotto.
    for (let tick = 0; tick < 60 && world.state === 'playing'; tick++) world.update(runRight);
    check(world.coins === 1, 'la moneta sulla strada viene raccolta');
    check(!feats.includes(FEAT.ascetic), 'chi raccoglie anche una sola moneta non sta digiunando');
  }
  {
    const { world, feats } = withRows({ 12: '     W' });
    world.kill();
    // Il fermo immagine della morte più i tick di hit-stop: si aspetta con
    // abbondanza, quello che conta è che il livello sia ripartito.
    for (let tick = 0; tick < RULES.deathFreezeTicks + 20; tick++) world.update(idle);
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    world.update(idle);
    check(world.state === 'won' && !feats.includes(FEAT.ascetic), 'e chi è morto una volta nemmeno');
  }

  // L'album: sette imboscate, sette figurine. Qui se ne provano tre, una per
  // ciascun modo in cui il gioco può accorgersi di come sei morto: il tile che
  // uccide da solo, l'entità che ti cade addosso, e la colpa attribuita a
  // qualcosa che era sparito prima che tu cadessi.
  {
    const { world, feats } = withRows({ 12: '     E' });
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    world.update(idle);
    check(feats.includes(FEAT.ambushLure), 'la moneta esca lascia la sua figurina');
  }
  {
    const { world, feats } = withRows({ 12: '     ^' });
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    world.update(idle);
    check(feats.length === 0, 'morire in un modo qualunque non colleziona niente');
  }
  {
    // Il masso che crolla (`K`) non è una stalattite (`T`): la morte è sua, e
    // la figurina pure. Con una causa sola erano la stessa trappola.
    const { world, feats } = withRows({ 8: '     K' });
    world.player.x = 5 * TILE_SIZE;
    world.player.y = 12 * TILE_SIZE;
    for (let tick = 0; tick < 40 && world.state === 'playing'; tick++) world.update(idle);
    check(world.state === 'dying', 'il masso che crolla arriva fino in fondo');
    check(feats.includes(FEAT.ambushCollapse), 'e lascia la figurina del crollo, non quella della stalattite');
  }
  {
    // La piattaforma fantasma non uccide: fa cadere. Senza attribuire la colpa
    // sarebbe una morte nel vuoto qualunque — e la battuta scritta apposta in
    // `taunts.ts` non l'avrebbe mai letta nessuno.
    const { world, feats } = withRows({ 13: '     L' }, false);
    world.player.x = 5 * TILE_SIZE + 4;
    world.player.y = 13 * TILE_SIZE - world.player.h;
    for (let tick = 0; tick < 200 && world.state === 'playing'; tick++) world.update(idle);
    check(world.state === 'dying', 'senza la piattaforma fantasma si finisce di sotto');
    check(feats.includes(FEAT.ambushGhost), 'e la colpa è sua, non del vuoto');
  }

  // Le sette figurine devono esistere davvero nei livelli veri.
  //
  // È l'unico modo in cui il gatto CAVIA può diventare impossibile senza che
  // niente si rompa: basta che qualcuno tolga l'ultimo getto spento da una
  // mappa e l'album non si chiude più, in silenzio, per sempre. La coppia
  // impresa/tile è scritta qui apposta, come la regex di cb_sync.
  {
    const ALBUM: ReadonlyArray<readonly [string, string]> = [
      [FEAT.ambushLure, TILE.LURE_COIN],
      [FEAT.ambushLantern, TILE.FAKE_CHECKPOINT],
      [FEAT.ambushCollapse, TILE.COLLAPSE],
      [FEAT.ambushGhost, TILE.GHOST],
      [FEAT.ambushSnap, TILE.SNAP_SPIKES],
      [FEAT.ambushHidden, TILE.HIDDEN_SPIKES],
      [FEAT.ambushVent, TILE.DEAD_VENT],
    ];
    check(
      ALBUM.length === AMBUSH_FEATS.length,
      `l'album ha una trappola per figurina (${ALBUM.length} contro ${AMBUSH_FEATS.length})`,
    );
    const missing = ALBUM.filter(
      ([, tile]) => !LEVELS.some((level) => level.rows.some((row) => row.includes(tile))),
    ).map(([feat]) => feat);
    check(
      missing.length === 0,
      `ogni figurina dell'album si può ancora prendere in un livello vero${missing.length ? ` (introvabili: ${missing.join(', ')})` : ''}`,
    );
  }

  // Il contrappasso: il Padrone ucciso da un masso staccato da lui.
  {
    const level = defineLevel({
      id: 'feat-boss',
      name: 'TEST',
      title: 'padrone',
      sky: 'cave',
      boss: true,
      spawn: { c: 1, r: 12 },
      segments: [segment({ rows: { 8: '     ?', 12: '     @', 13: FULL_GROUND, 14: FULL_GROUND } })],
    });

    /** Uccide il Padrone e dice quali imprese sono uscite dallo scontro. */
    const fight = (lastHitBySlam: boolean): string[] => {
      const feats: string[] = [];
      const world = new World(level, featAudio, {
        onTaunt: () => {},
        onWin: () => {},
        onFeat: (feat) => feats.push(feat),
      });
      const boss = world.boss;
      if (!boss) return feats;

      // Il gatto resta lontano: qui si prova chi colpisce chi, non chi scappa.
      const away = (): void => world.player.reset(1 * TILE_SIZE, 12 * TILE_SIZE);
      away();

      const hits = BOSS.hitsPerPhase * 2;
      for (let hit = 1; hit <= hits; hit++) {
        for (let guard = 0; guard < 400 && !boss.vulnerable; guard++) {
          away();
          world.update(idle);
        }
        if (hit < hits || !lastHitBySlam) {
          boss.takeHit(world);
          continue;
        }
        // L'ultima gemma la spegne il suo stesso soffitto: lo si rimette sotto
        // al mattone (nel frattempo ha camminato) e gli si fa dare la botta.
        boss.x = 5 * TILE_SIZE + (TILE_SIZE - BOSS.width) / 2;
        boss.state = 'stun';
        world.bossSlam(boss);
        for (let tick = 0; tick < 90 && !boss.isDead; tick++) {
          away();
          world.update(idle);
        }
      }
      check(boss.isDead, `il Padrone cade${lastHitBySlam ? ' sotto il suo stesso masso' : ''}`);
      return feats;
    };

    check(
      fight(true).includes(FEAT.ownRock),
      'ammazzarlo col masso che ha staccato lui vale il gatto PADRONE',
    );
    check(
      !fight(false).includes(FEAT.ownRock),
      'batterlo nel modo normale non lo regala: sarebbe la ricompensa di chiunque',
    );
  }

  // I gatti da impresa: chiusi finché l'impresa non è finita, tutta.
  {
    const featCats = CATS.filter((cat) => cat.feats);
    check(featCats.length > 0, `ci sono gatti che si sbloccano con un'impresa (sono ${featCats.length})`);

    // Ogni marca dev'essere chiesta da qualcuno.
    //
    // Il numero dei gatti da impresa qui era scritto a mano, e un numero
    // scritto a mano dice solo che qualcuno ha contato una volta. Questo
    // invece dice la cosa che conta davvero: un'impresa che non sblocca
    // niente è codice che gira, scrive nei progressi, viaggia fino al
    // database e non dà nessuna ricompensa — cioè un lavoro fatto per
    // sbaglio a metà, che è esattamente com'era arrivata qui `FEAT.gothic`.
    const wanted = new Set(featCats.flatMap((cat) => cat.feats ?? []));
    const unclaimed = Object.values(FEAT).filter((feat) => !wanted.has(feat));
    check(
      unclaimed.length === 0,
      `ogni impresa sblocca qualcosa${unclaimed.length ? ` (senza gatto: ${unclaimed.join(', ')})` : ''}`,
    );
    check(
      featCats.every((cat) => cat.yarn === 0 && !cat.needsEveryLevel),
      'un gatto da impresa non chiede anche i gomitoli: sarebbe un segreto dietro una collezione',
    );
    check(
      featCats.every((cat) => (cat.riddle ?? '').length > 0),
      'ogni gatto chiuso da un\'impresa ha il suo indovinello (CLAUDE.md, punto 7)',
    );
    check(
      new Set(Object.values(FEAT)).size === Object.values(FEAT).length,
      'due imprese diverse non hanno la stessa marca',
    );

    const nothing: UnlockState = { yarn: 0, everyLevelCleared: false, feats: new Set() };
    check(
      featCats.every((cat) => !isCatUnlocked(cat, nothing)),
      'senza imprese nessuno di quei gatti è disponibile',
    );
    check(
      featCats.every((cat) => catRequirement(cat, nothing).includes(cat.riddle ?? '')),
      'e la riga che si legge nel menu è l\'indovinello, non un conteggio di gomitoli',
    );

    const album = CATS.find((cat) => (cat.feats?.length ?? 0) > 1);
    if (album) {
      const half = album.feats?.slice(0, 3) ?? [];
      const partial: UnlockState = {
        yarn: 0,
        everyLevelCleared: false,
        feats: new Set<string>(half),
      };
      check(!isCatUnlocked(album, partial), 'un album a metà non sblocca niente');
      check(
        catRequirement(album, partial).includes(`${half.length} su ${album.feats?.length}`),
        'ma dice a che punto è: tre figurine su sette',
      );
      const complete: UnlockState = {
        yarn: 0,
        everyLevelCleared: false,
        feats: new Set<string>(album.feats ?? []),
      };
      check(isCatUnlocked(album, complete), 'con tutte le figurine il gatto arriva');
    }

    // Il codice: la sequenza vale solo intera, e un tasto sbagliato non
    // impedisce di ricominciare dal primo — altrimenti chi sbaglia una freccia
    // resta bloccato senza sapere perché.
    const listeners: Array<(e: unknown) => void> = [];
    const fakeWindow = {
      addEventListener: (_type: string, handler: (e: unknown) => void) => listeners.push(handler),
      removeEventListener: () => {},
    } as unknown as Window;

    let matches = 0;
    bindKeySequence(KONAMI, () => matches++, fakeWindow);
    const type = (...codes: string[]): void => {
      for (const code of codes) for (const listener of listeners) listener({ code });
    };

    type(...KONAMI.slice(0, -1));
    check(matches === 0, 'il codice quasi completo non sblocca niente');
    type('KeyZ');
    type(...KONAMI);
    check(matches === 1, 'il codice intero sblocca il gatto PLACCATO');
    type('ArrowUp', ...KONAMI);
    check(matches === 2, 'una freccia di troppo prima del codice non lo rompe');
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
    feats: [],
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
    feats: [FEAT.code],
  };

  const payload = toPayload(local) as {
    levels: Record<string, { ms: number }>;
    secrets: string[];
    feats: string[];
  };
  check(payload.levels['w1-1']?.ms === 10000, 'un record di 600 tick parte come 10000ms');
  check(payload.levels['w1-2'] === undefined, 'un livello mai finito non ha un tempo da mandare');
  check(payload.secrets.includes('w1-1'), 'i gomitoli trovati partono con tutto il resto');
  check(payload.feats.includes(FEAT.code), 'le imprese partono con tutto il resto');

  // Il server ha un tempo migliore su 1-1, un livello che qui non c'è, un
  // gomitolo e un'impresa fatti su un altro computer.
  const merged = applyRemote(
    {
      ok: true,
      nickname: 'gatto',
      total_deaths: 12,
      secrets: ['w2-3'],
      feats: [FEAT.still],
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
  check(
    merged.feats.includes(FEAT.code) && merged.feats.includes(FEAT.still),
    'le imprese si sommano: quella fatta di là e quella fatta di qua',
  );

  // Un server che non sa ancora niente di imprese non deve cancellare quelle
  // che il giocatore ha già: è esattamente lo stato in cui si trova un database
  // installato prima che esistessero.
  const older = applyRemote(
    { ok: true, nickname: 'gatto', total_deaths: 12, secrets: [], levels: {} },
    local,
  );
  check(
    older.feats.includes(FEAT.code),
    'un server che non conosce le imprese non ne fa perdere nessuna',
  );

  // Il formato delle marche è l'unica cosa che il server controlla davvero:
  // una maiuscola o un underscore e cb_sync la scarta in silenzio, cioè un
  // gatto che sparisce cambiando computer (è già successo con i gomitoli).
  const ACCEPTED_BY_CB_SYNC = /^[a-z-]{1,32}$/;
  const badFeats = Object.values(FEAT).filter((feat) => !ACCEPTED_BY_CB_SYNC.test(feat));
  check(
    badFeats.length === 0,
    `ogni impresa passa il filtro di cb_sync${badFeats.length ? ` (scartate: ${badFeats.join(', ')})` : ''}`,
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
