import { wave } from '@core/math';
import type { Renderer } from '@engine/render/renderer';
import { TILE_SIZE } from '../config';
import { PALETTE, shade } from '../theme';
import { TILE } from '../tiles';

/**
 * Disegno dei tile.
 *
 * Ogni tile è costruito con le stesse quattro regole, ed è questo che tiene
 * insieme lo stile: base piatta, luce in alto, ombra in basso a destra,
 * un dettaglio che ne racconta la funzione. La texture è deterministica
 * (derivata da riga/colonna): il mondo non "sfarfalla" mai tra un frame e l'altro.
 */

const T = TILE_SIZE;

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
}

/** Rumore deterministico per cella: stessa cella, stessa texture, sempre. */
const cellNoise = (c: number, r: number, salt = 0): number => {
  const x = Math.sin(c * 12.9898 + r * 78.233 + salt * 3.7) * 43758.5453;
  return x - Math.floor(x);
};

export function drawTile(r: Renderer, tile: string, x: number, y: number, ctx: TileDrawContext): void {
  switch (tile) {
    case TILE.GROUND:
      drawGround(r, x, y, ctx);
      break;
    case TILE.PIPE:
      drawPipe(r, x, y);
      break;
    case TILE.PRIZE:
    case TILE.HONEST:
      drawPrizeBlock(r, x, y, ctx.tick);
      break;
    case TILE.USED:
      drawUsedBlock(r, x, y);
      break;
    case TILE.TRAP_BRICK:
      drawBrick(r, x, y);
      break;
    case TILE.CRUMBLE:
      drawCrumble(r, x, y, ctx);
      break;
    case TILE.INVISIBLE:
      if (ctx.revealed) drawRevealedBlock(r, x, y, ctx.tick);
      break;
    case TILE.SPIKES:
      drawSpikes(r, x, y);
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

// ---------------------------------------------------------------- terreno
function drawGround(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  r.rect(x, y, T, T, PALETTE.dirt);

  // Granuli di terra: fissi per cella.
  r.push();
  r.setAlpha(0.16);
  for (let i = 0; i < 5; i++) {
    const nx = cellNoise(ctx.col, ctx.row, i) * (T - 6);
    const ny = 8 + cellNoise(ctx.col, ctx.row, i + 40) * (T - 14);
    r.rect(x + nx, y + ny, 3, 3, i % 2 ? PALETTE.dirtDark : PALETTE.paper);
  }
  r.pop();

  // Manto erboso con ciuffi.
  r.rect(x, y, T, 7, PALETTE.grass);
  r.rect(x, y, T, 2, PALETTE.grassLight);
  for (let i = 0; i < 3; i++) {
    if (cellNoise(ctx.col, ctx.row, i + 11) > 0.62) {
      r.rect(x + 3 + i * 10, y - 3, 3, 4, PALETTE.grass);
    }
  }

  // Occlusione ambientale: bordo destro e base in ombra.
  r.rect(x, y + T - 3, T, 3, shade(0.2));
  r.rect(x + T - 3, y + 7, 3, T - 7, shade(0.16));
}

// ---------------------------------------------------------------- tubo
function drawPipe(r: Renderer, x: number, y: number): void {
  r.rect(x, y, T, T, PALETTE.pipe);
  r.rect(x + 4, y, 8, T, PALETTE.pipeLight);
  r.rect(x + 2, y, 2, T, shade(0.08));
  r.rect(x + T - 7, y, 7, T, shade(0.24));
  r.push();
  r.setAlpha(0.35);
  r.rect(x + 5, y, 3, T, PALETTE.paper);
  r.pop();
}

// ---------------------------------------------------------------- blocchi
function drawPrizeBlock(r: Renderer, x: number, y: number, tick: number): void {
  const pulse = wave(tick, 46);
  r.rect(x, y, T, T, PALETTE.gold);

  // Cornice a rilievo.
  r.rect(x, y, T, 3, '#ffe9a8');
  r.rect(x, y, 3, T, '#ffe9a8');
  r.rect(x, y + T - 3, T, 3, PALETTE.goldDeep);
  r.rect(x + T - 3, y, 3, T, PALETTE.goldDeep);
  // Borchie agli angoli.
  for (const [dx, dy] of [[4, 4], [T - 8, 4], [4, T - 8], [T - 8, T - 8]] as const) {
    r.rect(x + dx, y + dy, 3, 3, PALETTE.goldDeep);
  }

  // Riflesso che scorre: fa "vivere" il blocco senza distrarre.
  r.push();
  r.setAlpha(0.18 + pulse * 0.22);
  r.polygon(
    [x + 6 + pulse * 12, y, x + 12 + pulse * 12, y, x + 4 + pulse * 12, y + T, x - 2 + pulse * 12, y + T],
    '#ffffff',
  );
  r.pop();

  r.text('?', x + T / 2, y + T / 2 + 1, {
    color: pulse > 0.5 ? '#7a4d10' : '#5c3a0a',
    size: 20,
    align: 'center',
    baseline: 'middle',
  });
}

function drawUsedBlock(r: Renderer, x: number, y: number): void {
  r.rect(x, y, T, T, PALETTE.used);
  r.rect(x + 3, y + 3, T - 6, T - 6, shade(0.28));
  r.rect(x, y, T, 2, 'rgba(255,255,255,0.12)');
}

function drawBrick(r: Renderer, x: number, y: number): void {
  r.rect(x, y, T, T, PALETTE.brick);
  r.rect(x, y, T, 2, 'rgba(255,255,255,0.16)');
  // Fughe: due corsi sfalsati.
  r.rect(x, y + 14, T, 3, shade(0.22));
  r.rect(x, y + T - 2, T, 2, shade(0.22));
  r.rect(x + 14, y, 3, 14, shade(0.22));
  r.rect(x + 6, y + 17, 3, 15, shade(0.22));
}

function drawRevealedBlock(r: Renderer, x: number, y: number, tick: number): void {
  const pulse = wave(tick, 30);
  r.rect(x, y, T, T, PALETTE.paper);
  r.rect(x + 4, y + 4, T - 8, T - 8, PALETTE.hot);
  r.push();
  r.setAlpha(0.25 + pulse * 0.3);
  r.rect(x - 2, y - 2, T + 4, T + 4, PALETTE.hot);
  r.pop();
  r.text('!', x + T / 2, y + T / 2 + 1, {
    color: '#ffffff',
    size: 17,
    align: 'center',
    baseline: 'middle',
  });
}

function drawCrumble(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  // Quando sta per cedere trema e si scurisce: il preavviso è leale.
  const shake = ctx.crumbling ? (Math.floor(ctx.tick / 2) % 2 ? 1.5 : -1.5) : 0;
  const px = x + shake;
  const h = T - 8;

  r.rect(px, y, T, h, PALETTE.wood);
  r.rect(px, y, T, 2, 'rgba(255,255,255,0.14)');
  r.rect(px, y + h - 3, T, 3, shade(0.3));

  // Venature del legno.
  r.push();
  r.setAlpha(0.22);
  r.rect(px + 3, y + 7, T - 8, 1.5, PALETTE.dirtDark);
  r.rect(px + 6, y + 14, T - 12, 1.5, PALETTE.dirtDark);
  r.pop();

  if (ctx.crumbling) {
    r.push();
    r.setAlpha(0.35);
    r.rect(px, y, T, h, PALETTE.hot);
    r.pop();
  }
}

// ---------------------------------------------------------------- pericoli
function drawSpikes(r: Renderer, x: number, y: number): void {
  // Base metallica.
  r.rect(x, y + T - 5, T, 5, PALETTE.stoneDark);
  for (let i = 0; i < 3; i++) {
    const bx = x + i * 11;
    r.polygon([bx, y + T, bx + 5.5, y + 5, bx + 11, y + T], PALETTE.stone);
    // Sfaccettatura: metà lama in ombra, dà volume.
    r.polygon([bx + 5.5, y + 5, bx + 11, y + T, bx + 5.5, y + T], shade(0.22));
    r.push();
    r.setAlpha(0.7);
    r.rect(bx + 4.5, y + 7, 1.5, 8, '#ffffff');
    r.pop();
  }
}

// ---------------------------------------------------------------- raccolte
function drawCoin(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const bob = Math.sin((ctx.tick + ctx.col * 9) / 12) * 3;
  // Rotazione simulata schiacciando la larghezza.
  const spin = Math.abs(Math.cos((ctx.tick + ctx.col * 13) / 16));
  const cx = x + T / 2;
  const cy = y + T / 2 + bob;

  r.push();
  r.setAlpha(0.18);
  r.ellipse(cx, cy, 11 * spin + 2, 13, PALETTE.gold);
  r.pop();

  r.ellipse(cx, cy, Math.max(1.5, 8 * spin), 11, PALETTE.gold);
  if (spin > 0.35) {
    r.ellipse(cx, cy, Math.max(1, 3 * spin), 6, PALETTE.goldDeep);
    r.push();
    r.setAlpha(0.8);
    r.rect(cx - 3 * spin, cy - 6, 1.5 * spin, 5, '#fff6d6');
    r.pop();
  }
}

function drawCheckpoint(r: Renderer, x: number, y: number, ctx: TileDrawContext): void {
  const active = ctx.checkpointActive;
  const glow = wave(ctx.tick, active ? 34 : 90);

  // Palo.
  r.rect(x + 14, y, 4, T, PALETTE.stoneDark);
  // Lanterna.
  const color = active ? PALETTE.hot : PALETTE.stone;
  r.push();
  r.setAlpha(0.2 + glow * (active ? 0.5 : 0.15));
  r.ellipse(x + 16, y + 8, 13, 13, color);
  r.pop();
  r.rect(x + 11, y + 3, 10, 10, color);
  r.rect(x + 13, y + 5, 6, 6, active ? '#ffffff' : shade(0.3));
}

function drawFlag(r: Renderer, x: number, y: number, ctx: TileDrawContext, real: boolean): void {
  const color = real ? PALETTE.grass : PALETTE.hot;

  // Asta: il tile si ripete verticalmente, quindi ogni cella disegna il suo pezzo.
  r.rect(x + 13, y, 6, T, PALETTE.paper);
  r.rect(x + 13, y, 2, T, shade(0.12));

  // Il drappo lo disegna solo la cella più in alto della bandiera.
  const isTop = !ctx.hasFlagAbove;
  if (!isTop) return;

  // Sventolio a tre segmenti: molto più vivo di un triangolo fisso.
  const t = ctx.tick / 9;
  const segments = 3;
  const segW = 10;
  for (let i = 0; i < segments; i++) {
    const x0 = x + 19 + i * segW;
    const y0 = y + 4 + Math.sin(t + i * 0.6) * 2.5;
    const y1 = y + 4 + Math.sin(t + (i + 1) * 0.6) * 2.5;
    const bottom0 = y0 + 16 - i * 4;
    const bottom1 = y1 + 16 - (i + 1) * 4;
    r.polygon([x0, y0, x0 + segW, y1, x0 + segW, bottom1, x0, bottom0], color);
    if (i === 1) {
      r.push();
      r.setAlpha(0.18);
      r.polygon([x0, y0, x0 + segW, y1, x0 + segW, bottom1, x0, bottom0], '#000000');
      r.pop();
    }
  }

  if (real) {
    // L'arrivo vero ha un alone: è l'unica cosa nel gioco che non mente.
    r.push();
    r.setAlpha(0.1 + wave(ctx.tick, 50) * 0.14);
    r.ellipse(x + 16, y + 14, 40, 34, PALETTE.grassLight);
    r.pop();
  }
}
