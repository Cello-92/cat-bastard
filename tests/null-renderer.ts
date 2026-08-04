import type { Renderer, TextStyle } from '@engine/render/renderer';

/**
 * Renderer che non disegna niente ma conta le chiamate.
 *
 * Serve a eseguire tutto il codice di disegno fuori dal browser: se una
 * funzione di draw ha un bug (campo mancante, NaN, poligono malformato)
 * salta fuori qui invece che a schermo nero davanti al giocatore.
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

  setAlpha(alpha: number): void {
    this.check('setAlpha', alpha);
    if (alpha < 0 || alpha > 1) this.badNumbers.push(`setAlpha fuori range: ${alpha}`);
  }

  clear(_color: string): void {
    this.calls++;
  }

  verticalGradient(x: number, y: number, w: number, h: number): void {
    this.check('verticalGradient', x, y, w, h);
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.check('rect', x, y, w, h);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number): void {
    this.check('ellipse', cx, cy, rx, ry);
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

  text(value: string, x: number, y: number, style: TextStyle): void {
    this.check('text', x, y, style.size);
    if (typeof value !== 'string') this.badNumbers.push('text con valore non stringa');
  }

  vignette(strength: number): void {
    this.check('vignette', strength);
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
