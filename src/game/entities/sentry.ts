import { applyGravity, moveX, moveY, updateGrounded } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { PHYSICS } from '../config';
import { MATERIAL, PALETTE, alpha, glare, shade } from '../theme';
import { isSolid } from '../tiles';
import { DEATH_CAUSE } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * La sentinella della fabbrica.
 *
 * È il primo nemico del gioco che *reagisce*: pattuglia piano, e quando il
 * gatto le arriva davanti — stessa quota, distanza a tiro — si pianta, si
 * carica e parte. Da lì non frena più: corre finché non trova un muro.
 *
 * Non è schiacciabile, e a differenza del walker cattivo non lo nasconde: ha
 * un elmo chiodato bene in vista. È la controparte leale di `J` — quello ti
 * frega perché sembra innocuo, questa ti frega perché pensavi di avere il
 * tempo di passare.
 *
 * Deterministica come tutto il resto: il raggio è fisso, la carica dura
 * sempre uguale, e imparata una volta si evita saltandole sopra la testa nel
 * momento giusto (sopra, non addosso).
 */

const SIZE = 28;
const PATROL_SPEED = 0.55;
const CHARGE_SPEED = 3.4;
/** Distanza orizzontale entro cui si accorge del gatto. */
const SIGHT = 168;
/** Differenza di quota massima perché "lo veda": deve stare sul suo piano. */
const SIGHT_HEIGHT = 34;
/** Tick di preparazione prima di partire: è tutto il preavviso che concede. */
const WINDUP = 18;

export class Sentry extends Entity {
  private windup = 0;
  private charging = false;

  constructor(x: number, y: number) {
    super(x, y, SIZE, SIZE);
    this.vx = -PATROL_SPEED;
  }

  update(world: World): void {
    const player = world.player;
    const dx = player.centerX - (this.x + this.w / 2);
    const sameFloor = Math.abs(player.y + player.h - (this.y + this.h)) < SIGHT_HEIGHT;

    if (this.charging) {
      // In carica non ragiona più: va dritta finché non sbatte.
      if (this.hitWall) {
        this.charging = false;
        this.vx = Math.sign(this.vx) * -PATROL_SPEED || -PATROL_SPEED;
      }
    } else if (this.windup > 0) {
      this.vx = 0;
      if (--this.windup === 0) {
        this.charging = true;
        this.vx = Math.sign(dx) * CHARGE_SPEED || CHARGE_SPEED;
        world.audio.play('trap');
        world.camera.shake(2);
      }
    } else if (Math.abs(dx) < SIGHT && sameFloor) {
      this.windup = WINDUP;
      world.audio.play('bump');
    }

    moveX(this, world.map, isSolid);
    if (this.hitWall && !this.charging) this.vx = -this.vx;

    applyGravity(this, PHYSICS.gravity, 14);
    moveY(this, world.map, isSolid);
    updateGrounded(this, world.map, isSolid);

    if (this.y > world.map.heightPx + 200) this.expired = true;
  }

  /** L'elmo è chiodato e si vede: schiacciarla è una scelta, non una svista. */
  override onStomp(world: World): boolean {
    world.kill(DEATH_CAUSE.sentry);
    return false;
  }

  onTouch(world: World): void {
    world.kill(DEATH_CAUSE.sentry);
  }

