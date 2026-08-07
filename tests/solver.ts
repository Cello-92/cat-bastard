import { PHYSICS, RULES, SURFACE, TILE_SIZE } from '@game/config';
import { LEVELS, type LevelDef } from '@game/levels';
import { TILE, beltDirection, isIcy, isSolid, windDirection } from '@game/tiles';
import { TileMap } from '@engine/tilemap';
import { applyGravity, groundTiles, moveX, moveY, updateGrounded, type Down } from '@engine/physics';
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

/**
 * Tile su cui il risolutore si fida di poggiare: quelli che non spariscono.
 *
 * Nell'arena del boss ce ne sono due che meritano una parola. Il mattone del
 * soffitto sparisce appena ci sali, quindi vale come tutti gli altri appoggi
 * che si sfilano: non conta. Il portone invece è il caso opposto — è solido
 * per tutto il combattimento e si apre quando il Padrone cade — e qui viene
 * considerato *aperto*, perché quello che questo controllo deve dimostrare è
 * che l'arena sia attraversabile una volta vinta. Che lo scontro si possa
 * vincere lo verificano i controlli sul combattimento in `smoke.ts`: il
 * risolutore non sa niente di entità e non è il posto giusto per chiederglielo.
 */
const isStableSolid = (tile: string): boolean => {
  if (
    tile === TILE.FAKE_GROUND ||
    tile === TILE.GHOST ||
    tile === TILE.COLLAPSE ||
    tile === TILE.BRITTLE_ICE ||
    tile === TILE.BOSS_BRICK ||
    tile === TILE.BOSS_GATE
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
  TILE.TRAP_SPRING,
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
  /**
   * Lo stato è dentro le sabbie mobili?
   *
   * Non serve alla simulazione — `step` se lo ricalcola — serve alla **chiave
   * di deduplicazione**, e il motivo sta scritto per esteso su `keyOf`.
   */
  inSand: boolean;
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
  // Mondo 3: risucchio, sabbie mobili e correnti d'aria. La corrente morta non
  // compare, e non deve: nel gioco non spinge, quindi qui non esiste proprio.
  const inDowndraft = overlapsTile(body.x, body.y, map, TILE.DOWNDRAFT);
  const inSand = overlapsTile(body.x, body.y, map, TILE.QUICKSAND);
  const wind = windAt(body.x, body.y, map);
  // Mondo 4: il campo rovescio. È una funzione della posizione e basta —
  // nessuno stato in più nella ricerca — ma decide tutto quello che viene
  // dopo, quindi si legge per prima, come fa `Player.sampleSurface`. Il campo
  // spento non compare, e non deve: nel gioco non capovolge niente.
  const down: Down = overlapsTile(body.x, body.y, map, TILE.REVERSE) ? -1 : 1;
  let onIce = false;
  let belt = 0;
  if (body.onGround) {
    for (const { tile } of groundTiles(body, map, down)) {
      if (isIcy(tile)) onIce = true;
      const direction = beltDirection(tile);
      if (direction !== 0) belt = direction;
    }
  }

  // 1. moto orizzontale
  const push = inSand
    ? SURFACE.sandAcceleration
    : onIce
      ? SURFACE.iceAcceleration
      : PHYSICS.acceleration;
  if (action.dir < 0) body.vx -= push;
  if (action.dir > 0) body.vx += push;
  if (action.dir === 0) {
    body.vx *= inSand
      ? SURFACE.sandFriction
      : body.onGround
        ? onIce
          ? SURFACE.iceFriction
          : PHYSICS.groundFriction
        : PHYSICS.airFriction;
  }
  const cap = inSand ? SURFACE.sandMaxSpeed : PHYSICS.maxSpeed;
  body.vx = Math.max(-cap, Math.min(cap, body.vx));
  if (Math.abs(body.vx) < 0.05) body.vx = 0;

  moveX(body, map, isStableSolid);

  // 1b. il nastro trascina, e non è opzionale più di quanto lo sia la molla.
  if (belt !== 0) {
    const own = body.vx;
    body.vx = belt * SURFACE.beltSpeed;
    moveX(body, map, isStableSolid);
    body.vx = own;
  }

  // 1c. la corrente d'aria: come il nastro, ma solo per chi non tocca terra.
  if (wind !== 0 && !body.onGround) {
    const own = body.vx;
    body.vx = wind * SURFACE.windSpeed;
    moveX(body, map, isStableSolid);
    body.vx = own;
  }

  // 2. salto (con jump buffer e coyote time, come nel gioco). Dentro la sabbia
  // si può bracciare anche senza appoggio: è l'unico modo di uscire da una
  // pozza, quindi ignorarlo qui vorrebbe dire dichiarare impossibile un
  // livello che si gioca benissimo.
  const justPressed = action.jump && !state.jumpHeld;
  if (justPressed) buffer = PHYSICS.jumpBufferTicks;
  if (buffer > 0 && (body.onGround || coyote > 0 || inSand)) {
    body.vy = -down * (inSand ? SURFACE.sandStroke : PHYSICS.jumpImpulse);
    body.onGround = false;
    coyote = 0;
    buffer = 0;
  }
  if (!action.jump && body.vy * down < 0) body.vy *= PHYSICS.jumpCut;

  // 2b. getto di vapore: solleva dopo il taglio del salto, come nel gioco.
  if (inVent) {
    body.vy = Math.min(body.vy, Math.max(body.vy - SURFACE.ventLift, -SURFACE.ventMaxRise));
  }

  // 2c. risucchio: il getto al contrario, e nello stesso punto della sequenza.
  if (inDowndraft) {
    body.vy = Math.max(body.vy, Math.min(body.vy + SURFACE.downdraftPull, SURFACE.downdraftMaxFall));
  }

  // 3. gravità e moto verticale
  applyGravity(body, PHYSICS.gravity, PHYSICS.terminalVelocity, down);
  // 3b. la sabbia limita la velocità DOPO la gravità: è densità, non spinta.
  if (inSand) {
    body.vy = Math.max(-SURFACE.sandRise, Math.min(SURFACE.sandSink, body.vy));
  }
  moveY(body, map, isStableSolid);
  updateGrounded(body, map, isStableSolid, down);

  // 4. la molla non è opzionale: se la tocchi ti lancia, punto. Ignorarla qui
  // farebbe trovare al risolutore percorsi che un giocatore non può seguire.
  if (body.vy * down >= 0 && overlapsTile(body.x, body.y, map, TILE.SPRING)) {
    body.vy = -down * PHYSICS.springImpulse;
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
    inSand: overlapsTile(body.x, body.y, map, TILE.QUICKSAND),
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

/**
 * Il verso della corrente d'aria che tocca il gatto, come in `sampleSurface`:
 * l'ultima cella letta vince, e le celle si leggono nello stesso ordine.
 */
function windAt(x: number, y: number, map: TileMap): number {
  const c0 = Math.floor(x / TILE_SIZE);
  const c1 = Math.floor((x + PLAYER_W - 1) / TILE_SIZE);
  const r0 = Math.floor(y / TILE_SIZE);
  const r1 = Math.floor((y + PLAYER_H - 1) / TILE_SIZE);

  let direction = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const gust = windDirection(map.get(c, r));
      if (gust !== 0) direction = gust;
    }
  }
  return direction;
}

/** Il gatto è morto? Caduta fuori mappa o contatto con qualcosa di letale. */
function isDead(state: SearchState, map: TileMap): boolean {
  if (state.y > map.heightPx + RULES.fallDeathMargin) return true;
  // Dal quarto mondo si cade anche **in su**, e il risolutore deve saperlo o
  // considererebbe percorribile una traiettoria che finisce fuori dal mondo.
  if (state.y + PLAYER_H < -RULES.fallDeathMargin) return true;

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
 * quattro pixel, velocità al pixel intero — **tranne dentro le sabbie mobili**,
 * dove è esatta.
 *
 * La simulazione resta esatta — si arrotonda solo per decidere se due stati
 * "si somigliano abbastanza" da non esplorarli entrambi. Con una chiave fine
 * la ricerca produceva decine di migliaia di stati per colonna, tutti diversi
 * per un quarto di pixel, e finiva il budget prima del secondo tubo. Con
 * questa granularità un percorso trovato resta un percorso vero, e si arriva
 * in fondo al livello in pochi secondi.
 *
 * L'eccezione della sabbia è costata un pomeriggio, e vale la pena scriverla.
 * In una pozza si affonda a poco più di un pixel al tick, quindi due traiettorie
 * che nello stesso quadretto di quattro pixel differiscono di due pixel
 * orizzontali non sono "quasi uguali": una scavalca la pozza e l'altra ci
 * finisce dentro. Con la chiave grossolana vinceva sempre la prima — l'arco di
 * salto che attraversa la cella e prosegue — e la discesa non veniva mai
 * esplorata. Il risultato era un risolutore che dichiarava **irraggiungibile**
 * una camera sotto la sabbia in cui il gioco entra benissimo: un falso
 * negativo, cioè un livello giocabile bocciato dai test.
 *
 * Dentro la sabbia gli stati sono pochi e lenti (le velocità sono limitate da
 * `sandSink`, `sandRise` e `sandMaxSpeed`), quindi la chiave esatta lì costa
 * poco e mente zero.
 */
const keyOf = (s: SearchState): string =>
  s.inSand
    ? `s${s.x}|${s.y}|${(s.vx * 2) | 0}|${(s.vy * 2) | 0}|${s.jumpHeld ? 1 : 0}`
    : `${s.x >> 2}|${s.y >> 2}|${Math.round(s.vx)}|${Math.round(s.vy)}|${s.jumpHeld ? 1 : 0}`;

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
/**
 * Il budget deve essere abbondante, non stretto.
 *
 * Un livello denso costa qualche centinaio di migliaia di stati (1-5 ne
 * chiede 254.000), e con il budget vecchio bastava aggiungere due trappole
 * perché il risolutore si fermasse *per esaurimento* e dichiarasse impossibile
 * un livello che si attraversa benissimo. Un referto sbagliato è peggio di un
 * referto lento: qui si paga qualche secondo in CI per averlo giusto.
 *
 * I livelli verticali del mondo 3 hanno alzato l'asticella: 3-7, che si
 * attraversa dentro le colonne d'aria, chiede 1.075.000 stati per *trovare* la
 * strada — cioè stava a un ritocco di distanza dal vecchio tetto. Il margine
 * costa poco davvero: un livello risolvibile smette di cercare appena trova, e
 * il budget pieno lo paga solo un livello rotto, che è esattamente il caso in
 * cui si vuole essere sicuri prima di gridare.
 */
export function solve(level: LevelDef, budget = 2_500_000): SolveResult {
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
    inSand: false,
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
