import { PHYSICS, RULES, SURFACE, TILE_SIZE } from '@game/config';
import { LEVELS, type LevelDef } from '@game/levels';
import { TILE, beltDirection, isIcy, isSolid } from '@game/tiles';
import { TileMap } from '@engine/tilemap';
import { applyGravity, groundTiles, moveX, moveY, updateGrounded } from '@engine/physics';
import type { Body } from '@engine/types';

/**
 * Il risolutore: dice se un livello è attraversabile davvero.
 *
 * È nato da un bug vero. In 1-1 una moneta avvelenata era finita esattamente
 * dentro l'unica traiettoria utile per scavalcare una fossa di spuntoni, con
 * una lama a soffitto a chiudere l'alternativa: due trappole ragionevoli prese
 * una per una, un muro invalicabile prese insieme. Nessun controllo statico lo
 * avrebbe visto, perché la geometria era a posto — a non essere percorribile
 * era la *traiettoria*.
 *
 * Quindi qui non si controlla la mappa: si gioca. Una ricerca esplora gli
 * stati raggiungibili del gatto usando la fisica vera del gioco (le stesse
 * funzioni di engine/physics, le stesse costanti di config) e cerca una
 * sequenza di comandi che porti dallo spawn all'arrivo. Se non la trova, il
 * livello è rotto, e "rotto" non è un sinonimo di "difficile".
 *
 * Il modello è di proposito **pessimista**: tutto ciò che sparisce sotto le
 * zampe non è considerato un appoggio, e ogni trappola che può scattare è
 * considerata già scattata. Se un percorso esiste anche così, esiste di sicuro
 * per un giocatore che il livello lo conosce a memoria.
 */

/** Tile su cui il risolutore si fida di poggiare: quelli che non spariscono. */
const isStableSolid = (tile: string): boolean => {
  if (
    tile === TILE.FAKE_GROUND ||
    tile === TILE.GHOST ||
    tile === TILE.COLLAPSE ||
    tile === TILE.BRITTLE_ICE
  ) {
    return false;
  }
  return isSolid(tile);
};

/** Tile che uccidono, contando come letale tutto ciò che potrebbe esserlo. */
const KILLS = new Set<string>([
  TILE.SPIKES,
  TILE.CEILING_SPIKES,
  TILE.POP_SPIKES,
  TILE.SNAP_SPIKES,
  TILE.HIDDEN_SPIKES,
  TILE.FAKE_FLAG,
  TILE.LURE_COIN,
  TILE.FAKE_CHECKPOINT,
]);

interface SearchState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  coyote: number;
  buffer: number;
  /** Serve a sapere se il salto è "appena premuto" o tenuto da prima. */
  jumpHeld: boolean;
}

const PLAYER_W = 22;
const PLAYER_H = 28;

/** Le sei combinazioni di comandi possibili in un tick. */
const ACTIONS: ReadonlyArray<{ dir: number; jump: boolean }> = [
  { dir: 1, jump: false },
  { dir: 1, jump: true },
  { dir: 0, jump: false },
  { dir: 0, jump: true },
  { dir: -1, jump: false },
  { dir: -1, jump: true },
];

/**
 * Un tick di gioco, identico a quello di `Player.update`: stesso ordine delle
 * operazioni, stesse funzioni di collisione, stesse costanti. Se questo si
 * scosta dal gioco, il risolutore mente — quindi non va semplificato.
 */
