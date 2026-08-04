import { Audio } from '@core/audio';
import type { Input } from '@core/input';
import { TILE_SIZE } from '@game/config';
import { LEVELS } from '@game/levels';
import { SEGMENT_COLS, LEVEL_ROWS } from '@game/config';
import { TILE } from '@game/tiles';
import { World } from '@game/world';
import { NullRenderer } from './null-renderer';

/**
 * Smoke test headless.
 *
 * Non verifica che il gioco sia divertente — quello si vede solo giocando.
 * Verifica che non esploda: nessuna eccezione, nessuna coordinata NaN,
 * nessuna trasformazione lasciata aperta, morte e vittoria funzionanti.
 *
 * Gira in CI prima del deploy: se questo passa, il gioco almeno si avvia.
 */

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
  check(
    rows.some((r) => r.includes(TILE.CHECKPOINT)),
    `${level.name}: ha almeno un checkpoint`,
  );

  const spawnRow = rows[level.spawn.r];
  check(
    spawnRow?.[level.spawn.c] === TILE.EMPTY,
    `${level.name}: lo spawn non è dentro un muro`,
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
  const deathsBefore = world.deaths;
  world.kill();
  check(world.deaths === deathsBefore + 1, `${level.name}: kill() incrementa le morti`);
  check(world.state === 'dying', `${level.name}: kill() entra in stato "dying"`);
  check(taunts > 0, `${level.name}: la morte produce una battuta`);

  for (let tick = 0; tick < 120; tick++) world.update(fakeInput(tick));
  check(world.state === 'playing', `${level.name}: dopo la morte si torna a giocare`);

  // Vittoria: si teletrasporta il gatto sull'arrivo.
  const goal = findTile(level.rows, TILE.GOAL);
  check(goal !== null, `${level.name}: arrivo localizzato`);
  if (goal) {
    world.player.x = goal.c * TILE_SIZE;
    world.player.y = goal.r * TILE_SIZE;
    world.update(fakeInput(0));
    check(world.state === 'won', `${level.name}: toccare l'arrivo vince`);
    check(wins === 1, `${level.name}: onWin chiamato una sola volta`);
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
