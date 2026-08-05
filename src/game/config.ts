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
  /**
   * Quanto trascina un nastro trasportatore, in pixel per tick.
   *
   * Meno di un terzo della velocità massima: contro il nastro si avanza
   * comunque, ma piano; nel verso del nastro si arriva più lanciati di quanto
   * si sia chiesto. Il nastro non toglie mai il controllo — sposta il terreno,
   * non i comandi (vedi CLAUDE.md).
   */
  beltSpeed: 1.4,
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
  /**
   * Per quanti tick dopo un nastro una caduta è ancora colpa sua.
   * Serve solo a scegliere la battuta giusta: è il tempo di arrivare in fondo
   * al buco in cui il nastro ti ha spinto.
   */
  beltBlameTicks: 48,
  /** Quanto sotto il livello si muore. */
  fallDeathMargin: 160,
  /** Distanza verticale massima per considerare valido uno stomp. */
  stompTolerance: 16,
  /**
   * Tick tra il momento in cui sali sul mattone del boss e quello in cui si
   * stacca. È lungo apposta: dev'esserci il tempo di scendere, farsi vedere e
   * mettere il Padrone sotto la verticale giusta. Tremare per mezzo secondo
   * non sarebbe un'arma, sarebbe un incidente.
   */
  bossBrickDelayTicks: 50,
  /**
   * Dopo quanti tick la muratura del soffitto si ricompone.
   *
   * Serve a non poter perdere: se i mattoni finissero, l'arena diventerebbe
   * una stanza senza soluzione e il giocatore resterebbe lì dentro a girare a
   * vuoto. Il Padrone si ricostruisce il soffitto perché bara — e barando ti
   * ridà l'unica cosa che può ucciderlo.
   */
  bossBrickRespawnTicks: 210,
} as const;

/**
 * Il Padrone.
 *
 * Tutti i tempi sono in tick e tutte le velocità in pixel per tick, come il
 * resto del gioco. Due numeri contano più di ogni altro: la carica è più
 * veloce del gatto (quindi non si scappa in linea retta, si schiva), ma la
 * camminata è molto più lenta (quindi il gatto decide sempre dove si combatte).
 * Se un giorno la camminata superasse `PHYSICS.maxSpeed`, il boss smetterebbe
 * di essere difficile e diventerebbe ingiusto.
 */
export const BOSS = {
  width: 58,
  height: 52,
  /** Colpi da incassare in ciascuna delle due fasi. */
  hitsPerPhase: 2,
  /** Passeggiata di avvicinamento: sempre verso il gatto, sempre più lenta di lui. */
  stalkSpeed: 1.9,
  stalkSpeedFurious: 2.4,
  /** Carica: veloce, dritta, e con una lunghezza fissa che si può memorizzare. */
  chargeSpeed: 5.4,
  chargeSpeedFurious: 6.2,
  chargeDistance: 290,
  /** Tick di ruggito prima di partire: l'unico preavviso, e basta appena. */
  windTicks: 22,
  windTicksFurious: 15,
  /** Quanto resta intontito contro il muro: è la finestra buona per colpirlo. */
  stunTicks: 82,
  stunTicksFurious: 58,
  /** Tick di cammino tra un'azione e l'altra. */
  stalkTicks: 96,
  stalkTicksFurious: 62,
  /**
   * Scarto: quando vede un mattone che gli sta cadendo addosso si sposta.
   * È il suo modo di barare, e funziona solo mentre cammina — appena si
   * impegna in qualcosa (carica, botta a terra, capogiro) non può più.
   */
  dodgeSpeed: 3.4,
  dodgeTicks: 26,
  /** Raggio orizzontale entro cui considera un masso "roba che cade su di me". */
  dodgeRange: 46,
  /**
   * Fase 2: la botta a terra. Fa crollare il mattone sopra al gatto — solo che
   * per un secondo abbondante lui resta lì fermo a godersi lo spettacolo, e i
   * mattoni cadono dove il gatto ha deciso di stare. È l'unica trappola del
   * gioco che si può girare contro chi l'ha messa.
   */
  slamWindTicks: 20,
  slamRecoveryTicks: 54,
  /** Tick di rinculo dopo un colpo incassato: fermo, e quindi colpibile ancora. */
  hurtTicks: 46,
  /** Cambio di fase: sta fermo, urla, e si rifà il soffitto. */
  ragTicks: 70,
} as const;

export const FEEL = {
  screenShakeOnDeath: 9,
  screenShakeOnStomp: 3,
  screenShakeOnTrap: 5,
  vignetteStrength: 0.34,
} as const;
