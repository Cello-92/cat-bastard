import type { Renderer } from '@engine/render/renderer';
import type { Body } from '@engine/types';
import type { World } from '../world';

/**
 * Base di ogni cosa che si muove e può uccidere il giocatore.
 *
 * Il contratto è volutamente stretto: un'entità sa aggiornarsi, disegnarsi e
 * dire cosa succede quando il gatto la tocca. Tutto il resto (spawn, rimozione,
 * collisioni col giocatore) lo gestisce il World.
 */
export abstract class Entity implements Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx = 0;
  vy = 0;
  onGround = false;
  hitWall = false;

  /** Marcata true, l'entità viene rimossa alla fine del tick. */
  expired = false;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  abstract update(world: World): void;
  abstract draw(r: Renderer, tick: number): void;

  /**
   * Il giocatore l'ha colpita dall'alto.
   * Ritorna true se lo stomp è andato a segno (il giocatore rimbalza);
   * false se l'entità è di quelle che non si schiacciano — e allora uccide.
   */
  onStomp(_world: World): boolean {
    return false;
  }

  /** Il giocatore l'ha toccata di lato o dal basso. */
  abstract onTouch(world: World): void;

  /** Ombra morbida a terra: la disegnano tutte le entità, per coerenza. */
  protected drawShadow(r: Renderer, alpha = 0.22): void {
    r.push();
    r.setAlpha(alpha);
    r.ellipse(this.x + this.w / 2, this.y + this.h, this.w * 0.45, 3.5, '#000000');
    r.pop();
  }
}
