import type { Renderer } from '@engine/render/renderer';
import { PHYSICS } from '../config';
import { MATERIAL, PALETTE, alpha, glare, shade } from '../theme';
import { DEATH_CAUSE } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * La bestia appesa al soffitto.
 *
 * Sta ferma finché il gatto non le passa sotto, poi si lascia cadere. Non
 * insegue, non corregge la traiettoria: cade e basta. È deterministica come
 * tutto il resto — al secondo tentativo si evita passando un attimo prima o
 * un attimo dopo, ed è esattamente questo il gioco.
 *
 * Ignora la mappa mentre cade: quello che deve raggiungere è il pavimento,
 * o te.
 */

const WIDTH = 26;
const HEIGHT = 20;
/** Colonne di anticipo con cui apre le ali prima di staccarsi. */
const TRIGGER_RANGE = 26;
const TELEGRAPH_TICKS = 16;
const MAX_FALL = 15;

export class Diver extends Entity {
  private telegraph = -1;

  constructor(x: number, y: number) {
    super(x, y, WIDTH, HEIGHT);
  }

  update(world: World): void {
    if (this.telegraph < 0) {
      // In attesa: si sgancia solo se il gatto è davvero sotto di lei.
      const dx = Math.abs(world.player.centerX - (this.x + this.w / 2));
      const below = world.player.y > this.y;
      if (dx < TRIGGER_RANGE && below) {
        this.telegraph = TELEGRAPH_TICKS;
        world.audio.play('trap');
      }
      return;
    }

    if (this.telegraph > 0) {
      this.telegraph--;
      return;
    }

    this.vy = Math.min(this.vy + PHYSICS.gravity * 1.15, MAX_FALL);
    this.y += this.vy;

    if (this.y > world.map.heightPx + 200) this.expired = true;
  }

  onTouch(world: World): void {
    world.kill(DEATH_CAUSE.diver);
  }

  /** Ha le zampe all'insù: schiacciarla significa atterrare sugli artigli. */
  override onStomp(world: World): boolean {
    world.kill(DEATH_CAUSE.diver);
    return false;
  }

  draw(r: Renderer, tick: number): void {
    const membrane = MATERIAL.membrane;
    const hide = MATERIAL.hide;
    const charging = this.telegraph > 0;
    const hanging = this.telegraph < 0;
    // Appesa respira piano; in carica vibra; in caduta è tesa.
    const shake = charging ? (tick % 2 ? 1.4 : -1.4) : 0;
    const breathe = hanging ? Math.sin(tick / 34) * 0.8 : 0;
    const x = this.x + shake;
    const y = this.y + breathe;
    const cx = x + this.w / 2;
    const cy = y + 9;

    // Ali: chiuse quando dorme, spalancate quando sta per staccarsi.
    const spread = hanging ? 0.35 : charging ? 0.6 + (TELEGRAPH_TICKS - this.telegraph) / TELEGRAPH_TICKS * 0.4 : 1;
    const span = 15 * spread;
    for (const side of [-1, 1] as const) {
      const tipX = cx + side * span;
      r.blob(
        [
          cx + side * 3, cy - 3,
          tipX, cy - 6 - spread * 3,
          tipX + side * 2, cy + 2,
          cx + side * 6, cy + 6,
        ],
        membrane.base,
      );
      // Nervature dell'ala: controluce, si vedono contro la membrana.
      r.push();
      r.setAlpha(0.45);
      for (let i = 1; i <= 2; i++) {
        r.line([cx + side * 3, cy - 2, cx + side * (3 + i * span * 0.42), cy + 3 - i], 0.9, membrane.dark);
      }
      r.pop();
      // Bordo superiore illuminato.
      r.push();
      r.setAlpha(0.5);
      r.line([cx + side * 3, cy - 3, tipX, cy - 6 - spread * 3], 1, alpha(membrane.light, 0.9));
      r.pop();
    }

    // Corpo peloso.
    r.ellipse(cx, cy, 7.5, 8, hide.base);
    r.push();
    r.setAlpha(0.85);
    r.radial(cx - 2.5, cy - 3, 6, 5.5, [
      { at: 0, color: alpha(hide.light, 0.95) },
      { at: 1, color: alpha(hide.light, 0) },
    ]);
    r.setAlpha(0.6);
    r.radial(cx + 2, cy + 4, 6, 4, [
      { at: 0, color: alpha(hide.dark, 0.9) },
      { at: 1, color: alpha(hide.dark, 0) },
    ]);
    r.pop();

    // Orecchie a punta.
    r.polygon([cx - 5, cy - 5, cx - 6.5, cy - 11, cx - 1.5, cy - 6], hide.dark);
    r.polygon([cx + 5, cy - 5, cx + 6.5, cy - 11, cx + 1.5, cy - 6], hide.dark);

    // Occhi: chiusi finché dorme, due fessure accese appena si sveglia.
    if (hanging) {
      r.push();
      r.setAlpha(0.7);
      r.line([cx - 4.5, cy - 1, cx - 1.5, cy - 1], 1.2, hide.deep);
      r.line([cx + 1.5, cy - 1, cx + 4.5, cy - 1], 1.2, hide.deep);
      r.pop();
    } else {
      for (const side of [-1, 1] as const) {
        const ex = cx + side * 3;
        r.ellipse(ex, cy - 1, 2, 2.2, PALETTE.hotDeep);
        r.ellipse(ex, cy - 1, 1.2, 1.5, PALETTE.hot);
        r.ellipse(ex - 0.4, cy - 1.6, 0.5, 0.5, glare(0.9));
      }
      r.push();
      r.setBlend('add');
      r.setAlpha(0.3);
      r.radial(cx, cy - 1, 14, 10, [
        { at: 0, color: alpha(PALETTE.hot, 0.6) },
        { at: 1, color: alpha(PALETTE.hot, 0) },
      ]);
      r.pop();
    }

    // Artigli: rivolti in basso, sono il motivo per cui non si può schiacciare.
    for (let i = -1; i <= 1; i++) {
      const clawX = cx + i * 4;
      r.polygon([clawX - 1.4, cy + 6, clawX + 1.4, cy + 6, clawX, cy + 11], MATERIAL.steel.base);
      r.line([clawX, cy + 7, clawX, cy + 10.5], 0.7, alpha(MATERIAL.steel.spec, 0.8));
    }

    // Appesa, getta un'ombra sul soffitto sopra di sé.
    if (hanging) {
      r.push();
      r.setAlpha(0.25);
      r.radial(cx, y - 2, 12, 3, [
        { at: 0, color: shade(0.8) },
        { at: 1, color: shade(0) },
      ]);
      r.pop();
    }
  }
}
