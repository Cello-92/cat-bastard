import type { BlendMode, Renderer, Stop, TextStyle } from './renderer';

/**
 * Backend Canvas 2D.
 *
 * Due scelte reggono la resa realistica:
 *
 * 1. **Rasterizzazione oversampled.** Il gioco ragiona sempre in pixel logici
 *    (800×480: la fisica e le mappe dipendono da quella misura), ma il canvas
 *    ha una superficie fino a 2× più densa e una trasformazione di base che
 *    la nasconde. Curve, gradienti e bordi obliqui restano puliti invece di
 *    scalettare, e nessuna riga di gameplay se ne accorge.
 *
 * 2. **Gradienti riusati.** Un `CanvasGradient` va creato in coordinate
 *    assolute, quindi ricrearlo per ogni tile a ogni frame sarebbe migliaia di
 *    allocazioni al secondo. Qui i gradienti si creano una volta in coordinate
 *    locali (origine 0,0) e si riusano traslando il contesto prima del
 *    riempimento: stesso risultato, allocazioni quasi zero.
 */

const FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const TAU = Math.PI * 2;

/** Oltre 2× la resa non migliora e il costo di riempimento raddoppia. */
const MAX_PIXEL_RATIO = 2;

const BLEND: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  add: 'lighter',
  multiply: 'multiply',
  screen: 'screen',
};

export class Canvas2DRenderer implements Renderer {
  readonly width: number;
  readonly height: number;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly scaleFactor: number;
  private readonly gradients = new Map<string, CanvasGradient>();
  private vignetteCache: CanvasGradient | null = null;

