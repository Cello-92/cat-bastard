import { wave } from '@core/math';
import type { Renderer, Stop } from '@engine/render/renderer';
import { TILE_SIZE } from '../config';
import { MATERIAL, PALETTE, alpha, glare, mix, shade, type Material } from '../theme';
import { TILE } from '../tiles';

/**
 * Disegno dei tile.
 *
 * Ogni superficie segue lo stesso modello di illuminazione, ed è questo che
 * tiene insieme lo stile: un gradiente che descrive come il materiale gira
 * rispetto alla luce (che viene sempre dall'alto a sinistra), un bordo
 * illuminato dove la faccia è esposta al cielo, occlusione ambientale dove
 * due superfici si incontrano, e un riflesso speculare tanto più stretto
 * quanto più il materiale è lucido.
 *
 * Il dettaglio (granuli, venature, crepe, sbeccature) è **deterministico**,
 * derivato da riga e colonna: il mondo non sfarfalla mai tra un frame e
 * l'altro, e la stessa cella ha sempre lo stesso aspetto in ogni partita.
 */

const T = TILE_SIZE;

/** Facce della cella libere: nessun solido attaccato da quel lato. */
export interface OpenSides {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface TileDrawContext {
  tick: number;
  col: number;
  row: number;
  /**
   * Per il blocco invisibile e per gli spuntoni invisibili: già scoperti?
   * Finché è false non si disegna niente — non c'è proprio nulla da vedere.
   */
  revealed: boolean;
  /** Per la piattaforma: sta per sbriciolarsi? */
  crumbling: boolean;
  /** Per il checkpoint: già preso? */
  checkpointActive: boolean;
  /**
   * Per il cero di 2-11: è acceso?
   *
   * Un cero spento non sparisce — resta lì, storto e nero — perché è ancora
   * l'incudine dello scontro e sapere *dove* si riaccenderà è metà del
   * combattimento.
   */
  candleLit: boolean;
  /** Per le bandiere: c'è un'altra cella di bandiera sopra questa? */
  hasFlagAbove: boolean;
  /** Per gli spuntoni a scatto: quanto sono usciti, in [0,1]. */
  extension: number;
  /** Quali lati della cella danno sul vuoto: decide luci, erba e occlusione. */
  open: OpenSides;
}

const ALL_OPEN: OpenSides = { up: true, down: true, left: true, right: true };

/** Rumore deterministico per cella: stessa cella, stessa texture, sempre. */
const cellNoise = (c: number, r: number, salt = 0): number => {
  const x = Math.sin(c * 12.9898 + r * 78.233 + salt * 37.719) * 43758.5453;
  return x - Math.floor(x);
};

export function drawTile(r: Renderer, tile: string, x: number, y: number, ctx: TileDrawContext): void {
  switch (tile) {
    case TILE.GROUND:
      drawGround(r, x, y, ctx);
      break;
    case TILE.SNOW:
      drawGround(r, x, y, ctx, true);
      break;
    case TILE.ROCK:
      drawRock(r, x, y, ctx);
      break;
    case TILE.PIPE:
      drawPipe(r, x, y, ctx);
      break;
    case TILE.PRIZE:
    case TILE.HONEST:
      drawPrizeBlock(r, x, y, ctx);
      break;
    case TILE.USED:
      drawUsedBlock(r, x, y);
      break;
    case TILE.TRAP_BRICK:
      drawBrick(r, x, y, ctx);
      break;
    case TILE.CRUMBLE:
      drawCrumble(r, x, y, ctx);
      break;
    case TILE.BOSS_BRICK:
      drawBossBrick(r, x, y, ctx);
      break;
    case TILE.BOSS_GATE:
      drawBossGate(r, x, y, ctx);
      break;
    case TILE.FAKE_GROUND:
    case TILE.GHOST:
      // Identici al terreno vero: è tutto il punto della trappola. Nessun
      // segno, nessuna sfumatura diversa — chi disegnasse un indizio qui
      // starebbe disinnescando la trappola.
      drawGround(r, x, y, ctx);
      break;
    case TILE.COLLAPSE:
      // Indistinguibile dalla roccia del soffitto.
      drawRock(r, x, y, ctx);
      break;
    case TILE.SNAP_SPIKES:
      // A riposo non c'è niente: né feritoia, né piastra. Solo terreno.
      if (ctx.extension > 0) drawSpikes(r, x, y, ctx, ctx.extension, false);
      break;
    case TILE.HIDDEN_SPIKES:
      // Esistono solo dopo che ti hanno ucciso una volta.
      if (ctx.revealed) drawSpikes(r, x, y, ctx, 1, false);
      break;
    case TILE.INVISIBLE:
      if (ctx.revealed) drawRevealedBlock(r, x, y, ctx.tick);
      break;
    case TILE.SPIKES:
      drawSpikes(r, x, y, ctx, 1, false);
      break;
    case TILE.CEILING_SPIKES:
      drawSpikes(r, x, y, ctx, 1, true);
      break;
    case TILE.POP_SPIKES:
      if (ctx.extension > 0) drawSpikes(r, x, y, ctx, ctx.extension, false);
      drawSpikeSocket(r, x, y, ctx);
      break;
    case TILE.SPRING:
    case TILE.TRAP_SPRING:
      // Stessa molla. Stessa piastra, stesse spire, stesso piattello rosso:
      // una lancia, l'altra si chiude. Disegnarle diverse sarebbe disinnescare
      // la trappola, esattamente come per la moneta e la lanterna.
      drawSpring(r, x, y, ctx);
      break;
    case TILE.ICE:
      drawIce(r, x, y, ctx, false);
      break;
    case TILE.BRITTLE_ICE:
      // Identico al ghiaccio buono finché non ci sali sopra: solo allora si
      // crepa. Il preavviso c'è, ma dura dieci tick.
      drawIce(r, x, y, ctx, ctx.crumbling);
      break;
    case TILE.STEEL:
      drawSteel(r, x, y, ctx);
      break;
    case TILE.FAKE_WALL:
      // Finché non ci sei passato attraverso è una parete e basta: disegnarla
      // anche solo un filo diversa vorrebbe dire regalare il segreto a chi
      // guarda lo schermo da fermo. Dopo, invece, resta marcata.
      drawSteel(r, x, y, ctx);
      if (ctx.revealed) drawOpenSeam(r, x, y, ctx);
      break;
    case TILE.BELT_RIGHT:
      drawBelt(r, x, y, ctx, 1);
      break;
    case TILE.BELT_LEFT:
      drawBelt(r, x, y, ctx, -1);
      break;
    case TILE.VENT:
    case TILE.DEAD_VENT:
      // Stesso vapore, stesso rumore, stessa griglia. Uno solleva, l'altro no.
      drawVent(r, x, y, ctx);
      break;
    case TILE.SAND:
      drawSand(r, x, y, ctx);
      break;
    case TILE.SANDSTONE:
      drawSandstone(r, x, y, ctx);
      break;
    case TILE.FAKE_STONE:
      // Arenaria identica alle altre: se si vedesse, il tempio avrebbe le
      // porte segnate. Dopo esserci passati attraverso, resta marcata.
      drawSandstone(r, x, y, ctx);
      if (ctx.revealed) drawOpenSeam(r, x, y, ctx);
      break;
    case TILE.PLATE:
      drawPlate(r, x, y, ctx);
      break;
    case TILE.GLASS:
      drawGlass(r, x, y, ctx);
      break;
    case TILE.BASALT:
      drawBasalt(r, x, y, ctx);
      break;
    case TILE.FAKE_BASALT:
      // Basalto identico a tutti gli altri. Nel quarto mondo metà delle stanze
      // si attraversano capovolte: una parete che si nota si nota anche a
      // testa in giù, e il segreto sarebbe regalato due volte.
      drawBasalt(r, x, y, ctx);
      if (ctx.revealed) drawOpenSeam(r, x, y, ctx);
      break;
    case TILE.REVERSE:
    case TILE.DEAD_REVERSE:
      // Stesso luccichio, stesso ronzio, stessa polvere che sale. Uno
      // capovolge la gravità, l'altro no, e non c'è modo di distinguerli
      // prima — esattamente come per il getto spento e la corrente morta.
      drawReverseField(r, x, y, ctx);
      break;
    case TILE.WIND_RIGHT:
      drawWind(r, x, y, ctx, 1);
      break;
    case TILE.WIND_LEFT:
      drawWind(r, x, y, ctx, -1);
      break;
    case TILE.DEAD_WIND:
    case TILE.DEAD_WIND_LEFT:
      // Stessa sabbia, stesso fischio, stesso disegno delle correnti vere: il
      // verso è quello dichiarato dal carattere, perché è l'unica cosa che il
      // giocatore userà per decidere quanto saltare. Solo che non spinge.
      drawWind(r, x, y, ctx, tile === TILE.DEAD_WIND ? 1 : -1);
      break;
    case TILE.DOWNDRAFT:
      drawDowndraft(r, x, y, ctx);
      break;
    case TILE.QUICKSAND:
      drawQuicksand(r, x, y, ctx);
      break;
    case TILE.YARN:
      drawYarn(r, x, y, ctx);
      break;
    case TILE.COIN:
    case TILE.LURE_COIN:
      // Stessa moneta. Stesso oro, stesso alone, stessa rotazione.
      drawCoin(r, x, y, ctx);
      break;
    case TILE.CHECKPOINT:
    case TILE.FAKE_CHECKPOINT:
      // Stessa lanterna. L'unica differenza è che questa non si accende mai,
      // ma per scoprirlo bisogna toccarla, e toccarla è la trappola.
      drawCheckpoint(r, x, y, ctx);
      break;
    case TILE.CANDLE:
      drawCandle(r, x, y, ctx);
      break;
    case TILE.FAKE_FLAG:
      drawFlag(r, x, y, ctx, false);
      break;
    case TILE.GOAL:
      drawFlag(r, x, y, ctx, true);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------- comuni
/**
 * Gradiente verticale di un materiale: faccia superiore in luce, ventre in
 * ombra. È il modello di illuminazione di base di ogni superficie del gioco.
 */
const bodyStops = (m: Material): readonly Stop[] => [
  { at: 0, color: m.light },
  { at: 0.22, color: m.base },
  { at: 0.78, color: mix(m.base, m.dark, 0.55) },
  { at: 1, color: m.dark },
];

/**
 * Occlusione ambientale e bordi illuminati.
 *
 * Dove due blocchi si toccano la luce del cielo non arriva, e la fessura si
 * scurisce; dove invece la faccia è esposta prende un filo di luce. Sono
 * poche righe, ma è ciò che trasforma una griglia di quadrati in una parete.
 */
function occlude(r: Renderer, x: number, y: number, m: Material, open: OpenSides): void {
  // Regola: le facce *unite* non si vedono affatto. Una parete di terra è una
  // massa continua, non una griglia di mattoni — l'unica eccezione è il velo
  // scuro sotto la superficie, dove la luce del cielo non arriva più.
  if (!open.up) {
    r.gradientRect(x, y, T, 10, [
      { at: 0, color: alpha(m.deep, 0.3) },
      { at: 1, color: alpha(m.deep, 0) },
    ]);
  }

  // Sono i bordi *esposti* a raccontare la forma: luce sopra e a sinistra,
  // ombra sotto e a destra, come per ogni altra superficie del gioco.
  if (open.up) r.rect(x, y, T, 1, glare(0.16));
  if (open.left) {
    r.gradientRect(x, y, 4, T, [
      { at: 0, color: glare(0.12) },
      { at: 1, color: glare(0) },
    ], true);
  }
  if (open.down) {
    r.gradientRect(x, y + T - 5, T, 5, [
      { at: 0, color: shade(0) },
      { at: 1, color: shade(0.4) },
    ]);
  }
  if (open.right) {
    r.gradientRect(x + T - 5, y, 5, T, [
      { at: 0, color: shade(0) },
      { at: 1, color: shade(0.3) },
    ], true);
  }
}

/** Granuli e inclusioni: la stessa cella li ha sempre negli stessi punti. */
function speckle(
  r: Renderer,
  x: number,
  y: number,
  ctx: TileDrawContext,
  count: number,
  m: Material,
  from = 0,
): void {
  for (let i = 0; i < count; i++) {
    const nx = cellNoise(ctx.col, ctx.row, i * 2 + 1);
    const ny = cellNoise(ctx.col, ctx.row, i * 2 + 60);
    // Pochi sassi grandi e molti piccoli: una distribuzione uniforme si legge
    // subito come artificiale.
    const grade = cellNoise(ctx.col, ctx.row, i + 120);
    const size = 0.9 + grade * grade * 2.6;
    const px = x + 3 + nx * (T - 8);
    const py = y + from + ny * (T - from - 6);

    // Ogni granulo è un sassolino: luce sopra, ombra sotto.
    r.ellipse(px, py + 0.7, size, size * 0.78, alpha(m.deep, 0.3));
    r.ellipse(px, py, size, size * 0.78, alpha(m.base, 0.6));
    r.ellipse(px - size * 0.3, py - size * 0.32, size * 0.42, size * 0.3, alpha(m.light, 0.45));
  }
}

// ---------------------------------------------------------------- terreno
/**
 * Terra: sezione di suolo con strati, sassi inclusi e — se la faccia superiore
 * è esposta — il manto erboso con i suoi ciuffi e le radici che scendono.
 */
function drawGround(r: Renderer, x: number, y: number, ctx: TileDrawContext, snowy = false): void {
  const soil = MATERIAL.soil;

  // Il gradiente "chiaro sopra, scuro sotto" vale per una superficie esposta.
  // Una cella sepolta che lo ripetesse creerebbe una banda chiara a ogni riga,
  // e la parete sembrerebbe fatta di strisce: sotto terra si scende e basta.
  if (ctx.open.up) {
    r.gradientRect(x, y, T, T, bodyStops(soil));
  } else {
    r.gradientRect(x, y, T, T, [
      { at: 0, color: mix(soil.base, soil.dark, 0.45) },
      { at: 1, color: mix(soil.base, soil.dark, 0.72) },
    ]);
  }

  // Strati sedimentari: bande orizzontali appena più chiare o più scure.
  r.push();
  r.setAlpha(0.16);
  for (let i = 0; i < 3; i++) {
    const ly = y + 6 + cellNoise(ctx.col, ctx.row, i + 200) * (T - 12);
    const w = T * (0.5 + cellNoise(ctx.col, ctx.row, i + 205) * 0.5);
    const lx = x + cellNoise(ctx.col, ctx.row, i + 215) * (T - w);
    r.gradientRect(lx, ly, w, 2, [
      { at: 0, color: i % 2 ? alpha(soil.dark, 0.8) : alpha(soil.light, 0.5) },
      { at: 1, color: alpha(soil.dark, 0) },
    ]);
  }
  r.pop();

  speckle(r, x, y, ctx, 3, MATERIAL.rock, ctx.open.up ? 12 : 4);
  occlude(r, x, y, soil, ctx.open);

  if (!ctx.open.up) return;
  if (snowy) drawSnowMantle(r, x, y, ctx);
  else drawGrassMantle(r, x, y, ctx);
}

/**
 * Manto nevoso: la stessa struttura del manto erboso — un bordo irregolare che
 * scende nella terra, luce sopra, ombra al contatto — ma la neve non ha fili:
 * ha cumuli. Il profilo superiore esce dalla cella verso l'alto, così il
 * terreno innevato sembra *coperto* e non semplicemente ridipinto di bianco.
 */
function drawSnowMantle(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const snow = MATERIAL.snow;
  const depth = 10;

  // Cumulo: bordo superiore ondulato che sporge sopra la linea della cella.
  const crest: number[] = [x - 1, y + depth + 2];
  for (let i = 0; i <= 4; i++) {
    const px = x + (i / 4) * T;
    const py = y - 3 + cellNoise(ctx.col, ctx.row, i + 350) * 5;
    crest.push(px, py);
  }
  crest.push(x + T + 1, y + depth + 2);
  r.blob(crest, snow.base);

  // Luce sulla sommità, ombra azzurra dove la neve incontra la terra.
  r.gradientRect(x, y - 2, T, depth + 4, [
    { at: 0, color: alpha(snow.light, 0.95) },
    { at: 0.55, color: alpha(snow.base, 0.55) },
    { at: 1, color: alpha(snow.dark, 0.45) },
  ]);

  // Croste di ghiaccio dove la neve si è sciolta e riformata.
  r.push();
  r.setAlpha(0.4);
  for (let i = 0; i < 3; i++) {
    const cx = x + 3 + cellNoise(ctx.col, ctx.row, i + 360) * (T - 6);
    r.ellipse(cx, y + depth + 1, 3 + cellNoise(ctx.col, ctx.row, i + 370) * 3, 1.4, MATERIAL.ice.base);
  }
  r.pop();

  // Cristalli: pochi punti che accendono la superficie, sempre gli stessi.
  r.push();
  r.setBlend('add');
  r.setAlpha(0.5 + wave(ctx.tick + ctx.col * 13, 70) * 0.4);
  for (let i = 0; i < 2; i++) {
    const sx = x + 4 + cellNoise(ctx.col, ctx.row, i + 380) * (T - 8);
    const sy = y - 1 + cellNoise(ctx.col, ctx.row, i + 390) * 4;
    r.ellipse(sx, sy, 0.9, 0.9, glare(0.9));
  }
  r.pop();
}

/** Manto erboso sulla faccia esposta al cielo, con radici e fili singoli. */
function drawGrassMantle(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const grass = MATERIAL.grass;
  const depth = 8;

  // Il manto non ha un bordo dritto: scende nella terra a lingue irregolari.
  const points: number[] = [x - 1, y - 1];
  for (let i = 0; i <= 4; i++) {
    const px = x + (i / 4) * T;
    const py = y + depth + cellNoise(ctx.col, ctx.row, i + 300) * 6;
    points.push(px, py);
  }
  points.push(x + T + 1, y - 1);
  r.polygon(points, grass.base);

  // Luce sulla superficie e ombra nella zona di contatto con la terra.
  r.gradientRect(x, y, T, depth, [
    { at: 0, color: alpha(grass.light, 0.95) },
    { at: 0.55, color: alpha(grass.base, 0.5) },
    { at: 1, color: alpha(grass.dark, 0.35) },
  ]);

  // Radici che scendono nel suolo.
  r.push();
  r.setAlpha(0.35);
  for (let i = 0; i < 3; i++) {
    const rx = x + 4 + cellNoise(ctx.col, ctx.row, i + 320) * (T - 8);
    const len = 3 + cellNoise(ctx.col, ctx.row, i + 330) * 6;
    r.line([rx, y + depth, rx + (cellNoise(ctx.col, ctx.row, i + 340) - 0.5) * 4, y + depth + len], 1, grass.dark);
  }
  r.pop();

  // Fili d'erba: fitti, di altezze diverse, piegati tutti dallo stesso vento.
  // I più lontani (dietro) sono più scuri e più bassi: dà spessore al manto.
  for (let i = 0; i < 11; i++) {
    const n = cellNoise(ctx.col, ctx.row, i + 11);
    if (n < 0.18) continue;
    const back = i % 3 === 0;
    const bx = x + 1 + i * 3 + n * 2.4;
    const height = (back ? 2.5 : 4) + n * (back ? 3 : 6);
    const bend = (n - 0.45) * 5;
    const tone = back ? mix(grass.dark, grass.base, 0.5) : grass.base;
    r.line([bx, y + 2, bx + bend * 0.4, y - height * 0.6, bx + bend, y - height], back ? 1.1 : 1.5, tone);
    if (!back) {
      r.push();
      r.setAlpha(0.7);
      r.line([bx + bend * 0.6, y - height * 0.55, bx + bend, y - height], 1, grass.light);
      r.pop();
    }
  }
}

/** Roccia nuda: come la terra, ma minerale — niente erba, spacchi netti. */
function drawRock(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const rock = MATERIAL.rock;
  r.gradientRect(x, y, T, T, ctx.open.up
    ? bodyStops(rock)
    : [
        { at: 0, color: mix(rock.base, rock.dark, 0.35) },
        { at: 1, color: mix(rock.base, rock.dark, 0.7) },
      ]);

  // Facce di frattura: i vertici vengono tutti dal rumore della cella, quindi
  // ogni masso è spaccato in modo suo e una parete non si ripete mai uguale.
  const a = cellNoise(ctx.col, ctx.row, 5);
  const b = cellNoise(ctx.col, ctx.row, 15);
  const c = cellNoise(ctx.col, ctx.row, 25);

  r.push();
  r.setAlpha(0.32);
  r.polygon(
    [
      x, y + T * (0.25 + a * 0.5),
      x + T * (0.35 + b * 0.4), y,
      x + T, y + T * (0.1 + c * 0.3),
      x + T, y + T,
      x, y + T,
    ],
    alpha(rock.dark, 0.85),
  );
  r.setAlpha(0.26);
  r.polygon(
    [
      x, y,
      x + T * (0.3 + b * 0.45), y,
      x + T * (0.1 + a * 0.3), y + T * (0.3 + c * 0.35),
      x, y + T * (0.2 + a * 0.35),
    ],
    rock.light,
  );
  r.pop();

  // Crepe: partono da un bordo a caso e non arrivano mai dall'altra parte.
  r.push();
  r.setAlpha(0.45);
  const cx = x + 4 + a * (T - 10);
  r.line(
    [cx, y + 2 + b * 5, cx + (b - 0.5) * 10, y + T * (0.4 + c * 0.2), cx + (a - 0.5) * 6, y + T - 3 - c * 6],
    1 + b * 0.6,
    rock.deep,
  );
  r.pop();

  speckle(r, x, y, ctx, 3, MATERIAL.iron, 4);
  occlude(r, x, y, rock, ctx.open);
}

// ---------------------------------------------------------------- tubo
/**
 * Tubo di metallo verniciato. La resa cilindrica è tutta nel gradiente
 * orizzontale: bordo scuro, banda chiara dove la luce colpisce di striscio,
 * riflesso stretto, e il lato opposto che rientra nell'ombra.
 */
function drawPipe(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.enamel;
  r.gradientRect(
    x,
    y,
    T,
    T,
    [
      { at: 0, color: m.dark },
      { at: 0.12, color: m.base },
      { at: 0.3, color: m.light },
      { at: 0.4, color: m.spec },
      { at: 0.5, color: m.light },
      { at: 0.72, color: m.base },
      { at: 0.9, color: mix(m.dark, '#000000', 0.2) },
      { at: 1, color: m.deep },
    ],
    true,
  );

  if (ctx.open.up) {
    // Colletto del tubo: sporge, quindi ha una faccia superiore illuminata e
    // getta ombra su ciò che sta sotto.
    r.gradientRect(x - 2, y, T + 4, 9, [
      { at: 0, color: alpha(m.light, 0.9) },
      { at: 0.5, color: alpha(m.base, 0.9) },
      { at: 1, color: alpha(m.deep, 0.75) },
    ]);
    r.rect(x - 2, y, T + 4, 1.5, alpha(m.spec, 0.75));
    r.rect(x, y + 10, T, 3, shade(0.28));
    // Interno della bocca: nero, si vede solo il bordo.
    r.push();
    r.setAlpha(0.5);
    r.ellipse(x + T / 2, y + 2, T / 2 - 1, 2.4, MATERIAL.iron.deep);
    r.pop();
  } else {
    // Saldatura tra un elemento e l'altro.
    r.rect(x, y, T, 1.5, alpha(m.deep, 0.5));
    r.rect(x, y + 1.5, T, 1, alpha(m.light, 0.25));
  }

  // Sporco che cola: nessun tubo è pulito.
  r.push();
  r.setAlpha(0.14);
  for (let i = 0; i < 2; i++) {
    const sx = x + 5 + cellNoise(ctx.col, ctx.row, i + 400) * (T - 10);
    r.rect(sx, y, 1.5, T, MATERIAL.iron.dark);
  }
  r.pop();
}

// ---------------------------------------------------------------- blocchi
/** Cornice smussata: la stessa per tutti i blocchi, così sembrano una famiglia. */
function bevel(r: Renderer, x: number, y: number, m: Material, size = 3): void {
  r.polygon([x, y, x + T, y, x + T - size, y + size, x + size, y + size], m.light);
  r.polygon([x, y, x + size, y + size, x + size, y + T - size, x, y + T], mix(m.light, m.base, 0.5));
  r.polygon([x + T, y, x + T, y + T, x + T - size, y + T - size, x + T - size, y + size], m.dark);
  r.polygon([x, y + T, x + size, y + T - size, x + T - size, y + T - size, x + T, y + T], m.deep);
}

/**
 * Blocco premio: ottone lucido con il punto di domanda inciso.
 * Il riflesso che scorre non è decorazione — è ciò che dice al giocatore
 * "questo oggetto è metallico", ed è anche l'esca.
 */
function drawPrizeBlock(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.gold;
  const pulse = wave(ctx.tick, 46);

  r.gradientRect(x, y, T, T, [
    { at: 0, color: m.light },
    { at: 0.3, color: m.base },
    { at: 0.62, color: mix(m.base, m.dark, 0.4) },
    { at: 1, color: m.dark },
  ]);
  bevel(r, x, y, m);

  // Borchie agli angoli, ognuna con il suo riflesso.
  for (const [dx, dy] of [[6, 6], [T - 6, 6], [6, T - 6], [T - 6, T - 6]] as const) {
    r.ellipse(x + dx, y + dy, 2.4, 2.4, m.dark);
    r.ellipse(x + dx - 0.4, y + dy - 0.5, 1.7, 1.7, m.light);
    r.ellipse(x + dx - 0.7, y + dy - 0.8, 0.7, 0.7, m.spec);
  }

  // Riflesso speculare che scorre sulla superficie.
  r.push();
  r.clipRect(x, y, T, T);
  r.setBlend('add');
  r.setAlpha(0.1 + pulse * 0.18);
  const sweep = x + pulse * (T + 10) - 6;
  r.polygon([sweep, y + 2, sweep + 7, y + 2, sweep - 3, y + T - 2, sweep - 10, y + T - 2], m.spec);
  r.pop();

  // Il "?" è inciso: ombra sotto, luce sopra, come un rilievo vero.
  r.text('?', x + T / 2, y + T / 2 + 2, {
    color: alpha(m.deep, 0.85),
    size: 19,
    align: 'center',
    baseline: 'middle',
  });
  r.text('?', x + T / 2, y + T / 2 + 0.5, {
    color: mix(m.light, m.spec, pulse * 0.5),
    size: 19,
    align: 'center',
    baseline: 'middle',
  });

  // Alone caldo: il blocco si fa notare da lontano. È il suo lavoro.
  r.push();
  r.setBlend('add');
  r.setAlpha(0.06 + pulse * 0.06);
  r.radial(x + T / 2, y + T / 2, T * 1.1, T * 1.1, [
    { at: 0, color: alpha(m.light, 0.7) },
    { at: 1, color: alpha(m.light, 0) },
  ]);
  r.pop();
}

/** Blocco già usato: stesso metallo, ma spento e rientrato. */
function drawUsedBlock(r: Renderer, x: number, y: number): void {
  const m = MATERIAL.iron;
  r.gradientRect(x, y, T, T, bodyStops(m));
  bevel(r, x, y, m);
  // L'incasso centrale: bordo superiore in ombra, inferiore in luce (è concavo).
  r.gradientRect(x + 5, y + 5, T - 10, T - 10, [
    { at: 0, color: alpha(m.deep, 0.8) },
    { at: 0.5, color: alpha(m.dark, 0.55) },
    { at: 1, color: alpha(m.light, 0.25) },
  ]);
}

/** Muro di mattoni: corsi sfalsati, malta incassata, sbeccature. */
function drawBrick(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.brick;
  const mortar = mix(MATERIAL.rock.base, MATERIAL.soil.base, 0.35);

  r.rect(x, y, T, T, mortar);

  const rows = 2;
  const h = (T - 3) / rows;
  for (let row = 0; row < rows; row++) {
    // Corsi alternati: la fuga verticale si sposta di mezzo mattone.
    const offset = (ctx.row + row) % 2 === 0 ? 0 : -T / 4;
    for (let i = -1; i < 3; i++) {
      const bx = x + offset + i * (T / 2);
      const by = y + 2 + row * h;
      const w = T / 2 - 2;
      if (bx + w < x || bx > x + T) continue;

      // Ogni mattone ha una cottura leggermente diversa.
      const tone = cellNoise(ctx.col, ctx.row, row * 7 + i + 500);
      const face = mix(m.base, tone > 0.5 ? m.light : m.dark, Math.abs(tone - 0.5) * 0.7);

      r.push();
      r.clipRect(x, y, T, T);
      r.gradientRect(bx, by, w, h - 2, [
        { at: 0, color: mix(face, m.light, 0.35) },
        { at: 0.35, color: face },
        { at: 1, color: mix(face, m.dark, 0.5) },
      ]);
      r.rect(bx, by, w, 1, alpha(m.spec, 0.3));
      r.rect(bx, by + h - 3, w, 1, alpha(m.deep, 0.5));
      // Sbeccatura d'angolo: rende ogni mattone leggermente rotto.
      if (tone > 0.72) {
        r.polygon([bx + w, by, bx + w, by + 4, bx + w - 4, by], alpha(mortar, 0.9));
      }
      r.pop();
    }
  }

  occlude(r, x, y, m, ctx.open);
}

function drawRevealedBlock(r: Renderer, x: number, y: number, tick: number): void {
  const pulse = wave(tick, 30);
  const m = MATERIAL.steel;

  r.gradientRect(x, y, T, T, bodyStops(m));
  bevel(r, x, y, m);
  r.gradientRect(x + 5, y + 5, T - 10, T - 10, [
    { at: 0, color: alpha(PALETTE.hot, 0.9) },
    { at: 1, color: alpha(PALETTE.hotDeep, 0.95) },
  ]);

  r.push();
  r.setBlend('add');
  r.setAlpha(0.2 + pulse * 0.35);
  r.radial(x + T / 2, y + T / 2, T * 0.9, T * 0.9, [
    { at: 0, color: alpha(PALETTE.hot, 0.8) },
    { at: 1, color: alpha(PALETTE.hot, 0) },
  ]);
  r.pop();

  r.text('!', x + T / 2, y + T / 2 + 1, {
    color: '#ffffff',
    size: 17,
    align: 'center',
    baseline: 'middle',
  });
}

/**
 * Asse di legno marcio. Trema e si scurisce prima di cedere: il preavviso è
 * parte del patto col giocatore, non un ripensamento.
 */
function drawCrumble(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.wood;
  const shake = ctx.crumbling ? (Math.floor(ctx.tick / 2) % 2 ? 1.6 : -1.6) : 0;
  const px = x + shake;
  const h = T - 8;

  r.gradientRect(px, y, T, h, [
    { at: 0, color: m.light },
    { at: 0.28, color: m.base },
    { at: 0.8, color: mix(m.base, m.dark, 0.6) },
    { at: 1, color: m.deep },
  ]);

  // Venature: linee che seguono la fibra, con un nodo ogni tanto.
  r.push();
  r.setAlpha(0.28);
  for (let i = 0; i < 3; i++) {
    const gy = y + 4 + i * 6 + cellNoise(ctx.col, ctx.row, i + 600) * 3;
    r.line([px + 1, gy, px + T * 0.4, gy - 1, px + T * 0.75, gy + 1, px + T - 1, gy], 1, m.dark);
  }
  r.pop();
  const knotX = px + 6 + cellNoise(ctx.col, ctx.row, 610) * (T - 12);
  r.ellipse(knotX, y + h * 0.5, 2.6, 1.9, alpha(m.dark, 0.55));
  r.ellipse(knotX, y + h * 0.5, 1.3, 0.9, alpha(m.deep, 0.6));

  // Chiodi arrugginiti alle estremità.
  for (const nx of [px + 4, px + T - 5]) {
    r.ellipse(nx, y + 4, 1.6, 1.6, MATERIAL.iron.dark);
    r.ellipse(nx - 0.4, y + 3.6, 0.8, 0.8, MATERIAL.iron.light);
  }

  r.rect(px, y, T, 1, alpha(m.spec, 0.35));
  r.rect(px, y + h - 2, T, 2, alpha(m.deep, 0.7));
  // Ombra proiettata sotto l'asse: la fa staccare dal vuoto.
  r.gradientRect(px, y + h, T, 5, [
    { at: 0, color: shade(0.35) },
    { at: 1, color: shade(0) },
  ]);

  if (ctx.crumbling) {
    // Crepe che si aprono e calore rosso: sta per finire.
    r.push();
    r.setAlpha(0.5 + wave(ctx.tick, 6) * 0.3);
    r.line([px + 5, y + 2, px + 11, y + h - 3], 1.3, m.deep);
    r.line([px + T - 9, y + 2, px + T - 14, y + h - 3], 1.3, m.deep);
    r.pop();
    r.push();
    r.setBlend('add');
    r.setAlpha(0.12 + wave(ctx.tick, 8) * 0.16);
    r.rect(px, y, T, h, PALETTE.hot);
    r.pop();
  }
}

// ---------------------------------------------------------------- arena
/**
 * Mattone del soffitto dell'arena: muratura pesante tenuta insieme da due
 * staffe di ferro.
 *
 * Deve leggersi come *l'unica cosa staccabile* di tutta la stanza, e quando si
 * stacca deve dirlo forte: trema, le crepe si aprono, la polvere scende. Non è
 * una trappola — è l'arma del giocatore, e un'arma va vista bene.
 */
function drawBossBrick(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.brick;
  const iron = MATERIAL.iron;
  const shake = ctx.crumbling ? (Math.floor(ctx.tick / 2) % 2 ? 1.8 : -1.8) : 0;
  const px = x + shake;

  r.gradientRect(px, y, T, T, [
    { at: 0, color: mix(m.light, m.base, 0.3) },
    { at: 0.3, color: m.base },
    { at: 0.82, color: mix(m.base, m.dark, 0.65) },
    { at: 1, color: m.deep },
  ]);

  // Due conci per cella, con la fuga in mezzo: è muratura, non un blocco.
  r.push();
  r.setAlpha(0.5);
  r.line([px, y + T / 2, px + T, y + T / 2], 2, m.deep);
  r.line([px + T / 2, y, px + T / 2, y + T / 2], 1.6, m.deep);
  r.line([px + T / 4, y + T / 2, px + T / 4, y + T], 1.6, m.deep);
  r.pop();
  speckle(r, px, y, ctx, 2, MATERIAL.rock, 3);

  // Staffe di ferro sopra e sotto: sono loro a tenerlo appeso.
  for (const by of [y, y + T - 4]) {
    r.gradientRect(px, by, T, 4, bodyStops(iron));
    r.rect(px, by, T, 1, alpha(iron.light, 0.7));
    for (const bx of [px + 4, px + T - 5]) {
      r.ellipse(bx, by + 2, 1.6, 1.6, iron.dark);
      r.ellipse(bx - 0.4, by + 1.6, 0.8, 0.8, iron.light);
    }
  }

  if (ctx.crumbling) {
    // Sta cedendo: crepe accese e polvere che cola. È un conto alla rovescia.
    r.push();
    r.setAlpha(0.6 + wave(ctx.tick, 5) * 0.4);
    r.line([px + 6, y + 4, px + 12, y + T - 5], 1.6, m.deep);
    r.line([px + T - 8, y + 4, px + T - 15, y + T - 6], 1.4, m.deep);
    r.pop();
    r.push();
    r.setBlend('add');
    r.setAlpha(0.1 + wave(ctx.tick, 7) * 0.18);
    r.rect(px, y, T, T, PALETTE.hot);
    r.pop();
    r.push();
    r.setAlpha(0.4);
    for (let i = 0; i < 3; i++) {
      const dx = px + 5 + i * 10;
      r.rect(dx, y + T + ((ctx.tick * 2 + i * 9) % 16), 1.4, 3.5, alpha(PALETTE.dust, 0.9));
    }
    r.pop();
  }

  occlude(r, px, y, m, ctx.open);
}

/**
 * Il portone del Padrone: sbarre di ferro colate nella roccia e una serratura
 * che pulsa. Finché è lì, di là non si passa — e nel gioco esiste una sola
 * chiave, che è fargli cadere il soffitto in testa.
 */
function drawBossGate(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const iron = MATERIAL.iron;
  const steel = MATERIAL.steel;

  // Fondo: il buio della stanza dopo, che si intravede tra le sbarre.
  r.gradientRect(x, y, T, T, [
    { at: 0, color: alpha(PALETTE.ink, 0.95) },
    { at: 1, color: alpha(PALETTE.inkSoft, 0.9) },
  ]);

  // Sbarre verticali: cilindriche, quindi con la banda chiara sul terzo sinistro.
  for (let i = 0; i < 3; i++) {
    const bx = x + 4 + i * 9;
    r.gradientRect(bx, y, 6, T, [
      { at: 0, color: iron.dark },
      { at: 0.3, color: iron.light },
      { at: 0.55, color: iron.base },
      { at: 1, color: iron.deep },
    ], true);
  }

  // Traversa: cambia riga a righe alterne, così il cancello sembra intrecciato.
  if (ctx.row % 2 === 0) {
    r.gradientRect(x, y + T / 2 - 3, T, 6, bodyStops(steel));
    r.rect(x, y + T / 2 - 3, T, 1.2, alpha(steel.spec, 0.6));
    for (const bx of [x + 5, x + T - 6]) {
      r.ellipse(bx, y + T / 2, 1.8, 1.8, iron.deep);
      r.ellipse(bx - 0.5, y + T / 2 - 0.5, 1, 1, steel.light);
    }
  }

  // Serratura: una sola cella per portone, quella con la fessura accesa.
  if (ctx.open.left || ctx.open.right) {
    r.push();
    r.setBlend('add');
    r.setAlpha(0.2 + wave(ctx.tick, 60) * 0.2);
    r.radial(x + T / 2, y + T / 2, T * 0.7, T * 0.7, [
      { at: 0, color: alpha(PALETTE.hot, 0.6) },
      { at: 1, color: alpha(PALETTE.hot, 0) },
    ]);
    r.pop();
  }

  occlude(r, x, y, iron, ctx.open);
}

// ---------------------------------------------------------------- pericoli
/**
 * Lame d'acciaio. Il volume viene dal contrasto tra la faccia illuminata e
 * quella in ombra lungo lo spigolo centrale, più un filo speculare sulla
 * punta: si vede che tagliano prima ancora di toccarle.
 */
function drawSpikes(
  r: Renderer,
  x: number,
  y: number,
  ctx: TileDrawContext,
  extension: number,
  inverted: boolean,
): void {
  const m = MATERIAL.steel;
  const count = 3;
  const w = T / count;
  const height = (T - 6) * Math.max(0.05, extension);

  r.push();
  if (inverted) {
    // Gli spuntoni da soffitto sono gli stessi, ribaltati attorno alla cella.
    r.translate(x, y + T);
    r.scale(1, -1);
    r.translate(-x, -y);
  }

  const baseY = y + T;
  for (let i = 0; i < count; i++) {
    const bx = x + i * w;
    const tipX = bx + w / 2;
    const tipY = baseY - height;

    // Corpo della lama.
    r.polygon([bx + 0.5, baseY, tipX, tipY, bx + w - 0.5, baseY], m.base);
    // Faccia sinistra in luce, destra in ombra: lo spigolo centrale li divide.
    r.polygon([bx + 0.5, baseY, tipX, tipY, tipX, baseY], mix(m.light, m.base, 0.35));
    r.polygon([tipX, tipY, bx + w - 0.5, baseY, tipX, baseY], m.dark);
    // Filo della lama.
    r.line([tipX, tipY, tipX, baseY - 3], 1, alpha(m.spec, 0.8));
    // Riflesso sulla punta.
    r.push();
    r.setBlend('add');
    r.setAlpha(0.22);
    r.radial(tipX, tipY + 2.5, 1.8, 3.5, [
      { at: 0, color: alpha(m.spec, 0.8) },
      { at: 1, color: alpha(m.spec, 0) },
    ]);
    r.pop();
    // Ruggine alla base, dove ristagna l'umidità.
    r.push();
    r.setAlpha(0.3);
    r.rect(bx + 1, baseY - 4, w - 2, 4, MATERIAL.brick.dark);
    r.pop();
  }

  // Zoccolo di ferro che tiene le lame.
  r.gradientRect(x, baseY - 5, T, 5, bodyStops(MATERIAL.iron));
  r.rect(x, baseY - 5, T, 1, alpha(MATERIAL.iron.light, 0.6));
  r.pop();

  if (!inverted && ctx.open.up) {
    // Ombra delle lame sul terreno dietro.
    r.push();
    r.setAlpha(0.25);
    r.gradientRect(x, y + T - 8, T, 8, [
      { at: 0, color: shade(0) },
      { at: 1, color: shade(0.6) },
    ]);
    r.pop();
  }
}

/**
 * La piastra da cui escono gli spuntoni a scatto.
 *
 * Deve *farsi notare* anche da spenta: è l'unico preavviso che il giocatore
 * riceve prima di passarci sopra. Acciaio chiaro contro la terra scura, tre
 * feritoie nere e due tacche di pericolo agli angoli.
 */
function drawSpikeSocket(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.steel;
  const plateY = y + T - 9;

  r.gradientRect(x, plateY, T, 9, bodyStops(m));
  r.rect(x, plateY, T, 1.2, alpha(m.spec, 0.8));
  r.rect(x, y + T - 1.5, T, 1.5, alpha(MATERIAL.iron.deep, 0.8));

  // Feritoie: profonde, con il bordo superiore in ombra.
  for (let i = 0; i < 3; i++) {
    const sx = x + 3.5 + i * ((T - 7) / 3);
    const w = (T - 7) / 3 - 3;
    r.rect(sx, plateY + 2.5, w, 4, MATERIAL.iron.deep);
    r.rect(sx, plateY + 2.5, w, 1, alpha(MATERIAL.iron.dark, 0.9));
  }

  // Tacche di pericolo: gialle e nere, come su qualunque macchina che morde.
  r.push();
  r.setAlpha(0.75);
  for (const cx of [x + 1.5, x + T - 3.5]) {
    r.rect(cx, plateY + 2, 2, 5, MATERIAL.gold.base);
    r.rect(cx, plateY + 3.6, 2, 1.6, MATERIAL.iron.deep);
  }
  r.pop();

  // Quando è carica, dalle feritoie esce luce: il preavviso è leale.
  if (ctx.extension > 0 && ctx.extension < 1) {
    r.push();
    r.setBlend('add');
    r.setAlpha(0.45);
    r.radial(x + T / 2, plateY + 4, T * 0.6, 9, [
      { at: 0, color: alpha(PALETTE.hot, 0.8) },
      { at: 1, color: alpha(PALETTE.hot, 0) },
    ]);
    r.pop();
  }
}

/**
 * Molla d'acciaio. Deve leggersi come una molla *da ferma*: se il giocatore
 * la riconosce solo dopo esserci salito sopra, non è una trappola leale.
 * Piastra a terra, spire distanziate, piattello rosso in cima.
 */
function drawSpring(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.steel;
  const iron = MATERIAL.iron;
  const compression = ctx.extension;
  const restHeight = 21;
  const top = y + T - 4 - restHeight * (1 - compression * 0.62);

  // Piastra di ancoraggio, con i bulloni.
  r.gradientRect(x + 1, y + T - 5, T - 2, 5, bodyStops(iron));
  r.ellipse(x + 4, y + T - 2.5, 1.4, 1.4, iron.light);
  r.ellipse(x + T - 4, y + T - 2.5, 1.4, 1.4, iron.light);

  // Spire: ellissi distanziate, ognuna con la sua ombra sotto e il riflesso
  // sopra. Il filo si vede passare dietro, ed è quello che dice "molla".
  const coils = 4;
  const span = y + T - 6 - top;
  for (let i = 0; i < coils; i++) {
    const cy = top + 3 + (i / (coils - 1)) * span;
    const rx = T / 2 - 6 + (i / coils) * 2.5;
    r.ellipse(x + T / 2, cy + 1.2, rx, 2.4, alpha(m.deep, 0.55));
    r.ellipse(x + T / 2, cy, rx, 2.2, m.base);
    r.ellipse(x + T / 2 - rx * 0.35, cy - 0.8, rx * 0.45, 0.9, alpha(m.spec, 0.75));
  }

  // Piattello superiore: è la parte che ti colpisce, e si vede da lontano.
  r.gradientRect(x + 1, top - 4, T - 2, 6, [
    { at: 0, color: m.light },
    { at: 0.35, color: m.base },
    { at: 1, color: m.dark },
  ]);
  r.rect(x + 1, top - 4, T - 2, 1.4, alpha(m.spec, 0.85));
  r.rect(x + 3, top - 1.6, T - 6, 1.6, PALETTE.hot);
  r.push();
  r.setBlend('add');
  r.setAlpha(0.18 + wave(ctx.tick, 40) * 0.14);
  r.radial(x + T / 2, top - 1, T * 0.55, 6, [
    { at: 0, color: alpha(PALETTE.hot, 0.7) },
    { at: 1, color: alpha(PALETTE.hot, 0) },
  ]);
  r.pop();
}

// ---------------------------------------------------------------- mondo 2
/**
 * Ghiaccio.
 *
 * È l'unico materiale del gioco che si guarda *dentro*: sotto la superficie
 * lucida corrono fratture e bolle d'aria intrappolate, e il colore si satura
 * con la profondità invece di scurirsi. La lastra sottile è identica finché
 * non si crepa — la crepa è tutto il preavviso, e arriva quando sei già sopra.
 */
function drawIce(r: Renderer, x: number, y: number, ctx: TileDrawContext, cracking: boolean): void {
  const m = MATERIAL.ice;

  // Corpo: chiaro in superficie, sempre più saturo verso il fondo.
  r.gradientRect(x, y, T, T, ctx.open.up
    ? [
        { at: 0, color: m.light },
        { at: 0.18, color: mix(m.light, m.base, 0.6) },
        { at: 0.7, color: m.base },
        { at: 1, color: m.dark },
      ]
    : [
        { at: 0, color: mix(m.base, m.dark, 0.25) },
        { at: 1, color: mix(m.base, m.dark, 0.65) },
      ]);

  // Fratture interne: piani di rottura che riflettono la luce da dentro.
  r.push();
  r.setAlpha(0.35);
  for (let i = 0; i < 3; i++) {
    const nx = cellNoise(ctx.col, ctx.row, i + 700);
    const ny = cellNoise(ctx.col, ctx.row, i + 710);
    const px = x + 3 + nx * (T - 8);
    const py = y + 4 + ny * (T - 10);
    r.line([px, py, px + 5 + nx * 7, py - 4 - ny * 5], 1.2, alpha(m.light, 0.9));
    r.line([px, py, px - 4 - ny * 6, py + 5 + nx * 5], 0.9, alpha(m.spec, 0.5));
  }
  r.pop();

  // Bolle d'aria: piccole, tonde, sempre negli stessi punti.
  for (let i = 0; i < 3; i++) {
    const bx = x + 5 + cellNoise(ctx.col, ctx.row, i + 720) * (T - 10);
    const by = y + 7 + cellNoise(ctx.col, ctx.row, i + 730) * (T - 14);
    const rad = 0.8 + cellNoise(ctx.col, ctx.row, i + 740) * 1.4;
    r.ellipse(bx, by, rad, rad, alpha(m.deep, 0.35));
    r.ellipse(bx - rad * 0.3, by - rad * 0.3, rad * 0.5, rad * 0.5, glare(0.5));
  }

  occlude(r, x, y, m, ctx.open);

  if (ctx.open.up) {
    // Pellicola lucida in superficie: è quella che dice "qui non si frena".
    r.push();
    r.setBlend('add');
    r.setAlpha(0.3);
    r.gradientRect(x, y, T, 6, [
      { at: 0, color: alpha(m.spec, 0.75) },
      { at: 1, color: alpha(m.spec, 0) },
    ]);
    r.pop();
    // Riflesso obliquo, sempre nello stesso punto della cella.
    r.push();
    r.setAlpha(0.4);
    const sx = x + 4 + cellNoise(ctx.col, ctx.row, 750) * (T - 14);
    r.polygon([sx, y + 2, sx + 6, y + 2, sx - 2, y + 11, sx - 7, y + 11], glare(0.8));
    r.pop();
  }

  if (ctx.open.down) {
    // Ghiaccioli sotto la lastra: si vedono solo dove il ghiaccio è esposto.
    for (let i = 0; i < 3; i++) {
      const ix = x + 5 + i * 10 + cellNoise(ctx.col, ctx.row, i + 760) * 3;
      const len = 3 + cellNoise(ctx.col, ctx.row, i + 770) * 6;
      r.polygon([ix - 2, y + T, ix + 2, y + T, ix, y + T + len], alpha(m.base, 0.85));
      r.line([ix, y + T, ix, y + T + len * 0.7], 0.8, alpha(m.spec, 0.6));
    }
  }

  if (cracking) {
    // Crepe che si aprono: partono dal centro e raggiungono i bordi.
    r.push();
    r.setAlpha(0.55 + wave(ctx.tick, 5) * 0.35);
    const cx = x + T / 2;
    const cy = y + T / 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + cellNoise(ctx.col, ctx.row, 780);
      r.line(
        [cx, cy, cx + Math.cos(a) * T * 0.3, cy + Math.sin(a) * T * 0.3, cx + Math.cos(a + 0.3) * T * 0.5, cy + Math.sin(a + 0.3) * T * 0.5],
        1.2,
        m.deep,
      );
    }
    r.pop();
  }
}

/**
 * Lamiera della fabbrica: pannello imbullonato, giunti incassati, colature di
 * ruggine. È il pavimento più onesto del gioco — e proprio per questo è quello
 * dietro cui si nasconde il gomitolo.
 */
function drawSteel(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.plate;

  r.gradientRect(x, y, T, T, ctx.open.up
    ? bodyStops(m)
    : [
        { at: 0, color: mix(m.base, m.dark, 0.3) },
        { at: 1, color: mix(m.base, m.dark, 0.65) },
      ]);

  // Spazzolatura verticale: righe finissime, sempre le stesse.
  r.push();
  r.setAlpha(0.12);
  for (let i = 0; i < 6; i++) {
    const sx = x + 2 + i * 5 + cellNoise(ctx.col, ctx.row, i + 800) * 2;
    r.line([sx, y + 1, sx, y + T - 1], 1, i % 2 ? m.light : m.dark);
  }
  r.pop();

  // Giunto incassato lungo il bordo del pannello.
  r.rect(x + 3, y + 3, T - 6, 1, alpha(m.deep, 0.55));
  r.rect(x + 3, y + 4, T - 6, 0.8, alpha(m.light, 0.3));
  r.rect(x + 3, y + T - 4, T - 6, 1, alpha(m.deep, 0.5));

  // Bulloni agli angoli: testa esagonale, luce in alto a sinistra.
  for (const [dx, dy] of [[6, 6], [T - 6, 6], [6, T - 6], [T - 6, T - 6]] as const) {
    r.ellipse(x + dx, y + dy + 0.6, 2.2, 2.2, alpha(m.deep, 0.7));
    r.ellipse(x + dx, y + dy, 2.2, 2.2, m.base);
    r.ellipse(x + dx - 0.5, y + dy - 0.6, 1.2, 1.1, m.light);
    r.ellipse(x + dx - 0.7, y + dy - 0.8, 0.5, 0.45, m.spec);
  }

  // Ruggine che cola dai bulloni: la fabbrica è ferma da un pezzo.
  r.push();
  r.setAlpha(0.16);
  for (let i = 0; i < 2; i++) {
    const rx = x + 5 + cellNoise(ctx.col, ctx.row, i + 810) * (T - 10);
    r.gradientRect(rx, y + 7, 2, T - 10, [
      { at: 0, color: alpha(MATERIAL.copper.dark, 0.9) },
      { at: 1, color: alpha(MATERIAL.copper.dark, 0) },
    ]);
  }
  r.pop();

  occlude(r, x, y, m, ctx.open);
}

/**
 * La giuntura di una parete già attraversata.
 *
 * Non si vede prima — prima è lamiera identica alle altre — e non serve a
 * insospettire: serve a *ricordare*. Trovato un passaggio, non lo si deve
 * ricercare a tentoni ogni volta che si rientra nel livello.
 */
function drawOpenSeam(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  r.push();
  r.setAlpha(0.5 + wave(ctx.tick, 60) * 0.25);
  r.line([x + 2, y + 2, x + 2, y + T - 2], 1.4, alpha(PALETTE.yarn, 0.9));
  r.line([x + T - 2, y + 2, x + T - 2, y + T - 2], 1.4, alpha(PALETTE.yarn, 0.6));
  r.pop();
  r.push();
  r.setBlend('add');
  r.setAlpha(0.1 + wave(ctx.tick, 60) * 0.08);
  r.gradientRect(x, y, T, T, [
    { at: 0, color: alpha(PALETTE.yarn, 0.5) },
    { at: 1, color: alpha(PALETTE.yarn, 0) },
  ], true);
  r.pop();
}

/**
 * Nastro trasportatore.
 *
 * Deve leggersi *da fermo* in che verso porta: i galloni scorrono, i rulli
 * girano, e la banda si vede rientrare sotto il telaio. Se il giocatore
 * capisce dove lo porta solo dopo esserci salito, non è una regola nuova —
 * è un imbroglio, e quelli si fanno altrove.
 */
function drawBelt(r: Renderer, x: number, y: number, ctx: TileDrawContext, direction: number): void {
  const rubber = MATERIAL.rubber;
  const iron = MATERIAL.iron;
  const beltTop = y + 6;
  const beltH = 11;

  // Telaio sotto la banda.
  r.gradientRect(x, y + T - 14, T, 14, bodyStops(iron));
  r.push();
  r.setAlpha(0.4);
  r.line([x, y + T - 6, x + T, y + T - 6], 1, iron.deep);
  r.pop();

  // Banda di gomma.
  r.gradientRect(x, beltTop, T, beltH, [
    { at: 0, color: rubber.light },
    { at: 0.25, color: rubber.base },
    { at: 1, color: rubber.deep },
  ]);
  r.rect(x, beltTop, T, 1.2, alpha(rubber.spec, 0.55));

  // Galloni: scorrono nel verso del nastro, a velocità costante.
  const shift = ((ctx.tick * 1.25 * direction) % 12 + 12) % 12;
  r.push();
  r.clipRect(x, beltTop, T, beltH);
  r.setAlpha(0.85);
  for (let i = -1; i < 3; i++) {
    const gx = x + i * 12 + shift;
    r.polygon(
      [
        gx, beltTop + 1.5,
        gx + direction * 5, beltTop + beltH / 2,
        gx, beltTop + beltH - 1.5,
        gx + direction * 2.6, beltTop + beltH - 1.5,
        gx + direction * 7.6, beltTop + beltH / 2,
        gx + direction * 2.6, beltTop + 1.5,
      ],
      MATERIAL.gold.base,
    );
  }
  r.pop();

  // Rulli di rinvio sotto la banda: piccoli e fitti, come su un nastro vero.
  // Grossi e uno per cella diventerebbero una fila di cerchi ripetuti, che è
  // il modo più veloce per far sembrare un mondo una griglia.
  const spin = (ctx.tick * 0.16 * direction) % (Math.PI * 2);
  for (let i = 0; i < 3; i++) {
    const rx = x + 6 + i * 10;
    const ry = beltTop + beltH + 3.5;
    r.ellipse(rx, ry, 3, 3, MATERIAL.steel.dark);
    r.ellipse(rx - 0.6, ry - 0.8, 1.6, 1.6, alpha(MATERIAL.steel.light, 0.7));
    r.line([rx, ry, rx + Math.cos(spin + i) * 2.4, ry + Math.sin(spin + i) * 2.4], 0.8, MATERIAL.steel.deep);
  }

  // Ombra proiettata dalla banda sul telaio.
  r.gradientRect(x, beltTop + beltH, T, 4, [
    { at: 0, color: shade(0.4) },
    { at: 1, color: shade(0) },
  ]);
}

/**
 * Getto di vapore.
 *
 * La griglia da cui esce è di ferro, e il vapore sale a sbuffi regolari: la
 * fase dipende da riga e colonna, quindi ogni getto ha il suo ritmo e resta
 * identico a ogni tentativo. Il getto spento usa esattamente questo disegno —
 * per distinguerli bisogna entrarci, che è il prezzo del biglietto.
 */
function drawVent(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const iron = MATERIAL.iron;
  const phase = ctx.tick * 0.09 + ctx.col * 1.7 + ctx.row * 0.9;

  // Bocchetta: si vede solo se sotto c'è qualcosa, ma disegnarla sempre rende
  // la colonna di vapore leggibile anche a mezz'aria.
  if (!ctx.open.down) {
    r.gradientRect(x + 2, y + T - 7, T - 4, 7, bodyStops(iron));
    for (let i = 0; i < 3; i++) {
      const sx = x + 5 + i * ((T - 10) / 3);
      r.rect(sx, y + T - 5.5, (T - 10) / 3 - 2, 3.5, iron.deep);
    }
    r.rect(x + 2, y + T - 7, T - 4, 1, alpha(iron.light, 0.6));
  }

  // Il fusto del getto: una colonna piena che riempie la cella. Deve leggersi
  // *da lontano* — è l'unica cosa del gioco che il giocatore deve vedere prima
  // di saltarci dentro, perché la spinta comincia dove comincia il vapore.
  // Il riempimento è *uniforme* dentro la cella, non sfumato: una cella alla
  // volta con un gradiente proprio darebbe una colonna a fasce, e il getto
  // sembrerebbe una pila di scatole invece di una cosa sola.
  r.push();
  r.setBlend('add');
  r.setAlpha(0.26 + wave(ctx.tick + ctx.col * 7, 34) * 0.08);
  r.gradientRect(x + 3, y, T - 6, T, [
    { at: 0, color: alpha(PALETTE.steam, 0.1) },
    { at: 0.5, color: alpha(PALETTE.steam, 0.55) },
    { at: 1, color: alpha(PALETTE.steam, 0.1) },
  ], true);
  r.pop();

  // Sbuffi: quattro nuvole che salgono e si allargano, sfasate tra loro.
  r.push();
  for (let i = 0; i < 4; i++) {
    const t = (phase + i * 0.25) % 1;
    const py = y + T - t * T;
    const spread = 7 + t * 11;
    r.setAlpha(0.75 * (1 - t * 0.7));
    r.radial(x + T / 2 + Math.sin(phase * 2 + i) * 3, py, spread, spread * 0.8, [
      { at: 0, color: alpha(PALETTE.steam, 0.85) },
      { at: 0.5, color: alpha(PALETTE.steam, 0.35) },
      { at: 1, color: alpha(PALETTE.steam, 0) },
    ]);
  }
  r.pop();
}

// ---------------------------------------------------------------- mondo 3
/**
 * Sabbia compatta.
 *
 * È il pavimento onesto del deserto e deve leggersi come tale: massa piena,
 * niente crepe, niente bordi che suggeriscano un blocco. L'unica cosa che ha
 * di suo sono le **increspature** sulla faccia esposta — le stesse che lascia
 * il vento sulle dune vere — e stanno lì per un motivo di gioco: sono l'unica
 * differenza visibile fra questa e le sabbie mobili, che sono l'esatto
 * contrario di un pavimento.
 */
function drawSand(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.sand;

  r.gradientRect(x, y, T, T, ctx.open.up
    ? bodyStops(m)
    : [
        { at: 0, color: mix(m.base, m.dark, 0.4) },
        { at: 1, color: mix(m.base, m.dark, 0.68) },
      ]);

  // Stratificazione: la sabbia si deposita a strati, e sotto sono più scuri.
  r.push();
  r.setAlpha(0.12);
  for (let i = 1; i < 4; i++) {
    const ly = y + i * (T / 4) + cellNoise(ctx.col, ctx.row, i + 40) * 3;
    r.line([x, ly, x + T, ly + cellNoise(ctx.col, ctx.row, i + 70) * 3 - 1.5], 1.4, m.dark);
  }
  r.pop();

  speckle(r, x, y, ctx, 5, m, ctx.open.up ? 8 : 2);

  if (ctx.open.up) {
    // Il crinale: un filo di luce sulla superficie, con le increspature che
    // corrono trasversali. Sempre nello stesso posto, sempre uguali.
    r.gradientRect(x, y, T, 6, [
      { at: 0, color: alpha(m.light, 0.85) },
      { at: 1, color: alpha(m.light, 0) },
    ]);
    r.push();
    r.setAlpha(0.3);
    for (let i = 0; i < 4; i++) {
      const rx = x + 2 + i * 8 + cellNoise(ctx.col, ctx.row, i + 200) * 3;
      r.line([rx, y + 2, rx + 4, y + 5.5, rx + 1, y + 9], 1.1, m.deep);
      r.line([rx + 0.6, y + 1.4, rx + 4.6, y + 4.9], 1, glare(0.5));
    }
    r.pop();
  }

  occlude(r, x, y, m, ctx.open);
}

/**
 * Arenaria del tempio: conci squadrati, non roccia.
 *
 * La differenza con la sabbia è tutta qui — questa l'ha tagliata qualcuno. Il
 * giunto tutt'intorno, lo smusso sugli spigoli e ogni tanto un'incisione a
 * smalto: bastano a far capire, senza una riga di testo, che da qui in poi il
 * mondo è stato costruito e quindi ha delle intenzioni.
 */
function drawSandstone(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.sandstone;

  r.gradientRect(x, y, T, T, ctx.open.up
    ? bodyStops(m)
    : [
        { at: 0, color: mix(m.base, m.dark, 0.34) },
        { at: 1, color: mix(m.base, m.dark, 0.6) },
      ]);

  // Il concio: giunto scavato tutt'intorno, con lo smusso in luce sopra e a
  // sinistra. È la stessa logica dei bulloni dell'acciaio — un dettaglio solo,
  // ripetuto con criterio, vale più di dieci sparsi a caso.
  r.rect(x + 2, y + 2, T - 4, 1.2, alpha(m.deep, 0.45));
  r.rect(x + 2, y + 3.2, T - 4, 1, alpha(m.light, 0.35));
  r.rect(x + 2, y + T - 3, T - 4, 1.2, alpha(m.deep, 0.4));
  r.push();
  r.setAlpha(0.35);
  r.line([x + 2.5, y + 3, x + 2.5, y + T - 3], 1.1, m.deep);
  r.line([x + T - 2.5, y + 3, x + T - 2.5, y + T - 3], 1.1, m.deep);
  r.pop();

  // Sbeccature: la pietra è vecchia, e lo è sempre negli stessi punti.
  r.push();
  r.setAlpha(0.3);
  for (let i = 0; i < 3; i++) {
    const nx = cellNoise(ctx.col, ctx.row, i + 300);
    const ny = cellNoise(ctx.col, ctx.row, i + 330);
    const size = 1.4 + nx * 2.6;
    r.ellipse(x + 5 + nx * (T - 10), y + 5 + ny * (T - 10), size, size * 0.7, m.deep);
  }
  r.pop();

  // Incisioni a smalto: una cella su tre circa, sempre le stesse. Sono l'unica
  // cosa fredda del mondo 3 e servono a far vedere che qui c'era qualcuno.
  if (cellNoise(ctx.col, ctx.row, 360) > 0.68) {
    const glyph = MATERIAL.faience;
    const gx = x + T / 2;
    const gy = y + T / 2;
    r.push();
    r.setAlpha(0.55);
    const kind = Math.floor(cellNoise(ctx.col, ctx.row, 390) * 3);
    if (kind === 0) {
      // Occhio.
      r.line([gx - 6, gy, gx, gy - 4, gx + 6, gy], 1.6, glyph.base);
      r.ellipse(gx, gy - 0.6, 2, 2, glyph.light);
    } else if (kind === 1) {
      // Onda d'acqua, che in un deserto è già una battuta.
      for (let i = 0; i < 2; i++) {
        r.line([gx - 6, gy - 2 + i * 4, gx - 2, gy - 4 + i * 4, gx + 2, gy - 2 + i * 4, gx + 6, gy - 4 + i * 4], 1.4, glyph.base);
      }
    } else {
      // Gatto seduto. Piccolissimo, e chi lo nota lo nota.
      r.ellipse(gx, gy + 2, 2.6, 3.4, glyph.base);
      r.ellipse(gx, gy - 3, 2, 2, glyph.base);
      r.polygon([gx - 2, gy - 4, gx - 1, gy - 7, gx - 0.2, gy - 4], glyph.light);
      r.polygon([gx + 2, gy - 4, gx + 1, gy - 7, gx + 0.2, gy - 4], glyph.light);
    }
    r.pop();
  }

  occlude(r, x, y, m, ctx.open);
}

/**
 * Piastra a pressione.
 *
 * Si vede benissimo — è una lastra più chiara, con la fuga tutt'intorno e un
 * glifo al centro — e non c'è nessuna intenzione di nasconderla: quello che
 * non si sa è *cosa* sgancia, e lo si scopre trenta metri più avanti. Una volta
 * pestata resta abbassata e col glifo spento, perché una trappola già scattata
 * che continuasse a sembrare carica sarebbe una bugia (CLAUDE.md, punto 7).
 */
function drawPlate(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.sandstone;
  const glyph = MATERIAL.faience;
  const pressed = ctx.revealed;
  const lift = pressed ? 3 : 0;

  // Vasca: il vano in cui la lastra scende.
  r.gradientRect(x, y, T, T, [
    { at: 0, color: mix(m.dark, m.deep, 0.4) },
    { at: 1, color: mix(m.base, m.dark, 0.7) },
  ]);
  r.rect(x + 1, y + 1, T - 2, 2, alpha(m.deep, 0.7));

  // La lastra vera e propria, un filo più stretta della cella: è la fuga a
  // dire che questo pezzo di pavimento si muove.
  r.gradientRect(x + 3, y + 2 + lift, T - 6, T - 4 - lift, bodyStops(m));
  r.rect(x + 3, y + 2 + lift, T - 6, 1.2, alpha(m.light, pressed ? 0.3 : 0.7));

  r.push();
  r.setAlpha(pressed ? 0.25 : 0.7);
  const gy = y + T / 2 + lift;
  r.line([x + 8, gy - 3, x + T - 8, gy - 3], 1.4, glyph.base);
  r.line([x + 10, gy + 1, x + T - 10, gy + 1], 1.4, glyph.base);
  r.ellipse(x + T / 2, gy + 5, 2, 2, glyph.light);
  r.pop();

  // Da carica pulsa piano. È l'unico avviso, e non dice cosa succederà.
  if (!pressed) {
    r.push();
    r.setBlend('add');
    r.setAlpha(0.08 + wave(ctx.tick + ctx.col * 9, 70) * 0.1);
    r.radial(x + T / 2, y + T / 2, T * 0.6, T * 0.45, [
      { at: 0, color: alpha(glyph.light, 0.7) },
      { at: 1, color: alpha(glyph.light, 0) },
    ]);
    r.pop();
  }

  occlude(r, x, y, m, ctx.open);
}

/**
 * Corrente d'aria.
 *
 * Deve leggersi *da fermo* in che verso porta, esattamente come il nastro: la
 * sabbia in sospensione corre nel verso della spinta, e le raffiche sono
 * lunghe e sottili invece che tonde, perché è aria che scorre e non vapore che
 * sale. Il giocatore deve poter decidere prima di saltarci dentro — dopo, in
 * aria, non c'è più niente da decidere.
 */
// ---------------------------------------------------------------- mondo 4
/**
 * Vetro temprato: il pavimento onesto della torre.
 *
 * È l'unica superficie del gioco attraverso cui si vede, e non è un vezzo: nel
 * quarto mondo si cammina anche sul soffitto, quindi sapere cosa c'è dall'altra
 * parte di una lastra è un'informazione di gioco. Il corpo quindi è quasi
 * trasparente e tutto il lavoro lo fanno gli spigoli — la luce che corre lungo
 * i bordi molati e il riflesso obliquo — perché un vetro si legge dai bordi.
 */
function drawGlass(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.glass;

  // Corpo: una velatura, non una tinta. Più fitta in basso, dove lo spessore
  // del vetro accumula colore.
  r.push();
  r.setAlpha(0.5);
  r.gradientRect(x, y, T, T, [
    { at: 0, color: alpha(m.light, 0.75) },
    { at: 0.45, color: alpha(m.base, 0.55) },
    { at: 1, color: alpha(m.deep, 0.7) },
  ]);
  r.pop();

  // Bolle e inclusioni dentro la massa: poche, sempre le stesse.
  for (let i = 0; i < 2; i++) {
    const bx = x + 6 + cellNoise(ctx.col, ctx.row, i + 900) * (T - 12);
    const by = y + 7 + cellNoise(ctx.col, ctx.row, i + 910) * (T - 14);
    const rad = 0.7 + cellNoise(ctx.col, ctx.row, i + 920) * 1.3;
    r.ellipse(bx, by, rad, rad, alpha(m.deep, 0.3));
    r.ellipse(bx - rad * 0.3, by - rad * 0.35, rad * 0.5, rad * 0.5, glare(0.55));
  }

  // Bordi molati: una lastra di vetro è tutta qui. Ogni faccia esposta prende
  // una riga di luce piena, ed è quello che rende leggibile lo spigolo su cui
  // il gatto poggia le zampe — o ci si aggrappa, se il basso è di sopra.
  r.push();
  r.setBlend('add');
  r.setAlpha(0.55);
  if (ctx.open.up) r.rect(x, y, T, 2, alpha(m.spec, 0.9));
  if (ctx.open.down) r.rect(x, y + T - 2, T, 2, alpha(m.spec, 0.6));
  if (ctx.open.left) r.rect(x, y, 2, T, alpha(m.spec, 0.7));
  if (ctx.open.right) r.rect(x + T - 2, y, 2, T, alpha(m.spec, 0.45));
  r.pop();

  // Riflesso obliquo: sempre nello stesso punto della cella, come sul ghiaccio.
  r.push();
  r.setBlend('add');
  r.setAlpha(0.22);
  const sx = x + 4 + cellNoise(ctx.col, ctx.row, 930) * (T - 16);
  r.polygon([sx, y + 3, sx + 7, y + 3, sx - 4, y + T - 3, sx - 11, y + T - 3], glare(0.8));
  r.pop();

  // Armatura interna: la rete metallica del vetro di sicurezza. Serve anche a
  // dire che è solido, che è l'unica cosa che di un vetro non si dà per scontata.
  r.push();
  r.setAlpha(0.16);
  for (let i = 1; i < 3; i++) {
    r.line([x + (i * T) / 3, y, x + (i * T) / 3, y + T], 0.8, m.deep);
    r.line([x, y + (i * T) / 3, x + T, y + (i * T) / 3], 0.8, m.deep);
  }
  r.pop();
}

/**
 * Basalto: la pietra del Rovescio.
 *
 * Il contrario esatto del vetro — non riflette niente, non lascia passare
 * niente, e la sua forma si legge solo dalle colonne prismatiche in cui si
 * spacca. È la roccia più scura del gioco e serve a questo: sotto la torre,
 * l'unica cosa che si distingue dal vuoto dev'essere il pavimento.
 */
function drawBasalt(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.basalt;

  r.gradientRect(x, y, T, T, ctx.open.up
    ? bodyStops(m)
    : [
        { at: 0, color: mix(m.base, m.dark, 0.4) },
        { at: 1, color: mix(m.base, m.dark, 0.75) },
      ]);

  // Colonne prismatiche: il basalto si raffredda in prismi verticali, e sono
  // l'unica cosa che dà una direzione a una pietra altrimenti nera.
  const columns = 3;
  for (let i = 0; i <= columns; i++) {
    const cx = x + (i * T) / columns + cellNoise(ctx.col, ctx.row, i + 940) * 2 - 1;
    r.line([cx, y, cx, y + T], 1.2, alpha(m.deep, 0.75));
    r.line([cx + 1, y, cx + 1, y + T], 0.7, alpha(m.light, 0.22));
  }

  // Sfaldature orizzontali: due o tre, mai regolari.
  r.push();
  r.setAlpha(0.35);
  for (let i = 0; i < 2; i++) {
    const fy = y + 8 + cellNoise(ctx.col, ctx.row, i + 950) * (T - 16);
    r.line([x, fy, x + T * 0.55, fy + 1.4, x + T, fy - 0.8], 1, m.deep);
  }
  r.pop();

  speckle(r, x, y, ctx, 3, m, 4);
  occlude(r, x, y, m, ctx.open);

  // Vetrificazioni: schegge di ossidiana incastrate nella pietra. Sono l'unica
  // cosa che restituisce luce quaggiù, e bastano tre per cella.
  r.push();
  r.setAlpha(0.4);
  for (let i = 0; i < 3; i++) {
    const gx = x + 4 + cellNoise(ctx.col, ctx.row, i + 960) * (T - 8);
    const gy = y + 5 + cellNoise(ctx.col, ctx.row, i + 970) * (T - 10);
    r.polygon([gx, gy - 1.6, gx + 1.4, gy, gx, gy + 1.6, gx - 1.4, gy], m.spec);
  }
  r.pop();
}

/**
 * Il campo rovescio, e il campo rovescio spento.
 *
 * Sono lo stesso disegno, e devono esserlo: il secondo è una trappola solo
 * finché è indistinguibile dal primo. Quello che si vede è una colonna d'aria
 * che sale — polvere che va **in su**, una velatura viola, e le due frecce
 * incise sulle guide laterali — perché la cosa da comunicare è una sola e non è
 * "qui c'è qualcosa": è "qui il basso è di sopra".
 */
function drawReverseField(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.ether;

  // Velatura di fondo: si accende e si spegne piano, sempre allo stesso ritmo.
  r.push();
  r.setBlend('add');
  r.setAlpha(0.1 + wave(ctx.tick, 44) * 0.06);
  r.gradientRect(x, y, T, T, [
    { at: 0, color: alpha(m.light, 0.55) },
    { at: 1, color: alpha(m.base, 0.1) },
  ]);
  r.pop();

  // Guide laterali: due montanti incisi che tengono il campo. Sono l'unica
  // parte solida di questa cella, e servono a farla leggere come un congegno
  // costruito invece che come un effetto di luce.
  r.push();
  r.setAlpha(0.45);
  r.rect(x + 1, y, 1.6, T, alpha(m.dark, 0.9));
  r.rect(x + T - 2.6, y, 1.6, T, alpha(m.dark, 0.7));
  r.pop();

  // Polvere che sale: quattro grani per cella, a velocità diverse, che escono
  // dal basso e vengono risucchiati in alto. È l'informazione, il resto è
  // contorno — chi guarda questa cella deve capire da che parte si cadrà.
  r.push();
  r.setBlend('add');
  for (let i = 0; i < 4; i++) {
    const lane = 5 + i * 7 + cellNoise(ctx.col, ctx.row, i + 980) * 3;
    const speed = 26 + cellNoise(ctx.col, ctx.row, i + 990) * 22;
    const phase = (ctx.tick / speed + cellNoise(ctx.col, ctx.row, i + 1000)) % 1;
    const py = y + T - phase * T;
    r.setAlpha(0.16 + (1 - phase) * 0.3);
    r.ellipse(x + lane, py, 1.1, 2.6, alpha(m.light, 0.9));
  }
  r.pop();

  // Le due frecce: incise sui montanti, immobili, rivolte in su. Non lampeggiano
  // e non si muovono — un cartello che si anima diventa una decorazione.
  r.push();
  r.setAlpha(0.5);
  for (const side of [x + 6.5, x + T - 6.5]) {
    r.polygon([side, y + T * 0.36, side + 3, y + T * 0.5, side - 3, y + T * 0.5], alpha(m.spec, 0.8));
  }
  r.pop();
}

function drawWind(r: Renderer, x: number, y: number, ctx: TileDrawContext, direction: number): void {
  const phase = ctx.tick * 0.05 + ctx.col * 0.7 + ctx.row * 1.3;

  // Il corpo della corrente: una fascia orizzontale uniforme dentro la cella.
  // Uniforme e non sfumata per la stessa ragione del getto di vapore — celle
  // affiancate con un gradiente proprio darebbero una corrente a scacchi.
  r.push();
  r.setBlend('add');
  r.setAlpha(0.12 + wave(ctx.tick + ctx.row * 11, 40) * 0.05);
  r.gradientRect(x, y + 2, T, T - 4, [
    { at: 0, color: alpha(PALETTE.sand, 0.05) },
    { at: 0.5, color: alpha(PALETTE.sand, 0.5) },
    { at: 1, color: alpha(PALETTE.sand, 0.05) },
  ]);
  r.pop();

  // Le raffiche: quattro filamenti che attraversano la cella, sfasati fra loro
  // e con una quota che dipende dalla cella. Non escono mai dalla cella, così
  // una colonna di correnti resta leggibile riga per riga.
  r.push();
  for (let i = 0; i < 4; i++) {
    const t = ((phase + i * 0.27) % 1 + 1) % 1;
    const sx = direction > 0 ? x + t * T : x + T - t * T;
    const sy = y + 5 + ((i * 7 + Math.floor(cellNoise(ctx.col, ctx.row, i + 500) * 6)) % (T - 10));
    const len = 7 + (1 - Math.abs(t - 0.5) * 2) * 9;
    // Le raffiche a metà corsa sono le più lunghe e le più chiare: è quello
    // che dà l'impressione della velocità invece che del movimento.
    r.setAlpha(0.5 * (1 - Math.abs(t - 0.5) * 1.2));
    r.line([sx, sy, sx - direction * len, sy + 1.2], 1.3, PALETTE.sand);
    r.setAlpha(0.22 * (1 - Math.abs(t - 0.5) * 1.2));
    r.line([sx, sy + 2.4, sx - direction * len * 0.7, sy + 3], 1, glare(0.7));
  }
  r.pop();

  // Il grano che gira in coda alla raffica: pochi punti, e servono a dire che
  // la corrente è fatta di roba, non di luce.
  r.push();
  r.setAlpha(0.4);
  for (let i = 0; i < 3; i++) {
    const t = ((phase * 1.3 + i * 0.4) % 1 + 1) % 1;
    const gx = direction > 0 ? x + t * T : x + T - t * T;
    const gy = y + T / 2 + Math.sin(phase * 3 + i * 2) * 8;
    r.ellipse(gx, gy, 1.3, 1.1, MATERIAL.sand.light);
  }
  r.pop();
}

/**
 * Risucchio: una colonna di sabbia che cade dal soffitto.
 *
 * È il getto di vapore capovolto, e si disegna apposta con lo stesso peso —
 * una colonna piena che riempie la cella — perché è la stessa promessa letta
 * al contrario: dove il vapore diceva "qui si sale", questa dice "qui si
 * scende", e va vista prima di saltarci dentro.
 */
function drawDowndraft(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.sand;
  const phase = ctx.tick * 0.11 + ctx.col * 1.3 + ctx.row * 0.5;

  // La bocca: solo se sopra c'è qualcosa. Sotto niente, perché la sabbia cade
  // e basta — non c'è una griglia che la raccoglie.
  if (!ctx.open.up) {
    r.gradientRect(x + 2, y, T - 4, 6, [
      { at: 0, color: alpha(MATERIAL.sandstone.dark, 0.9) },
      { at: 1, color: alpha(MATERIAL.sandstone.deep, 0.6) },
    ]);
    r.rect(x + 2, y + 5, T - 4, 1, alpha(m.light, 0.4));
  }

  r.push();
  r.setAlpha(0.3 + wave(ctx.tick + ctx.col * 5, 28) * 0.08);
  r.gradientRect(x + 4, y, T - 8, T, [
    { at: 0, color: alpha(PALETTE.sand, 0.08) },
    { at: 0.5, color: alpha(PALETTE.sand, 0.42) },
    { at: 1, color: alpha(PALETTE.sand, 0.08) },
  ], true);
  r.pop();

  // I filamenti che scendono: si allungano man mano che accelerano, come fa
  // qualunque cosa che cade.
  r.push();
  for (let i = 0; i < 5; i++) {
    const t = ((phase + i * 0.2) % 1 + 1) % 1;
    const py = y + t * T;
    const len = 4 + t * 10;
    const px = x + 5 + ((i * 9 + Math.floor(cellNoise(ctx.col, ctx.row, i + 600) * 8)) % (T - 10));
    r.setAlpha(0.55 * (1 - t * 0.5));
    r.line([px, py - len, px + 0.8, py], 1.2, m.light);
  }
  r.pop();

  // Polvere che sbuffa dove la colonna finisce: si vede dove si atterra, e
  // atterrarci sotto è quasi sempre il problema.
  if (!ctx.open.down) {
    r.push();
    r.setAlpha(0.3 + wave(ctx.tick, 24) * 0.12);
    r.radial(x + T / 2, y + T - 2, 13, 6, [
      { at: 0, color: alpha(PALETTE.sand, 0.6) },
      { at: 1, color: alpha(PALETTE.sand, 0) },
    ]);
    r.pop();
  }
}

/**
 * Sabbie mobili.
 *
 * Il problema di disegno più delicato del mondo 3: devono somigliare alla
 * sabbia — se no non c'è nessuna tentazione a metterci un piede — ma devono
 * anche dire *da fermo* che non sono un pavimento, perché il patto dice che
 * questa non è una trappola, è una superficie.
 *
 * La differenza è tutta nel bordo: la sabbia compatta ha un crinale netto e
 * increspato, qui non c'è nessuna linea di contatto — la superficie respira,
 * ci passano sopra dei mulinelli lentissimi e ogni tanto sale una bolla. È
 * esattamente come si distingue una pozza d'acqua da un pavimento bagnato.
 */
function drawQuicksand(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.sand;
  const wet = mix(m.base, MATERIAL.soil.dark, 0.35);
  const surface = ctx.open.up;

  r.gradientRect(x, y, T, T, [
    { at: 0, color: surface ? mix(wet, m.light, 0.25) : wet },
    { at: 1, color: mix(wet, m.deep, 0.55) },
  ]);

  // Mulinelli: due anelli concentrici che ruotano piano attorno a un centro
  // che dipende dalla cella. È il movimento a dire "questa roba ti ingoia".
  const swirl = ctx.tick / 90 + cellNoise(ctx.col, ctx.row, 700) * 6.28;
  r.push();
  r.setAlpha(0.28);
  for (let i = 0; i < 2; i++) {
    const radius = 6 + i * 5;
    const cx = x + T / 2 + Math.cos(swirl + i * 2.1) * 3;
    const cy = y + T / 2 + Math.sin(swirl + i * 2.1) * 2;
    r.ellipse(cx, cy, radius, radius * 0.42, alpha(i ? m.dark : m.deep, 0.6));
    r.ellipse(cx, cy - 0.8, radius * 0.9, radius * 0.34, alpha(m.base, 0.5));
  }
  r.pop();

  // Bolle: salgono, arrivano in superficie e scoppiano. Il ritmo dipende dalla
  // cella, quindi due pozze vicine non pulsano all'unisono.
  r.push();
  for (let i = 0; i < 3; i++) {
    const t = ((ctx.tick / 110 + cellNoise(ctx.col, ctx.row, i + 730)) % 1 + 1) % 1;
    const bx = x + 6 + cellNoise(ctx.col, ctx.row, i + 760) * (T - 12);
    const by = y + T - t * T;
    r.setAlpha(0.4 * (1 - t));
    r.ellipse(bx, by, 1.6 + t * 2.2, 1.2 + t * 1.4, m.light);
  }
  r.pop();

  if (surface) {
    // Niente crinale, niente bordo netto: solo un velo più chiaro che ondeggia.
    // È l'unica differenza a vista dalla sabbia compatta, e basta.
    r.push();
    r.setAlpha(0.35);
    const bob = wave(ctx.tick + ctx.col * 13, 90) * 2;
    r.gradientRect(x, y + bob, T, 5, [
      { at: 0, color: alpha(m.light, 0.7) },
      { at: 1, color: alpha(m.light, 0) },
    ]);
    r.pop();
  }
}

/**
 * Il gomitolo.
 *
 * L'unico oggetto del gioco disegnato per essere *desiderato*: lana calda in
 * un mondo di lamiera, un alone che si vede da fuori schermo quando la stanza
 * segreta si apre, e il capo del filo che penzola. Nessuna trappola gli
 * somiglia — se assomigliasse a qualcosa che uccide, trovarlo non sarebbe una
 * ricompensa ma un'altra tassa.
 */
function drawYarn(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const cx = x + T / 2;
  const bob = Math.sin((ctx.tick + ctx.col * 11) / 22) * 2.4;
  const cy = y + T / 2 + bob;
  const radius = 9.5;

  // Alone: è la cosa che si nota per prima, ed è voluto.
  r.push();
  r.setBlend('add');
  r.setAlpha(0.18 + wave(ctx.tick, 44) * 0.16);
  r.radial(cx, cy, 26, 26, [
    { at: 0, color: alpha(PALETTE.yarn, 0.7) },
    { at: 1, color: alpha(PALETTE.yarn, 0) },
  ]);
  r.pop();

  // Palla: sfera di lana, luce in alto a sinistra come tutto il resto.
  r.ellipse(cx, cy + 0.8, radius, radius, alpha(PALETTE.hotDeep, 0.55));
  r.ellipse(cx, cy, radius, radius, PALETTE.yarn);
  r.push();
  r.setAlpha(0.8);
  r.radial(cx - 3, cy - 3.4, radius * 0.8, radius * 0.8, [
    { at: 0, color: glare(0.6) },
    { at: 1, color: glare(0) },
  ]);
  r.pop();

  // Avvolgimento: tre fasci di fili in direzioni diverse, come un gomitolo vero.
  r.push();
  r.setAlpha(0.55);
  for (let i = -2; i <= 2; i++) {
    const off = i * 3.2;
    r.line([cx - radius + 1, cy + off * 0.6, cx, cy + off, cx + radius - 1, cy + off * 0.6], 1, PALETTE.hotDeep);
    r.line([cx + off * 0.6, cy - radius + 1, cx + off, cy, cx + off * 0.6, cy + radius - 1], 1, alpha(PALETTE.paper, 0.5));
  }
  r.pop();

  // Il capo del filo, che penzola e ondeggia piano.
  const sway = Math.sin(ctx.tick / 18) * 3;
  r.line(
    [cx + radius - 2, cy + 3, cx + radius + 4 + sway, cy + 8, cx + radius + 1 + sway, cy + 13],
    1.2,
    PALETTE.yarn,
  );
}

// ---------------------------------------------------------------- raccolte
/** Moneta d'oro che ruota: disco, spessore, riflesso che gira col disco. */
function drawCoin(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.gold;
  const bob = Math.sin((ctx.tick + ctx.col * 9) / 14) * 3;
  const spin = Math.cos((ctx.tick + ctx.col * 13) / 18);
  const face = Math.abs(spin);
  const cx = x + T / 2;
  const cy = y + T / 2 + bob;
  const rx = Math.max(0.8, 9 * face);

  // Alone e riflesso a terra.
  r.push();
  r.setBlend('add');
  r.setAlpha(0.28);
  r.radial(cx, cy, 17, 17, [
    { at: 0, color: alpha(m.light, 0.55) },
    { at: 1, color: alpha(m.light, 0) },
  ]);
  r.pop();

  // Spessore del disco: si vede quando la moneta è quasi di taglio.
  r.ellipse(cx, cy, rx + 1.6, 11.5, m.dark);
  // Faccia: tre strati concentrici sfalsati verso la luce. Il metallo non ha
  // un gradiente uniforme — ha una zona chiara dove riflette il cielo.
  r.ellipse(cx, cy, rx, 11, m.base);
  r.ellipse(cx - rx * 0.18, cy - 2, rx * 0.78, 8.4, m.light);
  r.ellipse(cx - rx * 0.26, cy - 3.4, rx * 0.42, 4.6, m.spec);
  // Il bordo inferiore resta in ombra: è il lato che guarda a terra.
  r.push();
  r.setAlpha(0.5);
  r.ellipse(cx, cy + 5.5, rx * 0.85, 4, m.dark);
  r.pop();

  if (face > 0.3) {
    // Rilievo inciso al centro, visibile solo quando la faccia è girata verso di noi.
    r.push();
    r.setAlpha(0.45);
    r.ellipse(cx, cy, rx * 0.5, 6, m.dark);
    r.setAlpha(0.85);
    r.line([cx, cy - 4, cx, cy + 4], Math.max(0.7, rx * 0.22), m.spec);
    r.pop();
  }
}

/**
 * Lanterna di checkpoint. Spenta è vetro sporco; accesa è una sorgente di
 * luce vera, con l'alone che si riversa sul terreno intorno.
 */
function drawCheckpoint(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const active = ctx.checkpointActive;
  const glow = wave(ctx.tick, active ? 34 : 110);
  const m = MATERIAL.iron;
  const light = active ? PALETTE.hot : MATERIAL.steel.dark;
  const cx = x + T / 2;

  // Palo di ferro, cilindrico.
  r.gradientRect(
    cx - 3,
    y + 8,
    6,
    T - 8,
    [
      { at: 0, color: m.dark },
      { at: 0.35, color: m.light },
      { at: 0.6, color: m.base },
      { at: 1, color: m.deep },
    ],
    true,
  );

  // Alone: la luce si vede nell'aria prima che nell'oggetto.
  if (active || glow > 0) {
    r.push();
    r.setBlend('add');
    r.setAlpha(active ? 0.3 + glow * 0.4 : 0.08);
    r.radial(cx, y + 10, 34, 34, [
      { at: 0, color: alpha(light, 0.8) },
      { at: 0.5, color: alpha(light, 0.22) },
      { at: 1, color: alpha(light, 0) },
    ]);
    r.pop();
  }

  // Gabbia della lanterna.
  r.gradientRect(cx - 7, y + 2, 14, 14, bodyStops(m));
  r.rect(cx - 8, y + 1, 16, 2, m.light);
  r.rect(cx - 8, y + 15, 16, 2, m.dark);
  // Vetro.
  r.gradientRect(cx - 5, y + 4, 10, 10, [
    { at: 0, color: alpha(light, active ? 1 : 0.35) },
    { at: 1, color: alpha(light, active ? 0.6 : 0.15) },
  ]);
  if (active) {
    r.push();
    r.setBlend('add');
    r.setAlpha(0.6 + glow * 0.4);
    r.radial(cx, y + 9, 6, 6, [
      { at: 0, color: glare(0.95) },
      { at: 1, color: alpha(light, 0) },
    ]);
    r.pop();
  }
  // Riflesso sul vetro: una banda obliqua, sempre nello stesso punto.
  r.push();
  r.setAlpha(0.35);
  r.polygon([cx - 4, y + 12, cx - 1, y + 4, cx + 1, y + 4, cx - 2, y + 12], glare(0.9));
  r.pop();
}

/**
 * Bandiera. L'asta è un cilindro metallico; il drappo è diviso in segmenti
 * che ondeggiano sfasati, ognuno ombreggiato in base a quanto è girato
 * rispetto alla luce — è così che la stoffa sembra avere delle pieghe.
 */
function drawFlag(r: Renderer, x: number, y: number, ctx: TileDrawContext, real: boolean): void {
  const cloth = real ? MATERIAL.grass : MATERIAL.cap;
  const pole = MATERIAL.steel;
  const px = x + 12;

  r.gradientRect(
    px,
    y,
    6,
    T,
    [
      { at: 0, color: pole.dark },
      { at: 0.3, color: pole.light },
      { at: 0.45, color: pole.spec },
      { at: 0.7, color: pole.base },
      { at: 1, color: pole.deep },
    ],
    true,
  );

  const isTop = !ctx.hasFlagAbove;
  if (!isTop) return;

  // Pomello in cima all'asta.
  r.ellipse(px + 3, y - 2, 4, 4, pole.base);
  r.ellipse(px + 2, y - 3, 1.8, 1.8, pole.spec);

  // Drappo: quattro segmenti, ognuno con la sua fase d'onda.
  const t = ctx.tick / 9;
  const segments = 4;
  const segW = 9;
  for (let i = 0; i < segments; i++) {
    const x0 = px + 5 + i * segW;
    const phase = t - i * 0.55;
    const y0 = y + 4 + Math.sin(phase) * 2.6;
    const y1 = y + 4 + Math.sin(phase - 0.55) * 2.6;
    const bottom0 = y0 + 17 - i * 2.2;
    const bottom1 = y1 + 17 - (i + 1) * 2.2;

    // La piega che si allontana dalla luce si scurisce, quella che la prende
    // si schiarisce: il valore viene direttamente dall'onda.
    const fold = Math.cos(phase);
    const tone =
      fold > 0
        ? mix(cloth.base, cloth.light, fold * 0.65)
        : mix(cloth.base, cloth.dark, -fold * 0.7);

    r.polygon([x0, y0, x0 + segW, y1, x0 + segW, bottom1, x0, bottom0], tone);
  }

  if (real) {
    // L'arrivo vero ha una luce sua: è l'unica cosa nel gioco che non mente.
    r.push();
    r.setBlend('add');
    r.setAlpha(0.12 + wave(ctx.tick, 50) * 0.16);
    r.radial(px + 16, y + 14, 46, 40, [
      { at: 0, color: alpha(MATERIAL.grass.spec, 0.6) },
      { at: 1, color: alpha(MATERIAL.grass.spec, 0) },
    ]);
    r.pop();
  }
}

/**
 * Il cero votivo della cappella di 2-11.
 *
 * Deve dire due cose da lontano e in mezzo tick: **dove sta** e **se è acceso**.
 * La prima la dà la colonna di cera, che resta identica in tutti e due gli
 * stati; la seconda la dà la fiamma e soprattutto l'alone, perché è l'alone che
 * si vede con la coda dell'occhio mentre si scappa da un gatto che cade.
 *
 * Il cero spento non viene tolto dal disegno di proposito: è ancora il posto in
 * cui conviene stare fra duecento tick, e nasconderlo vorrebbe dire nascondere
 * al giocatore l'unica arma che ha.
 */
function drawCandle(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const wax = MATERIAL.wax;
  const lit = ctx.candleLit;
  const cx = x + TILE_SIZE / 2;
  const base = y + TILE_SIZE;
  // Altezza consumata: derivata dalla cella, quindi due ceri diversi non sono
  // mai identici e lo stesso cero non cambia mai (vedi le texture dei tile).
  const height = 15 + cellNoise(ctx.col, ctx.row, 5) * 5;
  const top = base - height;

  // Il piattino di ferro: è quello che lo tiene su e che lo fa sembrare posato
  // sul pavimento invece che disegnato sopra.
  r.ellipse(cx, base - 2, 8, 2.6, MATERIAL.iron.dark);
  r.ellipse(cx, base - 3, 7, 2.2, MATERIAL.iron.base);
  r.rect(cx - 7, base - 4, 14, 1, alpha(MATERIAL.iron.light, 0.6));

  // La colonna di cera, con la colata sul fianco in ombra.
  const body = lit ? wax.base : wax.dark;
  r.roundedRect(cx - 3.4, top, 6.8, height - 3, 2, body);
  r.rect(cx - 3.4, top, 2.4, height - 3, alpha(lit ? wax.light : wax.base, 0.55));
  r.rect(cx + 1.6, top, 1.8, height - 3, alpha(wax.deep, 0.4));
  r.push();
  r.setAlpha(0.55);
  r.line([cx + 2.6, top + 3, cx + 3.4, top + 9], 1.6, alpha(wax.light, 0.8));
  r.pop();

  if (!lit) {
    // Spento: lo stoppino carbonizzato e un filo di fumo che sale piano.
    r.line([cx, top, cx + 0.6, top - 3], 1.4, PALETTE.ink);
    r.push();
    r.setAlpha(0.16 + wave(ctx.tick, 70) * 0.1);
    r.line(
      [cx, top - 3, cx + 2.5 - wave(ctx.tick, 40) * 5, top - 10, cx - 1, top - 17],
      1.4,
      PALETTE.steam,
    );
    r.pop();
    return;
  }

  // Acceso: fiamma che respira, e l'alone che la fa vedere da mezzo schermo.
  const flick = wave(ctx.tick, 9);
  const flameY = top - 4 - flick * 2;
  r.push();
  r.setBlend('add');
  r.setAlpha(0.22 + flick * 0.16);
  r.radial(cx, flameY + 3, 30, 30, [
    { at: 0, color: alpha(PALETTE.gold, 0.85) },
    { at: 1, color: alpha(PALETTE.gold, 0) },
  ]);
  r.pop();
  r.ellipse(cx, flameY, 3, 5.4 + flick * 1.6, MATERIAL.gold.base);
  r.ellipse(cx, flameY + 0.6, 1.7, 3.4 + flick, PALETTE.gold);
  r.ellipse(cx, flameY + 1.6, 0.9, 1.8, PALETTE.paper);
}

export { ALL_OPEN };
