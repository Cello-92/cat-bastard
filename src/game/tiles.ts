/**
 * Vocabolario dei tile: il singolo posto che dà significato ai caratteri
 * usati nelle mappe ASCII dei livelli.
 *
 * Aggiungere un tile significa: (1) una voce in TILE, (2) la sua semantica qui
 * sotto, (3) il suo disegno in game/render/tiles.ts. Nient'altro.
 */

export const TILE = {
  EMPTY: ' ',
  /** Terreno solido. */
  GROUND: '#',
  /** Roccia nuda: solida, senza manto erboso. */
  ROCK: 'R',
  /**
   * Terreno identico a quello vero che sparisce sotto le zampe.
   * Il tradimento più puro del genere: il pavimento.
   */
  FAKE_GROUND: 'V',
  /** Tubo: solido, decorativo. */
  PIPE: 'P',
  /** Blocco "?" che sembra un premio e sputa un fungo ostile. */
  PRIZE: 'B',
  /** Blocco "?" onesto: dà davvero una moneta. Esiste per creare il dubbio. */
  HONEST: 'Q',
  /** Blocco già usato. */
  USED: 'U',
  /** Blocco invisibile: compare solo quando ci sbatti contro. */
  INVISIBLE: 'I',
  /** Mattone che, quando gli passi sotto, fa cadere una stalattite. */
  TRAP_BRICK: 'T',
  /** Piattaforma che si sbriciola poco dopo che ci sali. */
  CRUMBLE: 'D',
  /** Spuntoni: morte al contatto. */
  SPIKES: 'X',
  /** Spuntoni appesi al soffitto: uccidono chi salta senza guardare in alto. */
  CEILING_SPIKES: 'Y',
  /** Spuntoni a scatto: escono dal pavimento quando ti avvicini. */
  POP_SPIKES: 'A',
  /** Molla: ti lancia molto più in alto di un salto. Di solito verso qualcosa. */
  SPRING: 'M',
  /** Moneta raccoglibile. */
  COIN: 'C',
  /**
   * Moneta identica a `C` che invece di darti un punto ti ammazza.
   * Nessun segno, nessun colore diverso: si scopre raccogliendola.
   */
  LURE_COIN: 'E',
  /** Bandiera finta: uccide. */
  FAKE_FLAG: 'F',
  /** Arrivo vero. */
  GOAL: 'W',
  /** Checkpoint. */
  CHECKPOINT: 'S',
  /** Checkpoint identico a `S`. Toccarlo uccide. La lanterna non si accende mai. */
  FAKE_CHECKPOINT: 'N',

  // --- Trappole senza preavviso: la prima volta ammazzano e basta.
  /** Masso indistinguibile dal soffitto che crolla nell'istante in cui passi sotto. */
  COLLAPSE: 'K',
  /** Piattaforma solida che sparisce appena la sfiori. Non trema, non avvisa. */
  GHOST: 'L',
  /** Spuntoni nascosti nel terreno: schizzano fuori istantaneamente, senza feritoia. */
  SNAP_SPIKES: 'O',
  /**
   * Spuntoni invisibili: non c'è niente da vedere finché non ti uccidono.
   * Dopo la prima morte restano visibili per tutto il tentativo, così la
   * seconda volta la trappola è evitabile — che è l'unica regola che resta.
   */
  HIDDEN_SPIKES: '!',

  // --- Marcatori: rimossi dalla griglia al caricamento e sostituiti da entità.
  /** Nemico che cammina, schiacciabile. */
  WALKER: 'G',
  /** Nemico identico al precedente ma con le punte sotto. Buona fortuna. */
  EVIL_WALKER: 'J',
  /** Bestia appesa in alto che si tuffa quando le passi sotto. */
  DIVER: 'Z',
} as const;

export type TileChar = (typeof TILE)[keyof typeof TILE];

/** Tile contro cui si collide. */
const SOLID = new Set<string>([
  TILE.GROUND,
  TILE.ROCK,
  TILE.FAKE_GROUND,
  TILE.GHOST,
  TILE.COLLAPSE,
  TILE.PIPE,
  TILE.PRIZE,
  TILE.HONEST,
  TILE.USED,
  TILE.INVISIBLE,
  TILE.TRAP_BRICK,
  TILE.CRUMBLE,
]);

/** Tile che al contatto uccidono, sempre e comunque. */
const DEADLY = new Set<string>([
  TILE.SPIKES,
  TILE.CEILING_SPIKES,
  TILE.FAKE_FLAG,
  TILE.LURE_COIN,
  TILE.FAKE_CHECKPOINT,
]);

/** Tile che vengono convertiti in entità al caricamento del livello. */
const SPAWNERS = new Set<string>([TILE.WALKER, TILE.EVIL_WALKER, TILE.DIVER]);

/**
 * Tile disegnati come massa di terreno.
 * Serve al disegno per sapere dove il suolo continua e dove invece è esposto
 * al cielo: l'erba e i bordi illuminati nascono da qui.
 */
const EARTH = new Set<string>([
  TILE.GROUND,
  TILE.ROCK,
  TILE.FAKE_GROUND,
  TILE.GHOST,
  TILE.COLLAPSE,
]);

export const isSolid = (tile: string): boolean => SOLID.has(tile);
export const isDeadly = (tile: string): boolean => DEADLY.has(tile);
export const isSpawner = (tile: string): boolean => SPAWNERS.has(tile);
export const isEarth = (tile: string): boolean => EARTH.has(tile);

/** Il blocco invisibile è solido ma va disegnato solo dopo essere stato scoperto. */
export const isHiddenUntilTouched = (tile: string): boolean => tile === TILE.INVISIBLE;
