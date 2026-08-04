import { applyGravity, moveX, moveY, updateGrounded } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { FEEL, PHYSICS } from '../config';
import { MATERIAL, PALETTE, alpha, glare, shade } from '../theme';
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

  /**
   * La bestia: una massa di pelo ispido con due occhi che non promettono
   * niente di buono. La versione `evil` non ha un solo pixel diverso — se si
   * riconoscesse a vista non sarebbe una trappola, sarebbe un cartello.
   */
  draw(r: Renderer, tick: number): void {
    const hide = MATERIAL.hide;
    const x = this.x;
    const y = this.y;
    const cx = x + this.w / 2;
    // Camminata: il corpo si schiaccia a ogni appoggio.
    const gait = Math.sin(tick / 6);
    const bob = gait * 1.5;
    const squash = 1 + gait * 0.07;
    const bodyY = y + 14 + bob;

    this.drawShadow(r, 0.3);

    // Sagoma irsuta: il profilo non è un'ellisse, ha ciuffi che sporgono.
    const spikes: number[] = [];
    const points = 10;
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const ruffle = i % 2 === 0 ? 1.14 : 0.97;
      spikes.push(cx + Math.cos(a) * 13 * squash * ruffle, bodyY + Math.sin(a) * 12.5 / squash * ruffle);
    }
    r.blob(spikes, hide.base);

    // Dorso in luce, ventre in ombra.
    r.push();
    r.setAlpha(0.85);
    r.radial(cx - 4, bodyY - 5, 11, 8, [
      { at: 0, color: alpha(hide.light, 0.95) },
      { at: 1, color: alpha(hide.light, 0) },
    ]);
    r.pop();
    r.push();
    r.setAlpha(0.7);
    r.radial(cx + 2, bodyY + 7, 11, 6, [
      { at: 0, color: alpha(hide.dark, 0.9) },
      { at: 1, color: alpha(hide.dark, 0) },
    ]);
    r.pop();

    // Pelo: tratti radiali corti, sempre negli stessi punti.
    r.push();
    r.setAlpha(0.22);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.9 + i * 0.32;
      r.line(
        [cx + Math.cos(a) * 7, bodyY + Math.sin(a) * 6, cx + Math.cos(a) * 13, bodyY + Math.sin(a) * 12],
        1,
        hide.dark,
      );
    }
    r.pop();

    // Occhi: sclera gialla, pupilla stretta, sopracciglio incassato.
    for (const side of [-1, 1] as const) {
      const ex = cx + side * 5;
      const ey = bodyY - 3;
      r.ellipse(ex, ey, 3.4, 3.2, PALETTE.paper);
      r.ellipse(ex, ey, 2.9, 2.7, MATERIAL.gold.light);
      r.ellipse(ex + side * 0.4, ey, 1.1, 2.2, '#120c08');
      r.ellipse(ex - 1, ey - 1.2, 0.8, 0.7, glare(0.9));
      // Il sopracciglio è ciò che lo fa sembrare arrabbiato, non sorpreso.
      r.polygon(
        [ex - side * 4.4, ey - 5.4, ex + side * 3.6, ey - 2.6, ex + side * 3.6, ey - 4.8],
        hide.deep,
      );
    }

    // Zanne.
    r.polygon([cx - 3, bodyY + 7, cx - 1.4, bodyY + 10.5, cx - 0.2, bodyY + 7], PALETTE.paper);
    r.polygon([cx + 1, bodyY + 7, cx + 2.4, bodyY + 10.5, cx + 3.6, bodyY + 7], PALETTE.paper);

    // Zampe: in controfase, con l'ombra di contatto sotto quella che appoggia.
    const step = Math.floor(tick / 7) % 2 ? 1 : -1;
    for (const [px, lift] of [[x + 4, -step], [x + this.w - 10, step]] as const) {
      r.roundedRect(px, y + 22 + lift, 8, 5, 2.5, hide.dark);
      r.rect(px + 1, y + 22 + lift, 6, 1.2, alpha(hide.light, 0.35));
      // Unghie.
      r.push();
      r.setAlpha(0.8);
      for (let i = 0; i < 3; i++) {
        r.line([px + 1.5 + i * 2.4, y + 26 + lift, px + 1.5 + i * 2.4, y + 27.6 + lift], 1, PALETTE.paper);
      }
      r.pop();
    }

    // Occlusione dove il corpo tocca il terreno.
    r.push();
    r.setAlpha(0.3);
    r.radial(cx, y + this.h - 1, 12, 3, [
      { at: 0, color: shade(0.8) },
      { at: 1, color: shade(0) },
    ]);
    r.pop();
  }
}
