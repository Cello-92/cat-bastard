/**
 * Interfaccia di rendering.
 *
 * Tutto il gioco disegna SOLO attraverso questa interfaccia, mai toccando
 * direttamente il contesto Canvas. È il punto di sostituzione: il giorno in cui
 * serviranno shader, luci o batching si scrive un `WebGLRenderer` che
 * implementa questi metodi e il resto del codice non cambia di una riga.
 *
 * Le primitive sono volutamente poche e di basso livello: aggiungerne una
 * significa doverla implementare in ogni backend.
 */

export type TextAlign = 'left' | 'center' | 'right';
export type TextBaseline = 'top' | 'middle' | 'bottom';

export interface TextStyle {
  color: string;
  size: number;
  align?: TextAlign;
  baseline?: TextBaseline;
  weight?: 'normal' | 'bold';
}

export interface Renderer {
  /** Risoluzione logica del gioco in pixel (non quella del canvas su schermo). */
  readonly width: number;
  readonly height: number;

  /** Inizio frame: resetta lo stato del backend. */
  begin(): void;
  /** Fine frame: flush di eventuali batch. */
  end(): void;

  push(): void;
  pop(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;

  /** Opacità globale in [0,1], valida fino al prossimo `pop()`. */
  setAlpha(alpha: number): void;

  clear(color: string): void;
  verticalGradient(x: number, y: number, w: number, h: number, from: string, to: string): void;

  rect(x: number, y: number, w: number, h: number, color: string): void;
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void;
  /** Semicerchio con la parte piatta in basso: colline, cappelli di fungo. */
  dome(cx: number, cy: number, r: number, color: string): void;
  /** Poligono chiuso da coppie di coordinate: [x0,y0, x1,y1, ...]. */
  polygon(points: readonly number[], color: string): void;

  text(value: string, x: number, y: number, style: TextStyle): void;

  /** Oscuramento radiale ai bordi, applicato in coordinate schermo. */
  vignette(strength: number): void;
}
