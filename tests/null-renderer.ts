import type { BlendMode, Renderer, Stop, TextStyle } from '@engine/render/renderer';

/**
 * Renderer che non disegna niente ma controlla come lo si sta disegnando.
 *
 * Serve a eseguire tutto il codice di disegno fuori dal browser: se una
 * funzione di draw ha un bug (campo mancante, NaN, poligono malformato,
 * gradiente con tappe fuori scala) salta fuori qui invece che a schermo nero
 * davanti al giocatore.
 */
export class NullRenderer implements Renderer {
  readonly width: number;
  readonly height: number;

  calls = 0;
  private depth = 0;
  private readonly badNumbers: string[] = [];

  constructor(width = 800, height = 480) {
    this.width = width;
    this.height = height;
  }

  /** Errori raccolti durante il frame: coordinate NaN/Infinity e push/pop sbilanciati. */
  get problems(): readonly string[] {
    return this.badNumbers;
  }

  get transformDepth(): number {
    return this.depth;
  }

  begin(): void {
    this.calls++;
  }

  end(): void {
    this.calls++;
  }

  push(): void {
    this.depth++;
  }

  pop(): void {
    this.depth--;
    if (this.depth < 0) this.badNumbers.push('pop() senza push()');
  }

  translate(x: number, y: number): void {
    this.check('translate', x, y);
  }

  scale(x: number, y: number): void {
    this.check('scale', x, y);
  }

  rotate(radians: number): void {
    this.check('rotate', radians);
  }

  setAlpha(alpha: number): void {
    this.check('setAlpha', alpha);
    if (alpha < 0 || alpha > 1) this.badNumbers.push(`setAlpha fuori range: ${alpha}`);
  }

  setBlend(mode: BlendMode): void {
    this.calls++;
    if (!['normal', 'add', 'multiply', 'screen'].includes(mode)) {
      this.badNumbers.push(`setBlend sconosciuto: ${mode}`);
    }
  }

  setBlur(px: number): void {
    this.check('setBlur', px);
    if (px < 0) this.badNumbers.push(`setBlur negativo: ${px}`);
  }

  setShadow(blur: number, _color: string, offsetX = 0, offsetY = 0): void {
    this.check('setShadow', blur, offsetX, offsetY);
    if (blur < 0) this.badNumbers.push(`setShadow con blur negativo: ${blur}`);
  }

  clipRect(x: number, y: number, w: number, h: number): void {
    this.check('clipRect', x, y, w, h);
  }

  clear(_color: string): void {
    this.calls++;
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.check('rect', x, y, w, h);
  }

  roundedRect(x: number, y: number, w: number, h: number, radius: number): void {
    this.check('roundedRect', x, y, w, h, radius);
    if (radius < 0) this.badNumbers.push(`roundedRect con raggio negativo: ${radius}`);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, _color: string, rotation = 0): void {
    this.check('ellipse', cx, cy, rx, ry, rotation);
    if (rx < 0 || ry < 0) this.badNumbers.push(`ellipse con raggio negativo: ${rx},${ry}`);
  }

  dome(cx: number, cy: number, r: number): void {
    this.check('dome', cx, cy, r);
    if (r < 0) this.badNumbers.push(`dome con raggio negativo: ${r}`);
  }

  polygon(points: readonly number[]): void {
    this.check('polygon', ...points);
    if (points.length % 2 !== 0) this.badNumbers.push('polygon con numero dispari di coordinate');
  }

  blob(points: readonly number[]): void {
    this.check('blob', ...points);
    if (points.length % 2 !== 0) this.badNumbers.push('blob con numero dispari di coordinate');
  }

  gradientRect(x: number, y: number, w: number, h: number, stops: readonly Stop[]): void {
    this.check('gradientRect', x, y, w, h);
    this.checkStops('gradientRect', stops);
  }

  radial(cx: number, cy: number, rx: number, ry: number, stops: readonly Stop[]): void {
    this.check('radial', cx, cy, rx, ry);
    if (rx < 0 || ry < 0) this.badNumbers.push(`radial con raggio negativo: ${rx},${ry}`);
    this.checkStops('radial', stops);
  }

  line(points: readonly number[], width: number): void {
    this.check('line', width, ...points);
    if (width < 0) this.badNumbers.push(`line con spessore negativo: ${width}`);
  }

  text(value: string, x: number, y: number, style: TextStyle): void {
    this.check('text', x, y, style.size);
    if (typeof value !== 'string') this.badNumbers.push('text con valore non stringa');
  }

  vignette(strength: number): void {
    this.check('vignette', strength);
  }

  private checkStops(label: string, stops: readonly Stop[]): void {
    if (stops.length === 0) {
      this.badNumbers.push(`${label}: gradiente senza tappe`);
      return;
    }
    for (const stop of stops) {
      if (!Number.isFinite(stop.at) || stop.at < 0 || stop.at > 1) {
        this.badNumbers.push(`${label}: tappa fuori da [0,1] (${stop.at})`);
      }
      if (typeof stop.color !== 'string' || stop.color.length === 0) {
        this.badNumbers.push(`${label}: tappa senza colore`);
      }
    }
  }

  private check(label: string, ...values: number[]): void {
    this.calls++;
    for (const v of values) {
      if (!Number.isFinite(v)) {
        this.badNumbers.push(`${label}: valore non finito (${v})`);
        return;
      }
    }
  }
}