function step(state: SearchState, map: TileMap, action: { dir: number; jump: boolean }): SearchState {
  const body: Body = {
    x: state.x,
    y: state.y,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: state.vx,
    vy: state.vy,
    onGround: state.onGround,
    hitWall: false,
  };

  let coyote = state.coyote;
  let buffer = state.buffer;

  // 0. superfici, campionate prima di muoversi — esattamente come fa
  // `Player.sampleSurface`. Se qui si campionasse dopo, il risolutore
  // troverebbe traiettorie che nel gioco non esistono.
  const inVent = overlapsTile(body.x, body.y, map, TILE.VENT);
  let onIce = false;
  let belt = 0;
  if (body.onGround) {
    for (const { tile } of groundTiles(body, map)) {
      if (isIcy(tile)) onIce = true;
      const direction = beltDirection(tile);
      if (direction !== 0) belt = direction;
    }
  }

  // 1. moto orizzontale
  const push = onIce ? SURFACE.iceAcceleration : PHYSICS.acceleration;
  if (action.dir < 0) body.vx -= push;
  if (action.dir > 0) body.vx += push;
  if (action.dir === 0) {
    body.vx *= body.onGround
      ? onIce
        ? SURFACE.iceFriction
        : PHYSICS.groundFriction
      : PHYSICS.airFriction;
  }
  body.vx = Math.max(-PHYSICS.maxSpeed, Math.min(PHYSICS.maxSpeed, body.vx));
  if (Math.abs(body.vx) < 0.05) body.vx = 0;

  moveX(body, map, isStableSolid);

  // 1b. il nastro trascina, e non è opzionale più di quanto lo sia la molla.
  if (belt !== 0) {
    const own = body.vx;
    body.vx = belt * SURFACE.beltSpeed;
    moveX(body, map, isStableSolid);
    body.vx = own;
  }

  // 2. salto (con jump buffer e coyote time, come nel gioco)
  const justPressed = action.jump && !state.jumpHeld;
  if (justPressed) buffer = PHYSICS.jumpBufferTicks;
  if (buffer > 0 && (body.onGround || coyote > 0)) {
    body.vy = -PHYSICS.jumpImpulse;
    body.onGround = false;
    coyote = 0;
    buffer = 0;
  }
  if (!action.jump && body.vy < 0) body.vy *= PHYSICS.jumpCut;

  // 2b. getto di vapore: solleva dopo il taglio del salto, come nel gioco.
  if (inVent) {
    body.vy = Math.min(body.vy, Math.max(body.vy - SURFACE.ventLift, -SURFACE.ventMaxRise));
  }

  // 3. gravità e moto verticale
  applyGravity(body, PHYSICS.gravity, PHYSICS.terminalVelocity);
  moveY(body, map, isStableSolid);
  updateGrounded(body, map, isStableSolid);

  // 4. la molla non è opzionale: se la tocchi ti lancia, punto. Ignorarla qui
  // farebbe trovare al risolutore percorsi che un giocatore non può seguire.
  if (body.vy >= 0 && overlapsTile(body.x, body.y, map, TILE.SPRING)) {
    body.vy = -PHYSICS.springImpulse;
    body.onGround = false;
  }

  // 5. timer
  if (body.onGround) coyote = PHYSICS.coyoteTicks;
  else if (coyote > 0) coyote--;
  if (buffer > 0) buffer--;

  return {
    x: body.x,
    y: body.y,
    vx: body.vx,
    vy: body.vy,
    onGround: body.onGround,
    coyote,
    buffer,
    jumpHeld: action.jump,
  };
}

/** La cassa del gatto tocca un tile di quel tipo? */
function overlapsTile(x: number, y: number, map: TileMap, tile: string): boolean {
  const c0 = Math.floor(x / TILE_SIZE);
  const c1 = Math.floor((x + PLAYER_W - 1) / TILE_SIZE);
  const r0 = Math.floor(y / TILE_SIZE);
  const r1 = Math.floor((y + PLAYER_H - 1) / TILE_SIZE);

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (map.get(c, r) === tile) return true;
    }
  }
  return false;
}

/** Il gatto è morto? Caduta fuori mappa o contatto con qualcosa di letale. */
function isDead(state: SearchState, map: TileMap): boolean {
  if (state.y > map.heightPx + RULES.fallDeathMargin) return true;

  const c0 = Math.floor(state.x / TILE_SIZE);
  const c1 = Math.floor((state.x + PLAYER_W - 1) / TILE_SIZE);
  const r0 = Math.floor(state.y / TILE_SIZE);
  const r1 = Math.floor((state.y + PLAYER_H - 1) / TILE_SIZE);

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (KILLS.has(map.get(c, r))) return true;
    }
  }
  return false;
}

