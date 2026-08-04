/**
 * Tutte le costanti di gioco in un posto solo.
 *
 * I valori sono PER TICK a 60Hz (vedi core/loop.ts). Toccarne uno cambia il
 * feeling di ogni livello già disegnato: ogni salto è stato tarato su questi
 * numeri, quindi si modificano solo con molta intenzione.
 */

export const TILE_SIZE = 32;
export const VIEW_WIDTH = 800;
export const VIEW_HEIGHT = 480;
export const LEVEL_ROWS = 15;
/** Larghezza in colonne di un singolo segmento di livello. */
export const SEGMENT_COLS = 20;

export const PHYSICS = {
  gravity: 0.55,
  terminalVelocity: 16,
  jumpImpulse: 11.6,
  /** Moltiplicatore applicato alla salita quando si rilascia il tasto. */
  jumpCut: 0.42,
  acceleration: 0.72,
  maxSpeed: 4.6,
  groundFriction: 0.8,
  airFriction: 0.94,
  /** Tick di tolleranza per saltare dopo essere usciti dalla piattaforma. */
  coyoteTicks: 5,
  /** Tick entro cui un salto premuto in aria viene ricordato all'atterraggio. */
  jumpBufferTicks: 6,
  /** Rimbalzo dopo aver schiacciato un nemico. */
  stompBounce: 7.4,
  /** Spinta della molla: molto più di un salto, e non si può dosare. */
  springImpulse: 17.2,
} as const;

export const RULES = {
  /** Durata del fermo immagine dopo la morte, prima del respawn. */
  deathFreezeTicks: 52,
  /** Quanto resta a schermo la battuta. */
  tauntDurationMs: 1200,
  /** Tick prima che una piattaforma toccata si sbricioli. */
  crumbleDelayTicks: 16,
  /** Tick prima che il finto terreno sparisca sotto le zampe. */
  fakeGroundDelayTicks: 7,
  /** Tick che gli spuntoni a scatto impiegano a uscire: è il loro preavviso. */
  popSpikeChargeTicks: 11,
  /** Distanza orizzontale a cui gli spuntoni a scatto si attivano. */
  popSpikeRange: 34,
  /** Quanto sotto il livello si muore. */
  fallDeathMargin: 160,
  /** Distanza verticale massima per considerare valido uno stomp. */
  stompTolerance: 16,
} as const;

export const FEEL = {
  screenShakeOnDeath: 9,
  screenShakeOnStomp: 3,
  screenShakeOnTrap: 5,
  vignetteStrength: 0.34,
} as const;
