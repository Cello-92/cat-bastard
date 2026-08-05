import type { Renderer } from '@engine/render/renderer';
import { FEEL } from '../config';
import { MATERIAL, PALETTE, alpha, glare } from '../theme';
import { DEATH_CAUSE } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * Il drone di sorveglianza.
 *
 * Vola avanti e indietro su una rotta fissa, sempre alla stessa quota, sempre
 * alla stessa velocità: è un orologio, non un cacciatore. Non insegue, non
 * cambia idea, non ti vede nemmeno.
 *
 * Ed è l'unico nemico del mondo nuovo che si può schiacciare davvero, con
 * tanto di rimbalzo: una scorciatoia, mai una necessità — nessun passaggio
 * dipende da lui, perché un passaggio che dipende da un nemico è un passaggio
 * che il risolutore non può garantire. È il nemico che serve: dopo dodici
 * trappole che puniscono la fiducia, una cosa che funziona come dovrebbe
 * rimette in dubbio tutto il resto.
 */

const WIDTH = 26;
const HEIGHT = 16;
const SPEED = 1.15;
/** Semiampiezza della rotta, in pixel: quattro colonne in tutto. */
const RANGE = 62;

export class Drone extends Entity {
  private readonly homeX: number;

  constructor(x: number, y: number) {
    super(x, y, WIDTH, HEIGHT);
    this.homeX = x;
    this.vx = SPEED;
  }

  update(_world: World): void {
    this.x += this.vx;
    // Inverte ai capi della rotta. Nessuna mappa, nessuna collisione: la
    // traiettoria è quella dichiarata allo spawn, e non cambia mai.
    if (this.x > this.homeX + RANGE) {
      this.x = this.homeX + RANGE;
      this.vx = -SPEED;
    } else if (this.x < this.homeX - RANGE) {
      this.x = this.homeX - RANGE;
      this.vx = SPEED;
    }
  }

  /** Schiacciarlo lo abbatte e rimbalza: è un nemico, ma anche una scala. */
  override onStomp(world: World): boolean {
    this.expired = true;
    world.audio.play('stomp');
    world.camera.shake(FEEL.screenShakeOnStomp);
    world.effects.freeze(3);
    world.effects.burst(this.x + this.w / 2, this.y + this.h / 2, PALETTE.stone, {
      count: 14,
      speed: 3.8,
      size: 4,
      gravity: 0.4,
    });
    world.effects.ring(this.x + this.w / 2, this.y + this.h / 2, PALETTE.steam, 3.4, 12);
    return true;
  }

  onTouch(world: World): void {
    world.kill(DEATH_CAUSE.drone);
  }

  /**
   * Scafo piatto d'alluminio, due rotori che girano troppo in fretta per
   * vedersi, un occhio che scandaglia il pavimento. Il fascio di luce sotto
   * serve a una cosa sola: far capire dove passerà, prima che ci passi.
   */
  draw(r: Renderer, tick: number): void {
    const plate = MATERIAL.plate;
    const cx = this.x + this.w / 2;
    const hover = Math.sin(tick / 11) * 1.4;
    const cy = this.y + this.h / 2 + hover;
    const facing = Math.sign(this.vx) || 1;

    // Fascio di ispezione: cade sul pavimento e dice dove sta guardando.
    r.push();
    r.setBlend('add');
    r.setAlpha(0.12);
    r.polygon([cx - 5, cy + 4, cx + 5, cy + 4, cx + 18, cy + 60, cx - 18, cy + 60], PALETTE.steam);
    r.pop();

    // Rotori: due dischi sfocati dal movimento, uno per lato.
    for (const side of [-1, 1] as const) {
      const rx = cx + side * 10;
      const spin = Math.sin(tick / 1.7 + side) * 0.5 + 1;
      r.push();
      r.setAlpha(0.35);
      r.ellipse(rx, cy - 6, 9 * spin, 1.8, alpha(MATERIAL.steel.light, 0.9));
      r.pop();
      r.rect(rx - 1, cy - 6, 2, 5, MATERIAL.iron.dark);
    }

    // Scafo: gradiente orizzontale, quindi si legge come un guscio bombato.
    r.gradientRect(cx - WIDTH / 2 + 2, cy - 4, WIDTH - 4, 10, [
      { at: 0, color: plate.dark },
      { at: 0.3, color: plate.light },
      { at: 0.55, color: plate.base },
      { at: 1, color: plate.deep },
    ]);
    r.rect(cx - WIDTH / 2 + 2, cy - 4, WIDTH - 4, 1.3, alpha(plate.spec, 0.8));

    // Pattern di pericolo sul dorso: giallo e nero, come sulle macchine vere.
    r.push();
    r.setAlpha(0.7);
    for (let i = 0; i < 4; i++) {
      const sx = cx - 8 + i * 5;
      r.polygon([sx, cy - 3, sx + 2.4, cy - 3, sx - 1.4, cy + 1, sx - 3.8, cy + 1], MATERIAL.gold.base);
    }
    r.pop();

    // Occhio: guarda avanti, pulsa piano. È l'unica parte "viva".
    const ex = cx + facing * 8;
    r.ellipse(ex, cy + 1.5, 3.2, 3.2, MATERIAL.iron.deep);
    r.ellipse(ex, cy + 1.5, 2.2, 2.2, PALETTE.hot);
    r.ellipse(ex - 0.7, cy + 0.8, 0.8, 0.8, glare(0.9));
    r.push();
    r.setBlend('add');
    r.setAlpha(0.2 + Math.abs(Math.sin(tick / 22)) * 0.2);
    r.radial(ex, cy + 1.5, 13, 10, [
      { at: 0, color: alpha(PALETTE.hot, 0.6) },
      { at: 1, color: alpha(PALETTE.hot, 0) },
    ]);
    r.pop();

    // Carrello d'atterraggio: è la parte su cui si atterra davvero.
    r.rect(cx - 9, cy + 6, 18, 2, MATERIAL.iron.base);
    r.rect(cx - 9, cy + 6, 18, 0.8, alpha(MATERIAL.iron.light, 0.6));
  }
}