  constructor(canvas: HTMLCanvasElement, width: number, height: number, pixelRatio?: number) {
    this.width = width;
    this.height = height;

    const dpr = pixelRatio ?? (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
    this.scaleFactor = Math.max(1, Math.min(MAX_PIXEL_RATIO, dpr));

    canvas.width = Math.round(width * this.scaleFactor);
    canvas.height = Math.round(height * this.scaleFactor);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D non disponibile su questo browser');
    this.ctx = ctx;
    // Le superfici sono disegnate, non campionate da texture: l'interpolazione
    // serve, ed è ciò che toglie la scalettatura dai bordi curvi.
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
  }

  begin(): void {
    this.resetTransform();
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.filter = 'none';
    this.ctx.shadowColor = 'rgba(0,0,0,0)';
    this.ctx.shadowBlur = 0;
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

  rotate(radians: number): void {
    this.ctx.rotate(radians);
  }

  setAlpha(alpha: number): void {
    this.ctx.globalAlpha = alpha;
  }

  setBlend(mode: BlendMode): void {
    this.ctx.globalCompositeOperation = BLEND[mode];
  }

  setBlur(px: number): void {
    // Il filtro lavora in pixel del dispositivo: va scalato per restare
    // coerente con le distanze logiche usate dal gioco.
    this.ctx.filter = px <= 0 ? 'none' : `blur(${(px * this.scaleFactor).toFixed(2)}px)`;
  }

  setShadow(blur: number, color: string, offsetX = 0, offsetY = 0): void {
    this.ctx.shadowBlur = blur;
    this.ctx.shadowColor = color;
    this.ctx.shadowOffsetX = offsetX;
    this.ctx.shadowOffsetY = offsetY;
  }

  clipRect(x: number, y: number, w: number, h: number): void {
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }

  clear(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  // ---------------------------------------------------------------- superfici
  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  roundedRect(x: number, y: number, w: number, h: number, radius: number, color: string): void {
    const r = Math.max(0, Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2));
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, r);
    this.ctx.arcTo(x + w, y + h, x, y + h, r);
    this.ctx.arcTo(x, y + h, x, y, r);
    this.ctx.arcTo(x, y, x + w, y, r);
    this.ctx.closePath();
    this.ctx.fill();
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, rotation = 0): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), rotation, 0, TAU);
    this.ctx.fill();
  }

  dome(cx: number, cy: number, r: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, Math.abs(r), Math.PI, 0);
    this.ctx.fill();
  }

  polygon(points: readonly number[], color: string): void {
    if (points.length < 6) return;
    this.ctx.fillStyle = color;
    this.tracePolygon(points);
    this.ctx.fill();
  }

  /**
   * Poligono con i lati raccordati (Catmull-Rom convertita in Bézier cubiche).
   * Serve a tutto ciò che in natura non ha spigoli: nuvole, chiome, pelo,
   * profili di roccia erosa.
   */
  blob(points: readonly number[], color: string): void {
    const n = points.length / 2;
    if (n < 3) {
      this.polygon(points, color);
      return;
    }

    const px = (i: number): number => points[((i % n) + n) % n * 2] ?? 0;
    const py = (i: number): number => points[((i % n) + n) % n * 2 + 1] ?? 0;

    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(px(0), py(0));
    for (let i = 0; i < n; i++) {
      const x0 = px(i - 1);
      const y0 = py(i - 1);
      const x1 = px(i);
      const y1 = py(i);
      const x2 = px(i + 1);
      const y2 = py(i + 1);
      const x3 = px(i + 2);
      const y3 = py(i + 2);
      this.ctx.bezierCurveTo(
        x1 + (x2 - x0) / 6,
        y1 + (y2 - y0) / 6,
        x2 - (x3 - x1) / 6,
        y2 - (y3 - y1) / 6,
        x2,
        y2,
      );
    }
    this.ctx.closePath();
    this.ctx.fill();
  }

  // ---------------------------------------------------------------- gradienti
  gradientRect(
    x: number,
    y: number,
    w: number,
    h: number,
    stops: readonly Stop[],
    horizontal = false,
  ): void {
    if (w === 0 || h === 0 || stops.length === 0) return;

    const key = `l${horizontal ? w : h}|${horizontal ? 1 : 0}|${keyOf(stops)}`;
    let gradient = this.gradients.get(key);
    if (!gradient) {
      gradient = horizontal
        ? this.ctx.createLinearGradient(0, 0, w, 0)
        : this.ctx.createLinearGradient(0, 0, 0, h);
      for (const stop of stops) gradient.addColorStop(clamp01(stop.at), stop.color);
      this.gradients.set(key, gradient);
    }

    // Il gradiente vive in coordinate locali: si porta l'origine sul rettangolo.
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.restore();
  }

  radial(cx: number, cy: number, rx: number, ry: number, stops: readonly Stop[]): void {
    if (rx <= 0 || ry <= 0 || stops.length === 0) return;

    // Un solo gradiente unitario per combinazione di colori: la forma la dà
    // la scala del contesto, non una nuova allocazione.
    const key = `r${keyOf(stops)}`;
    let gradient = this.gradients.get(key);
    if (!gradient) {
      gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const stop of stops) gradient.addColorStop(clamp01(stop.at), stop.color);
      this.gradients.set(key, gradient);
    }

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.scale(rx, ry);
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 1, 0, TAU);
    this.ctx.fill();
    this.ctx.restore();
  }

  // ---------------------------------------------------------------- tratti
  line(points: readonly number[], width: number, color: string, closed = false): void {
    if (points.length < 4 || width <= 0) return;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0] ?? 0, points[1] ?? 0);
    for (let i = 2; i < points.length - 1; i += 2) {
      this.ctx.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
    }
    if (closed) this.ctx.closePath();
    this.ctx.stroke();
  }

  text(value: string, x: number, y: number, style: TextStyle): void {
    const { color, size, align = 'left', baseline = 'top', weight = 'bold' } = style;
    this.ctx.fillStyle = color;
    this.ctx.font = `${weight === 'bold' ? 700 : 400} ${size}px ${FONT_STACK}`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline === 'middle' ? 'middle' : baseline;
    this.ctx.fillText(value, x, y);
  }

  vignette(strength: number): void {
    if (strength <= 0) return;
    if (!this.vignetteCache) {
      const cx = this.width / 2;
      const cy = this.height / 2;
      const gradient = this.ctx.createRadialGradient(
        cx,
        cy,
        this.height * 0.3,
        cx,
        cy,
        this.width * 0.76,
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.6, 'rgba(0,0,0,0.35)');
      gradient.addColorStop(1, 'rgba(2,4,10,1)');
      this.vignetteCache = gradient;
    }
    this.ctx.save();
    this.resetTransform();
    this.ctx.globalAlpha = strength;
    this.ctx.fillStyle = this.vignetteCache;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  /** Torna alla trasformazione di base: quella che nasconde l'oversampling. */
  private resetTransform(): void {
    this.ctx.setTransform(this.scaleFactor, 0, 0, this.scaleFactor, 0, 0);
  }

  private tracePolygon(points: readonly number[]): void {
    this.ctx.beginPath();
    this.ctx.moveTo(points[0] ?? 0, points[1] ?? 0);
    for (let i = 2; i < points.length - 1; i += 2) {
      this.ctx.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
    }
    this.ctx.closePath();
  }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Chiave di cache di un gradiente: le sue tappe, in ordine. */
const keyOf = (stops: readonly Stop[]): string => {
  let key = '';
  for (const stop of stops) key += `${stop.at}:${stop.color};`;
  return key;
};