function touchesGoal(state: SearchState, map: TileMap): boolean {
  const c0 = Math.floor(state.x / TILE_SIZE);
  const c1 = Math.floor((state.x + PLAYER_W - 1) / TILE_SIZE);
  const r0 = Math.floor(state.y / TILE_SIZE);
  const r1 = Math.floor((state.y + PLAYER_H - 1) / TILE_SIZE);

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (map.get(c, r) === TILE.GOAL) return true;
    }
  }
  return false;
}

/**
 * Chiave di deduplicazione, volutamente grossolana: posizione al quadretto di
 * quattro pixel, velocità al pixel intero.
 *
 * La simulazione resta esatta — si arrotonda solo per decidere se due stati
 * "si somigliano abbastanza" da non esplorarli entrambi. Con una chiave fine
 * la ricerca produceva decine di migliaia di stati per colonna, tutti diversi
 * per un quarto di pixel, e finiva il budget prima del secondo tubo. Con
 * questa granularità un percorso trovato resta un percorso vero, e si arriva
 * in fondo al livello in pochi secondi.
 */
const keyOf = (s: SearchState): string =>
  `${s.x >> 2}|${s.y >> 2}|${Math.round(s.vx)}|${Math.round(s.vy)}|${s.jumpHeld ? 1 : 0}`;

export interface SolveResult {
  solved: boolean;
  /** Colonna più avanzata raggiunta: dice *dove* si è bloccato. */
  furthestColumn: number;
  statesExplored: boolean | number;
}

/**
 * Ricerca in ampiezza guidata: si espandono prima gli stati più avanti nel
 * livello. Non serve il percorso ottimo, serve sapere se ne esiste uno.
 */
export function solve(level: LevelDef, budget = 400_000): SolveResult {
  const map = new TileMap(level.rows, TILE_SIZE);
  const start: SearchState = {
    x: level.spawn.c * TILE_SIZE + 5,
    y: level.spawn.r * TILE_SIZE,
    vx: 0,
    vy: 0,
    onGround: false,
    coyote: 0,
    buffer: 0,
    jumpHeld: false,
  };

  // Gli stati si tengono in code separate per colonna: espandere sempre la
  // colonna più avanzata è una ricerca greedy che trova una via in fretta,
  // senza rinunciare a tornare indietro se davanti è tutto bloccato.
  const byColumn = new Map<number, SearchState[]>();
  const seen = new Set<string>();
  let furthest = 0;
  let explored = 0;

  const push = (state: SearchState): void => {
    const key = keyOf({ ...state, x: Math.round(state.x), y: Math.round(state.y) });
    if (seen.has(key)) return;
    seen.add(key);
    const column = Math.floor(state.x / TILE_SIZE);
    if (column > furthest) furthest = column;
    const bucket = byColumn.get(column);
    if (bucket) bucket.push(state);
    else byColumn.set(column, [state]);
  };

  push(start);

  while (explored < budget) {
    // Colonna più avanzata con stati ancora da espandere.
    let column = -1;
    for (const [c, bucket] of byColumn) {
      if (bucket.length > 0 && c > column) column = c;
    }
    if (column < 0) break;

    const bucket = byColumn.get(column);
    const state = bucket?.pop();
    if (!state) continue;
    explored++;

    for (const action of ACTIONS) {
      const next = step(state, map, action);
      if (isDead(next, map)) continue;
      if (touchesGoal(next, map)) {
        return { solved: true, furthestColumn: map.cols - 1, statesExplored: explored };
      }
      push(next);
    }
  }

  return { solved: false, furthestColumn: furthest, statesExplored: explored };
}

/** Esecuzione diretta: `node solver.mjs` stampa un referto per ogni livello. */
export function report(): number {
  let broken = 0;
  for (const level of LEVELS) {
    const started = Date.now();
    const result = solve(level);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    if (result.solved) {
      console.log(`  ok   ${level.name}: attraversabile (${result.statesExplored} stati, ${seconds}s)`);
    } else {
      broken++;
      console.error(
        `  FAIL ${level.name}: BLOCCATO alla colonna ${result.furthestColumn} ` +
          `(segmento ${Math.floor(result.furthestColumn / 20)}, colonna ${result.furthestColumn % 20} del segmento) ` +
          `— ${result.statesExplored} stati in ${seconds}s`,
      );
    }
  }
  return broken;
}
