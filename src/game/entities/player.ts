import type { Input } from '@core/input';
import { clamp, wave } from '@core/math';
import { applyGravity, moveX, moveY } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import type { Body } from '@engine/types';
import { PHYSICS } from '../config';
import { PALETTE, shade } from '../theme';
import { isSolid } from '../tiles';
import type { World } from '../world';

/**
 * Il gatto.
 *
 * Regola non negoziabile: i controlli non tradiscono mai. Coyote time e jump
 * buffer esistono proprio per questo — il salto deve rispondere anche quando
 * il giocatore lo chiede un frame prima o un frame dopo il momento perfetto.
 */

const WIDTH = 22;
const HEIGHT = 28;

export class Player implements Body {
  x = 0;
  y = 0;
  readonly w = WIDTH;
  readonly h = HEIGHT;
  vx = 0;
  vy = 0;
  onGround = false;
  hitWall = false;

  /** -1 sinistra, +1 destra. */
  facing = 1;

  private coyote = 0;
  private jumpBuffer = 0;
  private wasOnGround = false;

  /** Squash & stretch: 1 = forma a riposo. */
  private squashX = 1;
  private squashY = 1;

  private blinkTimer = 0;
  private streakTimer = 0;

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.hitWall = false;
    this.facing = 1;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.wasOnGround = false;
    this.squashX = 1;
    this.squashY = 1;
    this.streakTimer = 0;
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }

  get centerY(): number {
    return this.y + this.h / 2;
  }

  update(world: World, input: Input): void {
    this.handleHorizontal(input);
    moveX(this, world.map, isSolid);

    this.handleJump(world, input);
    applyGravity(this, PHYSICS.gravity, PHYSICS.terminalVelocity);
    moveY(this, world.map, isSolid, {
      onLand: (c, r, tile) => world.onPlayerLand(c, r, tile),
      onCeiling: (c, r, tile) => world.onPlayerHeadbutt(c, r, tile),
    });

    this.updateTimers();
    this.updateJuice(world);
  }

  // ---------------------------------------------------------------- moto
  private handleHorizontal(input: Input): void {
    const left = input.isDown('left');
    const right = input.isDown('right');

    if (left) {
      this.vx -= PHYSICS.acceleration;
      this.facing = -1;
    }
    if (right) {
      this.vx += PHYSICS.acceleration;
      this.facing = 1;
    }
    if (left === right) {
      this.vx *= this.onGround ? PHYSICS.groundFriction : PHYSICS.airFriction;
    }

    this.vx = clamp(this.vx, -PHYSICS.maxSpeed, PHYSICS.maxSpeed);
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
  }

  private handleJump(world: World, input: Input): void {
    if (input.justPressed('jump')) this.jumpBuffer = PHYSICS.jumpBufferTicks;

    const canJump = this.onGround || this.coyote > 0;
    if (this.jumpBuffer > 0 && canJump) {
      this.vy = -PHYSICS.jumpImpulse;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squashX = 0.76;
      this.squashY = 1.3;
      world.audio.play('jump');
      world.effects.landingDust(this.centerX, this.y + this.h, PALETTE.paper, 0.6);
    }

    // Salto ad altezza variabile: rilasciare taglia la salita.
    if (!input.isDown('jump') && this.vy < 0) this.vy *= PHYSICS.jumpCut;
  }

  private updateTimers(): void {
    if (this.onGround) this.coyote = PHYSICS.coyoteTicks;
    else if (this.coyote > 0) this.coyote--;
    if (this.jumpBuffer > 0) this.jumpBuffer--;
    if (this.blinkTimer > 0) this.blinkTimer--;
    else if (Math.random() < 0.008) this.blinkTimer = 8;
  }

  /** Deformazioni, polvere e scie: puro feedback visivo. */
  private updateJuice(world: World): void {
    const justLanded = this.onGround && !this.wasOnGround;
    if (justLanded) {
      const impact = clamp(Math.abs(this.vy) + 6, 6, 16) / 16;
      this.squashX = 1 + 0.34 * impact;
      this.squashY = 1 - 0.3 * impact;
      world.effects.landingDust(this.centerX, this.y + this.h, PALETTE.paper, impact);
      world.audio.play('land');
    }
    this.wasOnGround = this.onGround;

    // Ritorno elastico alla forma normale.
    this.squashX += (1 - this.squashX) * 0.22;
    this.squashY += (1 - this.squashY) * 0.22;

    // Stretch in caduta libera: allunga il gatto, si legge meglio in aria.
    if (!this.onGround) {
      const airStretch = clamp(this.vy / 22, -0.18, 0.2);
      this.squashY += airStretch * 0.35;
      this.squashX -= airStretch * 0.25;
    }

    if (this.onGround && Math.abs(this.vx) > PHYSICS.maxSpeed * 0.8) {
      this.streakTimer++;
      if (this.streakTimer % 3 === 0) {
        world.effects.speedStreak(this.centerX, this.y + this.h - 4, PALETTE.paper, this.facing);
      }
    } else {
      this.streakTimer = 0;
    }
  }

  // ---------------------------------------------------------------- disegno
  draw(r: Renderer, tick: number): void {
    const cx = Math.round(this.centerX);
    const feet = Math.round(this.y + this.h);
    const running = this.onGround && Math.abs(this.vx) > 0.6;
    const step = running ? Math.floor(tick / 5) % 2 : 0;

    // Ombra: si stringe quando sei in aria, dà il senso dell'altezza.
    r.push();
    r.setAlpha(this.onGround ? 0.26 : 0.13);
    r.ellipse(cx, feet + 1, this.w * (this.onGround ? 0.5 : 0.34), 3.5, '#000000');
    r.pop();

    r.push();
    // Squash & stretch attorno ai piedi, così il gatto non "galleggia".
    r.translate(cx, feet);
    r.scale(this.squashX, this.squashY);
    r.translate(-cx, -feet);

    const x = cx - this.w / 2;
    const y = feet - this.h;
    const face = this.facing;
    const eyeShift = face > 0 ? 4 : 0;

    // Coda, animata a onda.
    const tailWag = Math.sin(tick / 7) * 3;
    const tailX = face > 0 ? x - 7 : x + this.w + 1;
    r.rect(tailX, y + 9 + tailWag * 0.4, 7, 4, PALETTE.paper);
    r.rect(tailX + (face > 0 ? 0 : 4), y + 6 + tailWag, 3, 5, PALETTE.paper);

    // Orecchie.
    r.polygon([x + 2, y + 9, x + 5, y - 5, x + 11, y + 7], PALETTE.paper);
    r.polygon([x + 12, y + 7, x + 18, y - 5, x + 21, y + 9], PALETTE.paper);
    r.polygon([x + 4, y + 7, x + 6, y - 1, x + 9, y + 6], PALETTE.hot);
    r.polygon([x + 14, y + 6, x + 17, y - 1, x + 19, y + 7], PALETTE.hot);

    // Corpo con testa arrotondata.
    r.rect(x, y + 5, this.w, this.h - 9, PALETTE.paper);
    r.ellipse(x + this.w / 2, y + 10, this.w / 2, 7, PALETTE.paper);
    // Ombreggiatura sul lato opposto alla luce.
    r.push();
    r.setAlpha(0.12);
    r.rect(face > 0 ? x : x + this.w - 5, y + 5, 5, this.h - 9, '#000000');
    r.pop();

    // Zampe alternate in corsa.
    r.rect(x + 2, y + this.h - 5, 7, 5 + step, PALETTE.paper);
    r.rect(x + 13, y + this.h - 5, 7, 5 - step, PALETTE.paper);

    // Occhi (chiusi quando sbatte le palpebre).
    if (this.blinkTimer > 0) {
      r.rect(x + 4 + eyeShift, y + 12, 4, 2, PALETTE.furDark);
      r.rect(x + 13 + eyeShift, y + 12, 4, 2, PALETTE.furDark);
    } else {
      r.rect(x + 4 + eyeShift, y + 10, 4, 5, PALETTE.furDark);
      r.rect(x + 13 + eyeShift, y + 10, 4, 5, PALETTE.furDark);
      // Riflesso: piccolo, ma dà vita allo sguardo.
      r.rect(x + 5 + eyeShift, y + 11, 1.5, 1.5, PALETTE.paper);
      r.rect(x + 14 + eyeShift, y + 11, 1.5, 1.5, PALETTE.paper);
    }

    // Musetto e guance.
    r.rect(x + 9 + eyeShift, y + 17, 5, 3, PALETTE.hot);
    r.push();
    r.setAlpha(0.35);
    r.rect(x + 1 + eyeShift, y + 16, 4, 3, PALETTE.hot);
    r.rect(x + 17 + eyeShift, y + 16, 4, 3, PALETTE.hot);
    r.pop();

    // Baffi.
    r.push();
    r.setAlpha(0.5);
    const whiskerX = face > 0 ? x + 17 : x - 3;
    r.rect(whiskerX, y + 17, 8, 1, shade(0.55));
    r.rect(whiskerX, y + 20, 7, 1, shade(0.55));
    r.pop();

    r.pop();

    // Alone rosa quando corri al massimo: velocità leggibile a colpo d'occhio.
    if (running && Math.abs(this.vx) > PHYSICS.maxSpeed * 0.9 && wave(tick, 8) > 0.5) {
      r.push();
      r.setAlpha(0.16);
      r.ellipse(cx - face * 10, feet - this.h / 2, 14, 12, PALETTE.hot);
      r.pop();
    }
  }
}
