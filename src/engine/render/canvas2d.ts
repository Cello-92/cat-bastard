import type { Renderer, TextStyle } from './renderer';

/**
 * Backend Canvas 2D.
 *
 * Basta e avanza per un platform a tile a 60fps: il collo di bottiglia di
 * questo gioco non è mai stato la GPU. Il canvas ha una risoluzione logica
 * fissa e viene scalato via CSS, così il pixel-art look resta coerente su
 * qualunque schermo.
 */

const FONT_STACK = 'ui-monospace, "SF Mono", "Courier New", monospace';
const TAU = Math.PI * 2;

export class Canvas2DRenderer implements Renderer {
  readonly width: number;
  readonly height: number;

  private readonly ctx: CanvasRenderingContext2D;
  private vignetteCache: CanvasGradient | null = null;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.width = width;
    this.height = height;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D non disponibile su questo browser');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  begin(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
  }

  end(): void {
    /* Canvas 2D disegna immediatamente: niente da svuotare. */
  }

  push(): void {
    this.ctx.save();
  }

  pop(): void {
    this.ctx.restore();
  }

  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }

  scale(x: number, y: number): void {
    this.ctx.scale(x, y);
  }

  setAlpha(alpha: number): void {
    this.ctx.globalAlpha = alpha;
  }

  clear(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  verticalGradient(x: number, y: number, w: number, h: number, from: string, to: string): void {
    const gradient = this.ctx.createLinearGradient(0, y, 0, y + h);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x, y, w, h);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    this.ctx.fill();
  }

  dome(cx: number, cy: number, r: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, Math.PI, 0);
    this.ctx.fill();
  }

  polygon(points: readonly number[], color: string): void {
    if (points.length < 6) return;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0] ?? 0, points[1] ?? 0);
    for (let i = 2; i < points.length - 1; i += 2) {
      this.ctx.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
    }
    this.ctx.closePath();
    this.ctx.fill();
  }

  text(value: string, x: number, y: number, style: TextStyle): void {
    const { color, size, align = 'left', baseline = 'top', weight = 'bold' } = style;
    this.ctx.fillStyle = color;
    this.ctx.font = `${weight} ${size}px ${FONT_STACK}`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline === 'middle' ? 'middle' : baseline;
    this.ctx.fillText(value, x, y);
  }

  vignette(strength: number): void {
    if (strength <= 0) return;
    if (!this.vignetteCache) {
      const cx = this.width / 2;
      const cy = this.height / 2;
      const gradient = this.ctx.createRadialGradient(cx, cy, this.height * 0.32, cx, cy, this.width * 0.72);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,1)');
      this.vignetteCache = gradient;
    }
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = strength;
    this.ctx.fillStyle = this.vignetteCache;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }
}
