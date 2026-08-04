/**
 * Interfaccia di rendering.
 *
 * Tutto il gioco disegna SOLO attraverso questa interfaccia, mai toccando
 * direttamente il contesto Canvas. È il punto di sostituzione: il giorno in cui
 * serviranno shader, luci o batching si scrive un `WebGLRenderer` che
 * implementa questi metodi e il resto del codice non cambia di una riga.
 *
 * Le primitive sono di basso livello ma non piatte: gradienti, curve, luci
 * additive e ombre morbide sono il minimo indispensabile per una resa
 * realistica — senza, ogni superficie resta una macchia di colore uniforme.
 * Aggiungerne una significa doverla implementare in ogni backend.
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

/**
 * Modalità di fusione col fondo.
 *  - `add`      luce che si somma: sole, bagliori, scintille;
 *  - `multiply` luce che si sottrae: ombre, occlusione ambientale;
 *  - `screen`   schiarita morbida, per foschia e nebbia.
 */
export type BlendMode = 'normal' | 'add' | 'multiply' | 'screen';

/** Tappa di un gradiente: posizione in [0,1] e colore. */
export interface Stop {
  readonly at: number;
  readonly color: string;
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
  rotate(radians: number): void;

  /** Opacità globale in [0,1], valida fino al prossimo `pop()`. */
  setAlpha(alpha: number): void;
  /** Fusione col fondo, valida fino al prossimo `pop()`. */
  setBlend(mode: BlendMode): void;
  /** Sfocatura in pixel logici: costa, si usa su poche forme grandi. 0 = nessuna. */
  setBlur(px: number): void;
  /** Ombra portata morbida sotto le forme disegnate dopo. */
  setShadow(blur: number, color: string, offsetX?: number, offsetY?: number): void;
  /** Limita il disegno a un rettangolo, fino al prossimo `pop()`. */
  clipRect(x: number, y: number, w: number, h: number): void;

  clear(color: string): void;

  // ------------------------------------------------------------ superfici
  rect(x: number, y: number, w: number, h: number, color: string): void;
  roundedRect(x: number, y: number, w: number, h: number, radius: number, color: string): void;
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, rotation?: number): void;
  /** Semicerchio con la parte piatta in basso: colline, cappelli di fungo. */
  dome(cx: number, cy: number, r: number, color: string): void;
  /** Poligono chiuso da coppie di coordinate: [x0,y0, x1,y1, ...]. */
  polygon(points: readonly number[], color: string): void;
  /** Come `polygon` ma con i lati raccordati: sagome organiche, non spigolose. */
  blob(points: readonly number[], color: string): void;

  // ------------------------------------------------------------ gradienti
  /** Rettangolo con gradiente lineare, verticale o orizzontale. */
  gradientRect(
    x: number,
    y: number,
    w: number,
    h: number,
    stops: readonly Stop[],
    horizontal?: boolean,
  ): void;
  /**
   * Ellisse con gradiente radiale dal centro al bordo.
   * È la primitiva della luce: aloni, riflessi, nuvole, polvere, ombre morbide.
   */
  radial(cx: number, cy: number, rx: number, ry: number, stops: readonly Stop[]): void;

  // ------------------------------------------------------------ tratti
  /** Polilinea: crepe, fili d'erba, baffi, profili. */
  line(points: readonly number[], width: number, color: string, closed?: boolean): void;

  text(value: string, x: number, y: number, style: TextStyle): void;

  /** Oscuramento radiale ai bordi, applicato in coordinate schermo. */
  vignette(strength: number): void;
}
