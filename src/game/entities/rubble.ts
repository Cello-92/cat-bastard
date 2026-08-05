import { moveY } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { PHYSICS } from '../config';
import { MATERIAL, PALETTE, alpha, glare, shade } from '../theme';
import { isSolid } from '../tiles';
import { DEATH_CAUSE } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * Il masso di muratura che si stacca dal soffitto dell'arena.
 *
 * È l'unica cosa nel gioco che fa male a *entrambi*: uccide il gatto se lo
 * prende, e toglie un pezzo di corona al Padrone se prende lui. Chi lo ha
 * staccato non c'entra niente — il soffitto non fa favori a nessuno, ed è
 * proprio questo che rende l'arma interessante da usare.
 *
 * A differenza della stalattite (`falling-spike.ts`) rispetta la mappa: si
 * sfracella sul primo solido che incontra. Un masso che attraversa il
 * pavimento resterebbe letale in giro per l'arena senza che si veda perché.
 */

const WIDTH = 28;
const HEIGHT = 26;
const MAX_FALL = 14;

export class Rubble extends Entity {
  /** Rotazione accumulata: cade ruotando, così si legge che è un detrito. */
  private spin = 0;
  private readonly tumble: number;

  constructor(x: number, y: number, tumble = 0.06) {
    super(x, y, WIDTH, HEIGHT);
    this.tumble = tumble;
  }

  update(world: World): void {
    this.vy = Math.min(this.vy + PHYSICS.gravity * 1.05, MAX_FALL);
    this.spin += this.tumble;

    moveY(this, world.map, isSolid, {
      onLand: () => this.shatter(world),
    });

    if (this.y > world.map.heightPx + 120) this.expired = true;
  }

  /** Si sbriciola: polvere, schegge e un tonfo. Da qui in poi non fa più male. */
  shatter(world: World): void {
    if (this.expired) return;
    this.expired = true;
    world.audio.play('crumble');
    world.camera.shake(4);
    world.effects.burst(this.x + this.w / 2, this.y + this.h, PALETTE.brick, {
      count: 12,
      speed: 3.4,
      size: 4.5,
      life: 30,
      gravity: 0.42,
      angle: -Math.PI / 2,
      spread: Math.PI * 0.9,
    });
    world.effects.burst(this.x + this.w / 2, this.y + this.h, PALETTE.dust, {
      count: 7,
      speed: 2,
      size: 4,
      life: 24,
      gravity: -0.02,
      shape: 'circle',
    });
  }

  onTouch(world: World): void {
    world.kill(DEATH_CAUSE.bossRubble);
  }

  override onStomp(world: World): boolean {
    world.kill(DEATH_CAUSE.bossRubble);
    return false;
  }

  /** Blocco di muratura spaccato: due corsi di mattoni e la malta rotta. */
  draw(r: Renderer, _tick: number): void {
    const m = MATERIAL.brick;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;

    r.push();
    r.translate(cx, cy);
    r.rotate(this.spin);

    const hw = this.w / 2;
    const hh = this.h / 2;
    // Profilo irregolare: un masso strappato non è un quadrato.
    r.polygon(
      [-hw, -hh + 3, -hw + 5, -hh, hw - 2, -hh + 2, hw, hh - 4, hw - 6, hh, -hw + 3, hh - 2],
      m.base,
    );
    r.polygon([-hw, -hh + 3, -hw + 5, -hh, hw - 2, -hh + 2, -hw + 2, hh - 6], m.light);
    r.polygon([hw - 2, -hh + 2, hw, hh - 4, hw - 6, hh, -hw + 4, hh - 3], m.dark);

    // Fughe: si vede che era un muro.
    r.push();
    r.setAlpha(0.55);
    r.line([-hw + 2, -1, hw - 2, -2], 1.6, m.deep);
    r.line([-2, -hh + 2, -3, -1], 1.4, m.deep);
    r.line([4, 0, 5, hh - 2], 1.4, m.deep);
    r.pop();

    // Spigolo in luce e ventre in ombra: cade, ma la luce resta quella del mondo.
    r.push();
    r.setAlpha(0.5);
    r.line([-hw + 4, -hh + 2, hw - 4, -hh + 3], 1.2, glare(0.8));
    r.pop();
    r.push();
    r.setAlpha(0.35);
    r.radial(0, hh - 2, hw, 5, [
      { at: 0, color: shade(0.8) },
      { at: 1, color: shade(0) },
    ]);
    r.pop();
    r.pop();

    // Scia di polvere che si trascina dietro: si vede arrivare da lontano.
    r.push();
    r.setAlpha(0.22);
    r.radial(cx, cy - this.h, this.w * 0.4, this.h * 0.9, [
      { at: 0, color: alpha(PALETTE.dust, 0.7) },
      { at: 1, color: alpha(PALETTE.dust, 0) },
    ]);
    r.pop();
  }
}
