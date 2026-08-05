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

/**
 * Le superfici del secondo mondo.
 *
 * Sono l'unica cosa del gioco che cambia *come risponde il gatto*, e per questo
 * sono anche l'unica cosa che deve restare leggibile a vista: il ghiaccio si
 * vede che è ghiaccio, il nastro si vede che scorre, il getto si sente. Il
 * patto (CLAUDE.md, punto 5) vale sempre — i comandi non tradiscono, è il
 * pavimento che ha regole diverse, e si vedono prima di calpestarlo.
 */
export const SURFACE = {
  /** Attrito sul ghiaccio: quasi niente. Fermarsi diventa una manovra. */
  iceFriction: 0.985,
  /** E anche spingere serve a poco: gli artigli non fanno presa. */
  iceAcceleration: 0.2,
  /** Pixel al tick con cui il nastro trascina chi ci sta sopra. */
  beltSpeed: 1.25,
  /** Accelerazione verso l'alto dentro un getto di vapore. */
  ventLift: 1.6,
  /** Velocità massima di risalita dentro il getto. */
  ventMaxRise: 7,
} as const;

export const RULES = {
  /** Durata del fermo immagine dopo la morte, prima del respawn. */
  deathFreezeTicks: 52,
  /** Quanto resta a schermo la battuta. */
  tauntDurationMs: 1200,
  /** Tick prima che una piattaforma toccata si sbricioli. */
  crumbleDelayTicks: 16,
  /** Tick prima che il finto terreno sparisca sotto le zampe. */
  fakeGroundDelayTicks: 6,
  /** Tick prima che il ghiaccio sottile ceda: il tempo di sentirlo crepitare. */
  brittleIceDelayTicks: 10,
  /**
   * Tick entro cui una caduta viene attribuita al getto spento invece che al
   * vuoto. Serve solo a scegliere la battuta giusta: se sei morto perché un
   * getto non ti ha sollevato, il gioco te lo deve dire.
   */
  deadVentBlameTicks: 40,
  /**
   * Tick prima che una piattaforma fantasma svanisca: quasi zero.
   * Non è reattivo — è memorizzabile. Chi sa che sta arrivando salta prima.
   */
  ghostDelayTicks: 3,
  /** Tick che gli spuntoni a scatto impiegano a uscire: è il loro preavviso. */
  popSpikeChargeTicks: 11,
  /** Distanza orizzontale a cui gli spuntoni a scatto si attivano. */
  popSpikeRange: 46,
  /** Gli spuntoni nascosti scattano in tre tick: un venteesimo di secondo. */
  snapSpikeChargeTicks: 3,
  /** E si attivano solo quando ci sei già praticamente sopra. */
  snapSpikeRange: 20,
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
