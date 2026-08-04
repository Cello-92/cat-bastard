import type { TileMap } from './tilemap';
import type { Body } from './types';

/**
 * Collisioni AABB contro una griglia, risolte un asse alla volta.
 *
 * Muovere prima X e poi Y (mai in diagonale) è ciò che rende la fisica
 * prevedibile: niente incastri negli angoli, niente scivolate strane.
 * La precisione qui è sacra — il gioco è bastardo nei contenuti, mai nei
 * controlli (vedi CLAUDE.md).
 */

export type SolidTest = (tile: string) => boolean;

export interface CollisionHooks {
  /** Chiamato quando si atterra su un tile (collisione verso il basso). */
  onLand?(c: number, r: number, tile: string): void;
  /** Chiamato quando si sbatte la testa (collisione verso l'alto). */
  onCeiling?(c: number, r: number, tile: string): void;
  /** Chiamato quando si sbatte contro un muro laterale. */
  onWall?(c: number, r: number, tile: string): void;
}

export function moveX(body: Body, map: TileMap, isSolid: SolidTest, hooks?: CollisionHooks): void {
  body.hitWall = false;
  body.x += body.vx;
  if (body.vx === 0) return;

  const { c0, c1, r0, r1 } = map.cellsOf(body);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const tile = map.get(c, r);
      if (!isSolid(tile)) continue;

      body.x = body.vx > 0 ? c * map.tileSize - body.w : (c + 1) * map.tileSize;
      body.vx = 0;
      body.hitWall = true;
      hooks?.onWall?.(c, r, tile);
      return;
    }
  }
}

/**
 * Nota: `moveY` NON aggiorna `body.onGround`. Lo fa `updateGrounded`, e il
 * motivo è spiegato lì sotto.
 */
export function moveY(body: Body, map: TileMap, isSolid: SolidTest, hooks?: CollisionHooks): void {
  body.y += body.vy;
  if (body.vy === 0) return;

  const { c0, c1, r0, r1 } = map.cellsOf(body);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const tile = map.get(c, r);
      if (!isSolid(tile)) continue;

      if (body.vy > 0) {
        body.y = r * map.tileSize - body.h;
        hooks?.onLand?.(c, r, tile);
      } else {
        body.y = (r + 1) * map.tileSize;
        hooks?.onCeiling?.(c, r, tile);
      }
      body.vy = 0;
      return;
    }
  }
}

/**
 * Riga di griglia immediatamente sotto i piedi del corpo.
 * `cellsOf` usa `y + h - 1` per l'overlap, quindi un corpo appoggiato non
 * tocca mai la riga del pavimento: va sondata a parte.
 */
const footRow = (body: Body, map: TileMap): number => Math.floor((body.y + body.h) / map.tileSize);

/**
 * Il corpo poggia su qualcosa di solido?
 *
 * Va SONDATO, non dedotto dall'ultima collisione. Un corpo fermo a terra non
 * collide con niente proprio perché non si muove: deducendolo dalla collisione
 * risulterebbe "a terra" un tick sì e uno no, con tutto ciò che ne consegue
 * (suoni ripetuti, polvere continua, animazioni che si spengono a frame alterni,
 * attrito che alterna tra suolo e aria).
 */
export function isGrounded(body: Body, map: TileMap, isSolid: SolidTest): boolean {
  const r = footRow(body, map);
  const c0 = Math.floor(body.x / map.tileSize);
  const c1 = Math.floor((body.x + body.w - 1) / map.tileSize);
  for (let c = c0; c <= c1; c++) {
    if (isSolid(map.get(c, r))) return true;
  }
  return false;
}

/** Da chiamare dopo `moveY`, una volta per tick, per ogni corpo che cammina. */
export function updateGrounded(body: Body, map: TileMap, isSolid: SolidTest): void {
  body.onGround = isGrounded(body, map, isSolid);
}

/** I tile su cui il corpo sta poggiando in questo momento. */
export function* groundTiles(
  body: Body,
  map: TileMap,
): Generator<{ c: number; r: number; tile: string }> {
  const r = footRow(body, map);
  const c0 = Math.floor(body.x / map.tileSize);
  const c1 = Math.floor((body.x + body.w - 1) / map.tileSize);
  for (let c = c0; c <= c1; c++) {
    yield { c, r, tile: map.get(c, r) };
  }
}

/**
 * Gravità con velocità di caduta massima.
 *
 * A terra la velocità verticale resta a zero invece di riaccumularsi: senza
 * questo il corpo sprofonderebbe di mezzo pixel a ogni tick per poi essere
 * ributtato su dalla collisione, tremando in verticale per sempre.
 */
export function applyGravity(body: Body, gravity: number, terminal: number): void {
  if (body.onGround && body.vy >= 0) {
    body.vy = 0;
    return;
  }
  body.vy = Math.min(body.vy + gravity, terminal);
}
