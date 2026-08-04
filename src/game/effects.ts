import { randRange, randInt } from '@core/math';
import type { Renderer } from '@engine/render/renderer';

/**
 * Sistema di effetti: particelle, testi fluttuanti, flash e hit-stop.
 *
 * È il reparto "juice": non cambia una virgola delle regole del gioco, ma è la
 * differenza tra un platform legnoso e uno che si sente bene sotto le dita.
 */

type ParticleShape = 'square' | 'circle' | 'streak';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: ParticleShape;
  gravity: number;
  drag: number;
  spin: number;
  angle: number;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  value: string;
  color: string;
  size: number;
}

export interface BurstOptions {
  count?: number;
  speed?: number;
  size?: number;
  life?: number;
  gravity?: number;
  drag?: number;
  shape?: ParticleShape;
  /** Direzione preferita in radianti; se assente il burst è radiale. */
  angle?: number;
  /** Ampiezza del cono attorno ad `angle`, in radianti. */
  spread?: number;
}

const MAX_PARTICLES = 420;

export class Effects {
  private readonly particles: Particle[] = [];
  private readonly texts: FloatingText[] = [];

  /** Flash a schermo intero: 0 = niente. */
  private flashAmount = 0;
  private flashColor = '#ffffff';

  /** Tick di fermo immagine residui: congela la simulazione, non il rendering. */
  private freezeTicks = 0;

  // ------------------------------------------------------------ spawn
  burst(x: number, y: number, color: string, options: BurstOptions = {}): void {
    const {
      count = 10,
      speed = 3,
      size = 4,
      life = 30,
      gravity = 0.28,
      drag = 1,
      shape = 'square',
      angle,
      spread = Math.PI * 2,
    } = options;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const dir = angle === undefined ? randRange(0, Math.PI * 2) : angle + randRange(-spread / 2, spread / 2);
      const power = randRange(speed * 0.35, speed);
      const maxLife = life * randRange(0.7, 1.3);
      this.particles.push({
        x,
        y,
        vx: Math.cos(dir) * power,
        vy: Math.sin(dir) * power,
        life: maxLife,
        maxLife,
        size: size * randRange(0.7, 1.25),
        color,
        shape,
        gravity,
        drag,
        angle: randRange(0, Math.PI * 2),
        spin: randRange(-0.25, 0.25),
      });
    }
  }

  /** Polvere all'atterraggio: si allarga in orizzontale e resta bassa. */
  landingDust(x: number, y: number, color: string, power = 1): void {
    this.burst(x, y, color, {
      count: randInt(5, 8),
      speed: 2.4 * power,
      size: 3.5,
      life: 22,
      gravity: 0.06,
      drag: 0.9,
      shape: 'circle',
      angle: Math.PI,
      spread: Math.PI,
    });
  }

  /**
   * Sbuffo di polvere sotto il piede che tocca terra.
   * Poche particelle, lente e basse: deve leggersi come polvere, non come
   * scintille. Ne esce una per falcata, non una per frame.
   */
  footstepDust(x: number, y: number, color: string, facing: number): void {
    this.burst(x, y, color, {
      count: randInt(2, 3),
      speed: 1.1,
      size: 3,
      life: 18,
      gravity: -0.02,
      drag: 0.88,
      shape: 'circle',
      angle: facing > 0 ? Math.PI : 0,
      spread: Math.PI * 0.55,
    });
  }

  /** Anello di scintille: impatti forti, blocchi rotti, morte. */
  ring(x: number, y: number, color: string, radiusSpeed = 4.5, count = 16): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const dir = (i / count) * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(dir) * radiusSpeed,
        vy: Math.sin(dir) * radiusSpeed * 0.75,
        life: 26,
        maxLife: 26,
        size: 4,
        color,
        shape: 'circle',
        gravity: 0.05,
        drag: 0.9,
        angle: 0,
        spin: 0,
      });
    }
  }

  floatingText(x: number, y: number, value: string, color: string, size = 14): void {
    this.texts.push({ x, y, vy: -1.15, life: 46, maxLife: 46, value, color, size });
  }

  flash(amount: number, color = '#ffffff'): void {
    this.flashAmount = Math.max(this.flashAmount, amount);
    this.flashColor = color;
  }

  /** Fermo immagine di qualche tick: dà peso agli impatti. */
  freeze(ticks: number): void {
    this.freezeTicks = Math.max(this.freezeTicks, ticks);
  }

  // ------------------------------------------------------------ ciclo
  /**
   * Consuma un tick di hit-stop. Ritorna true se la simulazione del gioco
   * deve essere saltata per questo tick.
   */
  consumeFreeze(): boolean {
    if (this.freezeTicks <= 0) return false;
    this.freezeTicks--;
    return true;
  }

  update(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.angle += p.spin;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      if (!t) continue;
      t.y += t.vy;
      t.vy *= 0.94;
      t.life--;
      if (t.life <= 0) this.texts.splice(i, 1);
    }

    this.flashAmount *= 0.82;
    if (this.flashAmount < 0.01) this.flashAmount = 0;
  }

  clear(): void {
    this.particles.length = 0;
    this.texts.length = 0;
    this.flashAmount = 0;
    this.freezeTicks = 0;
  }

  // ------------------------------------------------------------ disegno
  /** Da chiamare dentro la trasformazione della camera. */
  drawWorld(r: Renderer): void {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      r.push();
      r.setAlpha(Math.min(1, t * 1.4));
      if (p.shape === 'circle') {
        r.ellipse(p.x, p.y, p.size * t, p.size * t, p.color);
      } else if (p.shape === 'streak') {
        r.rect(Math.round(p.x), Math.round(p.y), p.size * t * 2.2, Math.max(1, p.size * t * 0.5), p.color);
      } else {
        const s = Math.max(1, p.size * t);
        r.rect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s, p.color);
      }
      r.pop();
    }

    for (const t of this.texts) {
      const k = t.life / t.maxLife;
      r.push();
      r.setAlpha(Math.min(1, k * 1.6));
      r.text(t.value, Math.round(t.x), Math.round(t.y), {
        color: t.color,
        size: t.size,
        align: 'center',
        baseline: 'middle',
      });
      r.pop();
    }
  }

  /** Da chiamare in coordinate schermo, dopo il mondo. */
  drawOverlay(r: Renderer): void {
    if (this.flashAmount <= 0) return;
    r.push();
    r.setAlpha(Math.min(0.85, this.flashAmount));
    r.clear(this.flashColor);
    r.pop();
  }
}
