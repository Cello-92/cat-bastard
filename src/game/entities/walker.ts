import { applyGravity, moveX, moveY, updateGrounded } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { FEEL, PHYSICS } from '../config';
import { PALETTE } from '../theme';
import { isSolid } from '../tiles';
import { DEATH_CAUSE } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * Il nemico base che cammina avanti e indietro.
 *
 * La versione `evil` è graficamente IDENTICA ma ha le punte sotto la pelliccia:
 * schiacciarla uccide. È la trappola più pura del gioco — usa contro il
 * giocatore l'unica cosa che credeva di sapere per certo.
 */

const SIZE = 26;
const SPEED = 0.95;

export class Walker extends Entity {
  constructor(x: number, y: number, private readonly evil: boolean) {
    super(x, y, SIZE, SIZE);
    this.vx = -SPEED;
  }

  update(world: World): void {
    moveX(this, world.map, isSolid);
    if (this.hitWall) this.vx = -this.vx;

    applyGravity(this, PHYSICS.gravity, 14);
    moveY(this, world.map, isSolid);
    updateGrounded(this, world.map, isSolid);

    if (this.y > world.map.heightPx + 200) this.expired = true;
  }

  override onStomp(world: World): boolean {
    if (this.evil) {
      world.kill(DEATH_CAUSE.evilWalker);
      return false;
    }
    this.expired = true;
    world.audio.play('stomp');
    world.camera.shake(FEEL.screenShakeOnStomp);
    world.effects.freeze(3);
    world.effects.burst(this.x + this.w / 2, this.y + this.h / 2, PALETTE.fur, {
      count: 12,
      speed: 3.6,
      size: 5,
    });
    world.effects.ring(this.x + this.w / 2, this.y + this.h / 2, PALETTE.paper, 3.2, 10);
    return true;
  }

  onTouch(world: World): void {
    world.kill(this.evil ? DEATH_CAUSE.evilWalker : DEATH_CAUSE.walker);
  }

  draw(r: Renderer, tick: number): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const cx = x + this.w / 2;
    // Camminata: il corpo si schiaccia leggermente a ogni passo.
    const bob = Math.sin(tick / 6) * 1.5;
    const squash = 1 + Math.sin(tick / 6) * 0.06;

    this.drawShadow(r);

    // Corpo.
    r.ellipse(cx, y + 14 + bob, 13 * squash, 12 / squash, PALETTE.fur);
    r.push();
    r.setAlpha(0.18);
    r.ellipse(cx, y + 18 + bob, 11 * squash, 7, '#000000');
    r.pop();
    // Luce dall'alto.
    r.push();
    r.setAlpha(0.16);
    r.ellipse(cx - 3, y + 8 + bob, 7, 4, PALETTE.paper);
    r.pop();

    // Occhi arrabbiati.
    r.rect(x + 6, y + 9 + bob, 4, 6, PALETTE.furDark);
    r.rect(x + 16, y + 9 + bob, 4, 6, PALETTE.furDark);
    r.rect(x + 6, y + 8 + bob, 5, 2, PALETTE.furDark);
    r.rect(x + 15, y + 8 + bob, 5, 2, PALETTE.furDark);

    // Piedi, in controfase.
    const step = Math.floor(tick / 7) % 2 ? 1 : -1;
    r.rect(x + 2, y + 24 - step, 8, 4, PALETTE.furDark);
    r.rect(x + 16, y + 24 + step, 8, 4, PALETTE.furDark);
  }
}
