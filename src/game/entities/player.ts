import type { Input } from '@core/input';
import { clamp } from '@core/math';
import { applyGravity, moveX, moveY, updateGrounded } from '@engine/physics';
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

/**
 * Pixel percorsi per ogni falcata.
 *
 * L'animazione della corsa è guidata dalla DISTANZA, non dal tempo: le zampe
 * si muovono in proporzione alla velocità, i piedi non "pattinano" e passi e
 * polvere restano sincronizzati con quello che si vede.
 */
const STRIDE = 30;
/** Sotto questa velocità il gatto è fermo, non sta camminando piano. */
const RUN_THRESHOLD = 0.6;

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

  /** Distanza percorsa a terra, in pixel: è l'orologio dell'animazione di corsa. */
  private runPhase = 0;
  private stepParity = 0;
  private blinkTimer = 0;

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
    this.runPhase = 0;
    this.stepParity = 0;
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }

  get centerY(): number {
    return this.y + this.h / 2;
  }

  /** True se sta correndo davvero (serve anche al disegno). */
  get isRunning(): boolean {
    return this.onGround && Math.abs(this.vx) > RUN_THRESHOLD;
  }

  update(world: World, input: Input): void {
    this.handleHorizontal(input);
    moveX(this, world.map, isSolid);

    this.handleJump(world, input);
    applyGravity(this, PHYSICS.gravity, PHYSICS.terminalVelocity);
    moveY(this, world.map, isSolid, {
      onCeiling: (c, r, tile) => world.onPlayerHeadbutt(c, r, tile),
    });

    // Lo stato "a terra" si sonda, non si deduce dalla collisione: vedi
    // engine/physics.ts. Da questa riga dipendono attrito, salto, animazione,
    // suono dei passi e polvere, quindi va aggiornato prima di tutto il resto.
    updateGrounded(this, world.map, isSolid);

    this.updateTimers();
    this.updateRunCycle(world);
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
      world.effects.footstepDust(this.centerX, this.y + this.h, PALETTE.dust, this.facing);
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

  /**
   * Avanza il ciclo di corsa e fa scattare un passo ogni `STRIDE` pixel.
   * Passo = un suono + uno sbuffo di polvere, sotto il piede che tocca terra.
   */
  private updateRunCycle(world: World): void {
    if (!this.isRunning) return;

    const previousStep = Math.floor(this.runPhase / STRIDE);
    this.runPhase += Math.abs(this.vx);
    if (Math.floor(this.runPhase / STRIDE) === previousStep) return;

    this.stepParity ^= 1;
    world.audio.play(this.stepParity ? 'step' : 'stepAlt');
    world.effects.footstepDust(
      this.centerX - this.facing * 6,
      this.y + this.h,
      PALETTE.dust,
      this.facing,
    );
  }

  /** Deformazioni e polvere all'atterraggio: puro feedback visivo. */
  private updateJuice(world: World): void {
    if (this.onGround && !this.wasOnGround) {
      const impact = clamp(Math.abs(this.vy) + 6, 6, 16) / 16;
      this.squashX = 1 + 0.34 * impact;
      this.squashY = 1 - 0.3 * impact;
      world.effects.landingDust(this.centerX, this.y + this.h, PALETTE.dust, impact);
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
  }

  // ---------------------------------------------------------------- disegno
  draw(r: Renderer, tick: number): void {
    const cx = Math.round(this.centerX);
    const feet = Math.round(this.y + this.h);
    const running = this.isRunning;
    const speed = Math.abs(this.vx) / PHYSICS.maxSpeed;

    // Fase del ciclo: mezzo giro per falcata, così le due zampe si alternano.
    const cycle = (this.runPhase / STRIDE) * Math.PI;
    const swing = running ? Math.sin(cycle) : 0;
    // Il corpo rimbalza due volte per falcata, in controfase con le zampe.
    const bodyBob = running ? -Math.abs(Math.cos(cycle)) * 1.6 * speed : 0;

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
    const face = this.facing;

    // --- zampe: oscillano avanti/indietro e si alzano da terra a turno.
    const frontSwing = swing;
    const backSwing = -swing;
    drawLeg(r, x + 12 + frontSwing * 3.2 * face, feet, Math.max(0, frontSwing) * 2.6);
    drawLeg(r, x + 3 + backSwing * 3.2 * face, feet, Math.max(0, backSwing) * 2.6);

    // --- corpo (rimbalza; le zampe no)
    const y = feet - this.h + bodyBob;

    // Coda: sferza più veloce quando corri.
    const tailWag = Math.sin(tick / (running ? 4 : 9)) * (running ? 4 : 3);
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

    // Occhi (chiusi quando sbatte le palpebre).
    const eyeShift = face > 0 ? 4 : 0;
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

    // Linee di velocità dietro al gatto quando è lanciato: due trattini che
    // seguono la falcata, molto più leggibili di una scia continua.
    if (running && speed > 0.85) {
      r.push();
      r.setAlpha(0.22 + Math.abs(swing) * 0.16);
      const backX = cx - face * (this.w / 2 + 6);
      r.rect(backX - face * 10, feet - 20, 10, 2, PALETTE.paper);
      r.rect(backX - face * 7, feet - 13, 7, 2, PALETTE.paper);
      r.pop();
    }
  }
}

/** Una zampa: `lift` la stacca da terra durante la falcata. */
function drawLeg(r: Renderer, x: number, feet: number, lift: number): void {
  const height = 5 - lift;
  if (height <= 0.5) return;
  r.rect(x, feet - height, 7, height, PALETTE.paper);
}
