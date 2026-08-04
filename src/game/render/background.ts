import type { Renderer } from '@engine/render/renderer';
import { SKIES, type SkyName } from '../theme';

/**
 * Sfondo a parallasse su cinque piani.
 *
 * Le regole che tengono insieme la profondità:
 *  - più un piano è lontano, più è lento, più è desaturato, meno contrasta;
 *  - niente si muove alla stessa velocità del terreno tranne il terreno;
 *  - gli elementi si ripetono con modulo, così il mondo non finisce mai.
 */

interface Layer {
  /** 0 = fermo all'infinito, 1 = si muove col terreno. */
  speed: number;
  /** Distanza orizzontale tra due elementi. */
  spacing: number;
}

const STARS: Layer = { speed: 0.06, spacing: 1 };
const FAR_HILLS: Layer = { speed: 0.12, spacing: 340 };
const MID_HILLS: Layer = { speed: 0.25, spacing: 260 };
const CLOUDS: Layer = { speed: 0.45, spacing: 340 };
const NEAR_BUSHES: Layer = { speed: 0.62, spacing: 190 };

/** Rumore deterministico: lo stesso seme dà sempre lo stesso paesaggio. */
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/** Posizione ripetuta con modulo, per un piano infinito. */
const tileX = (i: number, camX: number, layer: Layer, offset = 0): number =>
  i * layer.spacing - ((camX * layer.speed + offset) % layer.spacing) - layer.spacing;

export function drawBackground(r: Renderer, camX: number, sky: SkyName, tick: number): void {
  const theme = SKIES[sky];
  const { width: W, height: H } = r;

  // --- piano 0: cielo
  r.verticalGradient(0, 0, W, H, theme.top, theme.bottom);

  // --- piano 1: stelle (solo di notte) o sole/luna
  if (sky === 'night') {
    r.push();
    for (let i = 0; i < 70; i++) {
      const sx = (hash(i) * W * 3 - camX * STARS.speed) % (W + 40);
      const sy = hash(i + 99) * H * 0.55;
      const twinkle = 0.25 + Math.abs(Math.sin(tick / 40 + i)) * 0.65;
      r.setAlpha(twinkle);
      const size = hash(i + 7) > 0.85 ? 2 : 1;
      r.rect(sx < 0 ? sx + W + 40 : sx, sy, size, size, '#ffffff');
    }
    r.pop();
    drawOrb(r, W * 0.78, H * 0.2, 34, 'rgba(226,232,255,0.9)', 'rgba(180,200,255,0.14)');
  } else if (sky === 'sunset') {
    drawOrb(r, W * 0.7, H * 0.34, 52, 'rgba(255,236,190,0.95)', 'rgba(255,150,80,0.18)');
  } else if (sky === 'day') {
    drawOrb(r, W * 0.82, H * 0.16, 40, 'rgba(255,250,220,0.9)', 'rgba(255,240,170,0.16)');
  }

  // --- piano 2: colline lontane
  r.push();
  r.setAlpha(0.55);
  for (let i = 0; i < 8; i++) {
    const x = tileX(i, camX, FAR_HILLS);
    const height = 130 + hash(i) * 60;
    r.dome(x + FAR_HILLS.spacing / 2, H - 84, height, theme.hills);
  }
  r.pop();

  // --- piano 3: colline vicine, più scure e più basse
  r.push();
  r.setAlpha(0.85);
  for (let i = 0; i < 10; i++) {
    const x = tileX(i, camX, MID_HILLS, 90);
    r.dome(x + MID_HILLS.spacing / 2, H - 62, 100 + hash(i + 3) * 42, theme.hills);
  }
  r.pop();

  // --- piano 4: nuvole
  for (let i = 0; i < 9; i++) {
    const x = tileX(i, camX, CLOUDS);
    const y = 42 + (i % 3) * 46 + Math.sin(tick / 90 + i) * 4;
    drawCloud(r, x, y, 0.85 + hash(i + 21) * 0.5, theme.clouds);
  }

  // --- piano 5: cespugli in silhouette, appena sopra il terreno
  r.push();
  r.setAlpha(0.28);
  for (let i = 0; i < 12; i++) {
    const x = tileX(i, camX, NEAR_BUSHES, 40);
    const size = 26 + hash(i + 55) * 18;
    r.dome(x + 30, H - 96, size, '#0b0713');
    r.dome(x + 30 + size * 0.7, H - 96, size * 0.7, '#0b0713');
    r.dome(x + 30 - size * 0.7, H - 96, size * 0.6, '#0b0713');
  }
  r.pop();

  // Foschia sul fondo: stacca il livello giocabile dallo sfondo.
  r.push();
  r.setAlpha(0.35);
  r.verticalGradient(0, H - 190, W, 190, 'rgba(0,0,0,0)', theme.bottom);
  r.pop();
}

/** Sole / luna con alone morbido. */
function drawOrb(r: Renderer, x: number, y: number, radius: number, core: string, glow: string): void {
  r.push();
  for (let i = 4; i >= 1; i--) {
    r.setAlpha(0.13);
    r.ellipse(x, y, radius * (1 + i * 0.55), radius * (1 + i * 0.55), glow);
  }
  r.setAlpha(1);
  r.ellipse(x, y, radius, radius, core);
  r.pop();
}

function drawCloud(r: Renderer, x: number, y: number, scale: number, color: string): void {
  r.ellipse(x, y, 22 * scale, 15 * scale, color);
  r.ellipse(x + 24 * scale, y - 9 * scale, 28 * scale, 20 * scale, color);
  r.ellipse(x + 52 * scale, y, 20 * scale, 14 * scale, color);
  r.ellipse(x + 26 * scale, y + 6 * scale, 34 * scale, 11 * scale, color);
}
