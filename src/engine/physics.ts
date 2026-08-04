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

export function moveY(body: Body, map: TileMap, isSolid: SolidTest, hooks?: CollisionHooks): void {
  body.y += body.vy;
  body.onGround = false;
  if (body.vy === 0) return;

  const { c0, c1, r0, r1 } = map.cellsOf(body);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const tile = map.get(c, r);
      if (!isSolid(tile)) continue;

      if (body.vy > 0) {
        body.y = r * map.tileSize - body.h;
        body.onGround = true;
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

/** Applica gravità con velocità di caduta massima. */
export function applyGravity(body: Body, gravity: number, terminal: number): void {
  body.vy = Math.min(body.vy + gravity, terminal);
}
