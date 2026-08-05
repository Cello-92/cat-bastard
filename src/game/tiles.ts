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

  // --- Roba del boss: esiste solo dentro l'arena di 1-11.
  /**
   * Mattone del soffitto dell'arena.
   *
   * È l'unica arma che il gatto ha contro il Padrone, ed è anche l'unico posto
   * in cui il gioco chiede al giocatore di fidarsi di una piattaforma che sta
   * per cedere: ci sali sopra, quello trema, e poco dopo si stacca portandosi
   * dietro tutto il peso della muratura. Dove cade non lo decide lui.
   */
  BOSS_BRICK: 'H',
  /**
   * Il portone in fondo all'arena: solido finché il Padrone è vivo, aperto
   * nell'istante in cui smette di esserlo. Non è una trappola, è una serratura.
   */
  BOSS_GATE: '=',

  /**
   * Cubo delle skin: l'unica cosa nel gioco che si può raccogliere una volta
   * sola per sempre. Non uccide, non aiuta, non conta nel punteggio — sblocca
   * un gatto. Sta sempre in un posto che nessuno attraverserebbe per caso.
   */
  SKIN_CUBE: '*',

  // --- Marcatori: rimossi dalla griglia al caricamento e sostituiti da entità.
  /** Nemico che cammina, schiacciabile. */
  WALKER: 'G',
  /** Nemico identico al precedente ma con le punte sotto. Buona fortuna. */
  EVIL_WALKER: 'J',
  /** Bestia appesa in alto che si tuffa quando le passi sotto. */
  DIVER: 'Z',
  /** Il Padrone: il boss di 1-11. Ne esiste uno solo per livello. */
  BOSS: '@',
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
  TILE.BELT_RIGHT,
  TILE.BELT_LEFT,
  TILE.BOSS_BRICK,
  TILE.BOSS_GATE,
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
const SPAWNERS = new Set<string>([TILE.WALKER, TILE.EVIL_WALKER, TILE.DIVER, TILE.BOSS]);

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

/**
 * Verso in cui il nastro trascina chi ci poggia sopra: -1, 0 o +1.
 * Vive qui e non nella fisica perché è semantica del tile, non del motore.
 */
export const beltDirection = (tile: string): number => {
  if (tile === TILE.BELT_RIGHT) return 1;
  if (tile === TILE.BELT_LEFT) return -1;
  return 0;
};

export const isSolid = (tile: string): boolean => SOLID.has(tile);
export const isDeadly = (tile: string): boolean => DEADLY.has(tile);
export const isSpawner = (tile: string): boolean => SPAWNERS.has(tile);
export const isEarth = (tile: string): boolean => EARTH.has(tile);

/** Il blocco invisibile è solido ma va disegnato solo dopo essere stato scoperto. */
export const isHiddenUntilTouched = (tile: string): boolean => tile === TILE.INVISIBLE;
