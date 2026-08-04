import { applyGravity, moveX, moveY, updateGrounded } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { PHYSICS } from '../config';
import { PALETTE } from '../theme';
import { isSolid } from '../tiles';
import { DEATH_CAUSE } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * Il fungo che esce dal blocco "?".
 *
 * In ogni platform del mondo è un potenziamento. Qui ti insegue, salta i muri
 * e ti ammazza. Nessun modo di neutralizzarlo: si può solo scappare.
 */

const SIZE = 24;
const CHASE_SPEED = 3.1;
const WALL_HOP = 8;

export class Shroom extends Entity {
  constructor(x: number, y: number) {
    super(x, y, SIZE, SIZE);
    this.vy = -4;
  }

  update(world: World): void {
    // Insegue sempre il giocatore: non c'è pattugliamento, non c'è tregua.
    this.vx = world.player.centerX > this.x ? CHASE_SPEED : -CHASE_SPEED;

    moveX(this, world.map, isSolid);
    if (this.hitWall && this.onGround) this.vy = -WALL_HOP;

    applyGravity(this, PHYSICS.gravity, 14);
    moveY(this, world.map, isSolid);
    updateGrounded(this, world.map, isSolid);

    if (this.y > world.map.heightPx + 200) this.expired = true;
  }

  onTouch(world: World): void {
    world.kill(DEATH_CAUSE.shroom);
  }

  /** Anche schiacciarlo uccide: non è un nemico, è una condanna. */
  override onStomp(world: World): boolean {
    world.kill(DEATH_CAUSE.shroom);
    return false;
  }

  draw(r: Renderer, tick: number): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const cx = x + 12;
    const wobble = Math.sin(tick / 5) * 1.2;

    this.drawShadow(r);

    // Gambo.
    r.rect(x + 4, y + 12, 16, 11, PALETTE.paper);
    r.push();
    r.setAlpha(0.14);
    r.rect(x + 15, y + 12, 5, 11, '#000000');
    r.pop();

    // Cappello.
    r.dome(cx + wobble * 0.3, y + 13, 12, PALETTE.shroom);
    r.push();
    r.setAlpha(0.22);
    r.dome(cx + wobble * 0.3, y + 13, 12, '#000000');
    r.pop();
    r.dome(cx + wobble * 0.3, y + 13, 12, PALETTE.shroom);
    // Puntini.
    r.ellipse(x + 6 + wobble * 0.3, y + 7, 3, 3, PALETTE.paper);
    r.ellipse(x + 18 + wobble * 0.3, y + 7, 3, 3, PALETTE.paper);
    r.ellipse(x + 12 + wobble * 0.3, y + 3, 2.5, 2.5, PALETTE.paper);

    // Faccia: l'unica cosa che tradisce le sue intenzioni, quando è troppo tardi.
    r.rect(x + 8, y + 15, 3, 4, PALETTE.ink);
    r.rect(x + 14, y + 15, 3, 4, PALETTE.ink);
    r.rect(x + 10, y + 21, 5, 1.5, PALETTE.ink);
  }
}
