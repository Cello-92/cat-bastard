import { applyGravity, moveX, moveY, updateGrounded } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { PHYSICS } from '../config';
import { MATERIAL, PALETTE, alpha, glare, shade } from '../theme';
import { isSolid } from '../tiles';
import { DEATH_CAUSE } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * La palla di ghiaccio.
 *
 * Sta ferma in un angolo finché il gatto non entra nel suo raggio, poi rotola
 * verso di lui e non si ferma più: rimbalza sui muri, cade dai bordi, corre
 * più veloce di quanto il gatto possa scappare all'indietro. L'unico modo di
 * gestirla è passarle sopra o passarle *prima*.
 *
 * La direzione di partenza è decisa dalla posizione del gatto nell'istante in
 * cui scatta, quindi è deterministica quanto tutto il resto: rifacendo lo
 * stesso percorso parte sempre allo stesso modo.
 *
 * Schiacciarla non funziona — è una palla di ghiaccio con dentro dei sassi, e
 * si vede.
 */

const SIZE = 30;
const ROLL_SPEED = 3.6;
/** Raggio orizzontale entro cui si sveglia. */
const TRIGGER = 190;
/** Tick di scricchiolio prima di partire: il tempo di sentirla, non di fuggire. */
const WAKE = 12;

export class Snowball extends Entity {
  private wake = -1;

  constructor(x: number, y: number) {
    super(x, y, SIZE, SIZE);
  }

  update(world: World): void {
    if (this.wake < 0) {
      const dx = world.player.centerX - (this.x + this.w / 2);
      if (Math.abs(dx) < TRIGGER) {
        this.wake = WAKE;
        this.vx = Math.sign(dx) * ROLL_SPEED || -ROLL_SPEED;
        world.audio.play('crumble');
      }
    } else if (this.wake > 0) {
      this.wake--;
      // Trema sul posto: la spinta arriva solo a fine conto alla rovescia.
      applyGravity(this, PHYSICS.gravity, 14);
      moveY(this, world.map, isSolid);
      updateGrounded(this, world.map, isSolid);
      return;
    }

    if (this.wake === 0) {
      moveX(this, world.map, isSolid);
      // Contro un muro rimbalza invece di fermarsi: una palla non ci pensa su.
      if (this.hitWall) {
        this.vx = -this.vx;
        world.audio.play('bump');
      }
    }

    applyGravity(this, PHYSICS.gravity, 14);
    moveY(this, world.map, isSolid);
    updateGrounded(this, world.map, isSolid);

    if (this.y > world.map.heightPx + 200) this.expired = true;
  }

  override onStomp(world: World): boolean {
    world.kill(DEATH_CAUSE.snowball);
    return false;
  }

  onTouch(world: World): void {
    world.kill(DEATH_CAUSE.snowball);
  }

  /**
   * Neve compattata attorno a un cuore di ghiaccio, con i sassi raccolti per
   * strada che affiorano dalla superficie. La rotazione è legata alla distanza
   * percorsa, non al tempo: la palla non "slitta" mai, e si vede che rotola
   * perché rotola davvero.
   */
  draw(r: Renderer, tick: number): void {
    const snow = MATERIAL.snow;
    const ice = MATERIAL.ice;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const radius = this.w / 2;
    const shiver = this.wake > 0 ? (tick % 2 ? 1.4 : -1.4) : 0;
    // Un giro completo ogni circonferenza percorsa.
    const spin = this.x / radius;

    this.drawShadow(r, 0.32);

    // Corpo: neve con il cuore di ghiaccio che traspare in basso a destra.
    r.ellipse(cx + shiver, cy, radius, radius, snow.base);
    r.push();
    r.setAlpha(0.9);
    r.radial(cx - radius * 0.35 + shiver, cy - radius * 0.4, radius * 0.9, radius * 0.9, [
      { at: 0, color: alpha(snow.light, 1) },
      { at: 1, color: alpha(snow.light, 0) },
    ]);
    r.setAlpha(0.75);
    r.radial(cx + radius * 0.3 + shiver, cy + radius * 0.35, radius * 0.8, radius * 0.8, [
      { at: 0, color: alpha(ice.dark, 0.85) },
      { at: 1, color: alpha(ice.dark, 0) },
    ]);
    r.pop();

    // Strati di neve arrotolata: archi che girano con la palla.
    r.push();
    r.setAlpha(0.4);
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI * 2) / 3;
      const ax = cx + Math.cos(a) * radius * 0.5 + shiver;
      const ay = cy + Math.sin(a) * radius * 0.5;
      r.ellipse(ax, ay, radius * 0.42, radius * 0.3, alpha(snow.dark, 0.8), a);
    }
    r.pop();

    // Sassi inglobati: girano con la palla, e sono il motivo per cui uccide.
    for (let i = 0; i < 4; i++) {
      const a = spin * 1.02 + (i * Math.PI) / 2;
      const rr = radius * (0.4 + (i % 2) * 0.28);
      const px = cx + Math.cos(a) * rr + shiver;
      const py = cy + Math.sin(a) * rr;
      r.ellipse(px, py + 0.6, 2.6, 2.2, alpha(MATERIAL.rock.deep, 0.5));
      r.ellipse(px, py, 2.6, 2.2, MATERIAL.rock.base);
      r.ellipse(px - 0.8, py - 0.7, 1.1, 0.9, alpha(MATERIAL.rock.light, 0.8));
    }

    // Riflesso speculare: stretto e alto a sinistra, come su ogni sfera lucida.
    r.push();
    r.setAlpha(0.8);
    r.ellipse(cx - radius * 0.4 + shiver, cy - radius * 0.5, 3.4, 2.2, glare(0.9), -0.6);
    r.pop();

    // Sveglia: crepita e sputa neve prima di partire.
    if (this.wake > 0) {
      r.push();
      r.setAlpha(0.5);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + tick * 0.2;
        r.ellipse(cx + Math.cos(a) * (radius + 4), cy + Math.sin(a) * (radius + 4), 1.6, 1.6, PALETTE.ice);
      }
      r.pop();
    } else if (this.wake === 0) {
      // In corsa lascia una scia di neve alzata.
      r.push();
      r.setAlpha(0.22);
      const back = cx - Math.sign(this.vx) * (radius + 6);
      r.radial(back, cy + radius * 0.5, 14, 5, [
        { at: 0, color: alpha(snow.light, 0.9) },
        { at: 1, color: alpha(snow.light, 0) },
      ]);
      r.pop();
    }

    // Occlusione dove tocca il pavimento.
    r.push();
    r.setAlpha(0.3);
    r.radial(cx, this.y + this.h - 1, radius * 0.9, 3, [
      { at: 0, color: shade(0.85) },
      { at: 1, color: shade(0) },
    ]);
    r.pop();
  }
}
