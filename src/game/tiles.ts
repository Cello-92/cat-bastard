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
  /** Moneta raccoglibile. */
  COIN: 'C',
  /** Bandiera finta: uccide. */
  FAKE_FLAG: 'F',
  /** Arrivo vero. */
  GOAL: 'W',
  /** Checkpoint. */
  CHECKPOINT: 'S',

  // --- Marcatori: rimossi dalla griglia al caricamento e sostituiti da entità.
  /** Nemico che cammina, schiacciabile. */
  WALKER: 'G',
  /** Nemico identico al precedente ma con le punte sotto. Buona fortuna. */
  EVIL_WALKER: 'J',
} as const;

export type TileChar = (typeof TILE)[keyof typeof TILE];

/** Tile contro cui si collide. */
const SOLID = new Set<string>([
  TILE.GROUND,
  TILE.PIPE,
  TILE.PRIZE,
  TILE.HONEST,
  TILE.USED,
  TILE.INVISIBLE,
  TILE.TRAP_BRICK,
  TILE.CRUMBLE,
]);

/** Tile che al contatto uccidono. */
const DEADLY = new Set<string>([TILE.SPIKES, TILE.FAKE_FLAG]);

/** Tile che vengono convertiti in entità al caricamento del livello. */
const SPAWNERS = new Set<string>([TILE.WALKER, TILE.EVIL_WALKER]);

export const isSolid = (tile: string): boolean => SOLID.has(tile);
export const isDeadly = (tile: string): boolean => DEADLY.has(tile);
export const isSpawner = (tile: string): boolean => SPAWNERS.has(tile);

/** Il blocco invisibile è solido ma va disegnato solo dopo essere stato scoperto. */
export const isHiddenUntilTouched = (tile: string): boolean => tile === TILE.INVISIBLE;
