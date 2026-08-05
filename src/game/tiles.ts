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
  /**
   * Nastro trasportatore che spinge verso destra: solido, calpestabile, e ti
   * porta con sé che tu lo voglia o no. Non tocca i comandi — sposta il mondo
   * sotto le zampe, che è un'altra cosa.
   */
  BELT_RIGHT: '>',
  /** Lo stesso nastro, al contrario: ti riporta indietro mentre corri avanti. */
  BELT_LEFT: '<',
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
  /**
   * Molla identica a `M`, con la stessa piastra e lo stesso piattello rosso.
   * Non lancia niente: si chiude di scatto. È una tagliola travestita da aiuto.
   */
  TRAP_SPRING: 'm',

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

  // --- Mondo 2: il ghiaccio e la fabbrica. Vocabolario tutto suo.
  /**
   * Terreno innevato: si comporta esattamente come `#`, e infatti è il
   * pavimento onesto del secondo mondo. Cambia solo il manto — neve al posto
   * dell'erba — perché un mondo nuovo che riusa il terreno del vecchio non
   * sembra un mondo nuovo.
   */
  SNOW: '+',
  /**
   * Ghiaccio: solido come il terreno, ma non ti tiene.
   * Non è una trappola nascosta — si vede benissimo che è ghiaccio. È una
   * regola nuova: da qui in poi fermarsi costa più che partire.
   */
  ICE: '~',
  /**
   * Ghiaccio sottile: identico a `~` finché non ci sali. Poi si crepa e cede.
   * Ha il suo preavviso (le crepe), come l'asse marcia del primo mondo.
   */
  BRITTLE_ICE: ';',
  /** Piastra d'acciaio: il pavimento della fabbrica. Solida e onesta. */
  STEEL: '=',
  /** Nastro trasportatore verso destra: ti porta dove vuole lui. */
  BELT_RIGHT: '>',
  /** Nastro trasportatore verso sinistra. Di solito verso qualcosa di brutto. */
  BELT_LEFT: '<',
  /** Getto di vapore: non è solido, ti solleva finché ci resti dentro. */
  VENT: '^',
  /**
   * Getto identico al precedente, stesso vapore, stesso rumore: non spinge.
   * Nessun modo di distinguerlo prima. Dopo, sì: sei caduto dentro.
   */
  DEAD_VENT: ',',

  // --- Segreti: non uccidono, si nascondono.
  /** Parete d'acciaio attraversabile: dietro c'è sempre qualcosa. */
  FAKE_WALL: ':',
  /** Gomitolo: uno per livello, ben nascosto. Sblocca i gatti. */
  YARN: '*',

  // --- Marcatori: rimossi dalla griglia al caricamento e sostituiti da entità.
  /** Nemico che cammina, schiacciabile. */
  WALKER: 'G',
  /** Nemico identico al precedente ma con le punte sotto. Buona fortuna. */
  EVIL_WALKER: 'J',
  /** Bestia appesa in alto che si tuffa quando le passi sotto. */
  DIVER: 'Z',
  /** Sentinella corazzata: cammina piano, poi ti carica. Non si schiaccia. */
  SENTRY: 'H',
  /** Drone: vola su una rotta fissa. Schiacciarlo funziona, e a volte serve. */
  DRONE: '%',
  /** Palla di ghiaccio: quando entri nel suo raggio, rotola verso di te. */
  SNOWBALL: '&',
} as const;

export type TileChar = (typeof TILE)[keyof typeof TILE];

/** Tile contro cui si collide. */
const SOLID = new Set<string>([
  TILE.GROUND,
  TILE.SNOW,
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
  TILE.ICE,
  TILE.BRITTLE_ICE,
  TILE.STEEL,
  TILE.BELT_RIGHT,
  TILE.BELT_LEFT,
]);

/** Tile che al contatto uccidono, sempre e comunque. */
const DEADLY = new Set<string>([
  TILE.SPIKES,
  TILE.CEILING_SPIKES,
  TILE.FAKE_FLAG,
  TILE.LURE_COIN,
  TILE.FAKE_CHECKPOINT,
  TILE.TRAP_SPRING,
]);

/** Tile che vengono convertiti in entità al caricamento del livello. */
const SPAWNERS = new Set<string>([
  TILE.WALKER,
  TILE.EVIL_WALKER,
  TILE.DIVER,
  TILE.SENTRY,
  TILE.DRONE,
  TILE.SNOWBALL,
]);

/**
 * Tile disegnati come massa di terreno.
 * Serve al disegno per sapere dove il suolo continua e dove invece è esposto
 * al cielo: l'erba e i bordi illuminati nascono da qui.
 */
const EARTH = new Set<string>([
  TILE.GROUND,
  TILE.SNOW,
  TILE.ROCK,
  TILE.FAKE_GROUND,
  TILE.GHOST,
  TILE.COLLAPSE,
]);

/** Ghiaccio: una superficie, non una trappola. Si distingue a vista. */
const ICY = new Set<string>([TILE.ICE, TILE.BRITTLE_ICE]);

/**
 * Lamiera della fabbrica. Ci sta dentro anche la parete finta, ed è il punto:
 * deve saldarsi alle altre esattamente come farebbe una parete vera.
 */
const METAL = new Set<string>([
  TILE.STEEL,
  TILE.BELT_RIGHT,
  TILE.BELT_LEFT,
  TILE.FAKE_WALL,
]);

export const isSolid = (tile: string): boolean => SOLID.has(tile);
export const isDeadly = (tile: string): boolean => DEADLY.has(tile);
export const isSpawner = (tile: string): boolean => SPAWNERS.has(tile);
export const isEarth = (tile: string): boolean => EARTH.has(tile);
export const isIcy = (tile: string): boolean => ICY.has(tile);
export const isMetal = (tile: string): boolean => METAL.has(tile);

/**
 * Due celle si "saldano" (niente bordo, niente ombra tra loro)?
 *
 * La terra fa massa con la terra, il ghiaccio col ghiaccio, la lamiera con la
 * lamiera; tutto il resto si limita a poggiare sul solido. Senza questa regola
 * una parete d'acciaio incastrata nella roccia sembrerebbe un unico blocco, e
 * il mondo nuovo non si distinguerebbe da quello vecchio.
 */
export const joins = (tile: string, other: string): boolean => {
  if (isEarth(tile)) return isEarth(other);
  if (isIcy(tile)) return isIcy(other);
  if (isMetal(tile)) return isMetal(other);
  return isSolid(other);
};

/** Il blocco invisibile è solido ma va disegnato solo dopo essere stato scoperto. */
export const isHiddenUntilTouched = (tile: string): boolean => tile === TILE.INVISIBLE;

/** Verso in cui il nastro trascina: -1, 0 o +1. */
export const beltDirection = (tile: string): number =>
  tile === TILE.BELT_RIGHT ? 1 : tile === TILE.BELT_LEFT ? -1 : 0;
