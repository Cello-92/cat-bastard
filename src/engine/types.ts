/** Tipi geometrici di base condivisi da tutto l'engine. */

export interface Vec2 {
  x: number;
  y: number;
}

/** Rettangolo allineato agli assi: origine in alto a sinistra. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Corpo fisico: un box con velocità e stato di collisione. */
export interface Body extends Box {
  vx: number;
  vy: number;
  /** True se al termine dell'ultimo `moveY` poggia su un tile solido. */
  onGround: boolean;
  /** True se l'ultimo `moveX` è stato fermato da un muro. */
  hitWall: boolean;
}

export const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const centerX = (b: Box): number => b.x + b.w / 2;
export const centerY = (b: Box): number => b.y + b.h / 2;
