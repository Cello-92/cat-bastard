import { applyGravity, moveX, moveY, updateGrounded } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { PHYSICS } from '../config';
import { MATERIAL, PALETTE, alpha, glare, shade } from '../theme';
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

  /**
   * Il fungo. Cappello lucido, gambo carnoso, lamelle sotto: sembra
   * esattamente il potenziamento che ogni platform ti ha insegnato a
   * raccogliere. La faccia si vede solo da vicino, ed è già tardi.
   */
  draw(r: Renderer, tick: number): void {
    const cap = MATERIAL.cap;
    const flesh = MATERIAL.fur;
    const x = this.x;
    const y = this.y;
    const cx = x + 12;
    // Corre, quindi il cappello oscilla e il gambo si piega di conseguenza.
    const wobble = Math.sin(tick / 5) * 1.3;
    const lean = wobble * 0.35;

    this.drawShadow(r, 0.3);

    // Gambo: cilindro, più stretto in alto, con l'ombra del cappello sopra.
    const stemTop = y + 12;
    r.push();
    r.polygon([cx - 5 + lean, stemTop, cx + 5 + lean, stemTop, cx + 6.5, y + 23, cx - 6.5, y + 23], flesh.base);
    r.pop();
    r.push();
    r.setAlpha(0.75);
    r.radial(cx - 2 + lean, y + 17, 3.4, 6, [
      { at: 0, color: alpha(flesh.light, 0.95) },
      { at: 1, color: alpha(flesh.light, 0) },
    ]);
    r.setAlpha(0.6);
    r.radial(cx + 4 + lean, y + 18, 3.4, 6, [
      { at: 0, color: alpha(flesh.dark, 0.9) },
      { at: 1, color: alpha(flesh.dark, 0) },
    ]);
    r.pop();

    // Lamelle sotto il cappello: la parte che nessuno guarda mai.
    r.push();
    r.setAlpha(0.5);
    for (let i = -3; i <= 3; i++) {
      r.line([cx + i * 2.6 + wobble * 0.3, y + 12, cx + i * 3.1 + wobble * 0.3, y + 15], 1, cap.deep);
    }
    r.pop();

    // Cappello: cupola con luce in alto a sinistra e bordo che rientra.
    const capX = cx + wobble * 0.3;
    r.dome(capX, y + 13, 12, cap.base);
    r.push();
    r.setAlpha(0.9);
    r.radial(capX - 4, y + 5, 9, 7, [
      { at: 0, color: alpha(cap.light, 1) },
      { at: 1, color: alpha(cap.light, 0) },
    ]);
    r.setAlpha(0.75);
    r.radial(capX + 6, y + 11, 7, 4.5, [
      { at: 0, color: alpha(cap.dark, 0.95) },
      { at: 1, color: alpha(cap.dark, 0) },
    ]);
    r.pop();
    // Riflesso speculare stretto: è quello che lo fa sembrare bagnato.
    r.push();
    r.setAlpha(0.75);
    r.ellipse(capX - 4.5, y + 4.5, 2.6, 1.5, cap.spec, -0.5);
    r.pop();
    // Bordo inferiore del cappello, in ombra.
    r.rect(capX - 12, y + 12, 24, 1.6, alpha(cap.deep, 0.6));

    // Puntini: leggermente scavati nel cappello, quindi hanno un'ombra sopra.
    for (const [dx, dy, rad] of [[-6, -6, 3], [6, -6, 2.6], [0, -10, 2.2], [-10, -1, 1.8], [9, -1, 1.8]] as const) {
      r.ellipse(capX + dx, y + 13 + dy - 0.6, rad, rad * 0.85, alpha(cap.deep, 0.35));
      r.ellipse(capX + dx, y + 13 + dy, rad, rad * 0.85, PALETTE.paper);
      r.ellipse(capX + dx - rad * 0.3, y + 13 + dy - rad * 0.3, rad * 0.4, rad * 0.3, glare(0.7));
    }

    // La faccia: l'unica cosa che tradisce le sue intenzioni.
    for (const side of [-1, 1] as const) {
      const ex = cx + side * 3.2 + lean;
      r.ellipse(ex, y + 16.5, 1.9, 2.2, PALETTE.ink);
      r.ellipse(ex - 0.5, y + 15.8, 0.6, 0.6, glare(0.85));
    }
    // Sorriso: due tratti che salgono. Non è un sorriso gentile.
    r.line([cx - 3.4 + lean, y + 21, cx + lean, y + 19.6, cx + 3.4 + lean, y + 21], 1, shade(0.75));
  }
}