  /**
   * Un blocco di ferro con due gambe corte e un elmo a punte. Tutto in questa
   * figura dice "non saltarmi addosso": le spalle sono più larghe della testa,
   * le punte guardano in alto, e la visiera è l'unica cosa che si illumina.
   */
  draw(r: Renderer, tick: number): void {
    const plate = MATERIAL.plate;
    const iron = MATERIAL.iron;
    const x = this.x;
    const y = this.y;
    const cx = x + this.w / 2;
    const facing = this.vx === 0 ? -1 : Math.sign(this.vx);

    // In carica vibra; ferma dondola appena sulle gambe corte.
    const shake = this.windup > 0 ? (tick % 2 ? 1.6 : -1.6) : 0;
    const gait = this.charging ? Math.sin(tick / 3) : Math.sin(tick / 12);
    const bodyY = y + 8 + gait * 0.8;

    this.drawShadow(r, 0.34);

    // Gambe: due pistoni tozzi, in controfase.
    for (const [i, side] of [-1, 1].entries()) {
      const lx = cx + side * 6 + shake;
      const lift = Math.max(0, (i % 2 ? gait : -gait)) * 2;
      r.rect(lx - 3, y + this.h - 9 - lift, 6, 9, iron.dark);
      r.rect(lx - 3, y + this.h - 9 - lift, 6, 1.5, alpha(iron.light, 0.5));
      r.rect(lx - 4.5, y + this.h - 3 - lift, 9, 3, iron.base);
    }

    // Corpo: lamiera bombata, spalle larghe, saldature verticali. La fascia
    // chiara in alto e il contorno illuminato non sono decorazione: sul fondo
    // nero della fabbrica una sagoma scura sparirebbe, e un nemico che non si
    // vede non è una trappola, è un difetto.
    const bx = x + 2 + shake;
    r.gradientRect(bx, bodyY, this.w - 4, 15, [
      { at: 0, color: plate.spec },
      { at: 0.22, color: plate.light },
      { at: 0.6, color: plate.base },
      { at: 1, color: plate.dark },
    ]);
    r.rect(bx, bodyY, this.w - 4, 1.6, alpha(plate.spec, 0.9));
    r.push();
    r.setAlpha(0.55);
    r.line([bx, bodyY + 15, bx, bodyY, bx + this.w - 4, bodyY], 1.2, alpha(plate.spec, 0.85));
    r.pop();
    r.push();
    r.setAlpha(0.4);
    for (let i = 1; i < 4; i++) {
      const sx = bx + i * ((this.w - 4) / 4);
      r.line([sx, bodyY + 2, sx, bodyY + 13], 1, plate.deep);
    }
    r.pop();

    // Bulloni delle spalle.
    for (const side of [-1, 1] as const) {
      const px = cx + side * (this.w / 2 - 4) + shake;
      r.ellipse(px, bodyY + 4, 2.4, 2.4, iron.dark);
      r.ellipse(px - 0.5, bodyY + 3.5, 1.4, 1.4, iron.light);
    }

    // Elmo: la parte che conta. Le punte sono il cartello "non schiacciarmi".
    const helmY = bodyY - 7;
    r.gradientRect(cx - 9 + shake, helmY, 18, 8, [
      { at: 0, color: MATERIAL.steel.light },
      { at: 0.5, color: MATERIAL.steel.base },
      { at: 1, color: MATERIAL.steel.dark },
    ]);
    for (let i = -1; i <= 1; i++) {
      const sx = cx + i * 6 + shake;
      r.polygon([sx - 2.6, helmY, sx + 2.6, helmY, sx, helmY - 6], MATERIAL.steel.base);
      r.polygon([sx - 2.6, helmY, sx, helmY - 6, sx, helmY], MATERIAL.steel.light);
      r.line([sx, helmY - 6, sx, helmY - 2], 0.9, alpha(MATERIAL.steel.spec, 0.85));
    }

    // Visiera: una fessura che si accende quando ti ha visto.
    const awake = this.windup > 0 || this.charging;
    const eyeColor = awake ? PALETTE.hot : MATERIAL.copper.base;
    r.rect(cx - 7 + shake, helmY + 3, 14, 3.4, iron.deep);
    r.rect(cx - 6 + facing * 1.5 + shake, helmY + 3.6, 7, 2.2, eyeColor);
    if (awake) {
      r.push();
      r.setBlend('add');
      r.setAlpha(0.3 + (tick % 8) * 0.04);
      r.radial(cx + facing * 4 + shake, helmY + 4.5, 20, 9, [
        { at: 0, color: alpha(PALETTE.hot, 0.7) },
        { at: 1, color: alpha(PALETTE.hot, 0) },
      ]);
      r.pop();
    }

    // In carica lascia dietro di sé due strappi d'aria: si legge la velocità.
    if (this.charging) {
      r.push();
      r.setAlpha(0.22);
      for (let i = 0; i < 3; i++) {
        const tx = cx - facing * (12 + i * 7) + shake;
        r.line([tx, bodyY + 3 + i * 4, tx - facing * 7, bodyY + 3 + i * 4], 1.4, glare(0.7));
      }
      r.pop();
    }

    // Occlusione dove appoggia: la stessa di ogni altra entità.
    r.push();
    r.setAlpha(0.32);
    r.radial(cx, y + this.h - 1, 13, 3, [
      { at: 0, color: shade(0.85) },
      { at: 1, color: shade(0) },
    ]);
    r.pop();
  }
}
