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
  /** Per il blocco invisibile: già scoperto? */
  revealed: boolean;
  /** Per la piattaforma: sta per sbriciolarsi? */
  crumbling: boolean;
  /** Per il checkpoint: già preso? */
  checkpointActive: boolean;
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
    case TILE.FAKE_GROUND:
      // Identico al terreno vero: è tutto il punto della trappola.
      drawGround(r, x, y, ctx);
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
      drawSpring(r, x, y, ctx);
      break;
    case TILE.COIN:
      drawCoin(r, x, y, ctx);
      break;
    case TILE.CHECKPOINT:
      drawCheckpoint(r, x, y, ctx);
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
function drawGround(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
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

  if (ctx.open.up) drawGrassMantle(r, x, y, ctx);
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
  r.gradientRect(x, y, T, T, bodyStops(rock));

  // Facce di frattura: due poligoni che spezzano la superficie in piani.
  const n = cellNoise(ctx.col, ctx.row, 5);
  r.push();
  r.setAlpha(0.35);
  r.polygon([x, y + T * n, x + T * 0.6, y, x + T, y + 6, x + T, y + T, x, y + T], alpha(rock.dark, 0.8));
  r.setAlpha(0.28);
  r.polygon([x, y, x + T * 0.55, y, x + T * 0.2, y + T * 0.5, x, y + T * 0.35], rock.light);
  r.pop();

  // Crepe.
  r.push();
  r.setAlpha(0.5);
  const cx = x + 6 + n * (T - 14);
  r.line([cx, y + 3, cx + 4 - n * 8, y + 13, cx + 2, y + T - 5], 1.2, rock.deep);
  r.pop();

  speckle(r, x, y, ctx, 4, MATERIAL.iron, 4);
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
    r.setAlpha(0.55);
    r.radial(tipX, tipY + 2, 3, 5, [
      { at: 0, color: alpha(m.spec, 0.9) },
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

/** Feritoia da cui escono gli spuntoni a scatto: si vede, ed è apposta. */
function drawSpikeSocket(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.iron;
  r.gradientRect(x, y + T - 6, T, 6, bodyStops(m));
  for (let i = 0; i < 3; i++) {
    const sx = x + 3 + i * (T / 3);
    r.rect(sx, y + T - 5, T / 3 - 6, 2.5, m.deep);
    r.rect(sx, y + T - 5, T / 3 - 6, 0.8, alpha(m.light, 0.4));
  }
  // Quando è carica, la feritoia si illumina: il preavviso è leale.
  if (ctx.extension > 0 && ctx.extension < 1) {
    r.push();
    r.setBlend('add');
    r.setAlpha(0.4);
    r.radial(x + T / 2, y + T - 4, T * 0.6, 8, [
      { at: 0, color: alpha(PALETTE.hot, 0.7) },
      { at: 1, color: alpha(PALETTE.hot, 0) },
    ]);
    r.pop();
  }
}

/** Molla d'acciaio: si comprime quando la carichi e ti spara in alto. */
function drawSpring(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const m = MATERIAL.steel;
  const compression = ctx.extension;
  const top = y + T - 10 + compression * 8;

  // Piastra di base.
  r.gradientRect(x + 2, y + T - 5, T - 4, 5, bodyStops(MATERIAL.iron));

  // Spire: si stringono quando la molla è compressa.
  const coils = 4;
  const span = y + T - 6 - top;
  for (let i = 0; i < coils; i++) {
    const cy = top + (i / coils) * span;
    r.ellipse(x + T / 2, cy, T / 2 - 5, 2.6, m.dark);
    r.ellipse(x + T / 2, cy - 0.8, T / 2 - 5.5, 2, m.base);
    r.ellipse(x + T / 2 - 3, cy - 1.4, 4, 0.9, alpha(m.spec, 0.6));
  }

  // Piattello superiore, quello che ti lancia.
  r.gradientRect(x + 1, top - 5, T - 2, 6, [
    { at: 0, color: m.light },
    { at: 0.4, color: m.base },
    { at: 1, color: m.dark },
  ]);
  r.rect(x + 1, top - 5, T - 2, 1.2, alpha(m.spec, 0.8));
  r.push();
  r.setAlpha(0.5);
  r.rect(x + 4, top - 3.5, T - 8, 1, PALETTE.hot);
  r.pop();
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

export { ALL_OPEN };
