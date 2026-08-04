import { randRange, randInt } from '@core/math';
import type { Renderer } from '@engine/render/renderer';
import { alpha, glare } from './theme';

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
  /** Emette luce: si somma al fondo invece di coprirlo. */
  light: boolean;
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
  /** Particelle luminose: scintille, schegge d'oro, scariche. */
  light?: boolean;
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
      light = false,
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
        light,
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
        light: true,
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
  /**
   * Da chiamare dentro la trasformazione della camera.
   *
   * Due passate separate: prima i detriti, che coprono ciò che sta sotto, poi
   * le particelle luminose in fusione additiva. Tenerle divise evita di
   * cambiare stato di fusione decine di volte per frame, e soprattutto fa sì
   * che una scintilla si comporti da luce e una scheggia da materia.
   */
  drawWorld(r: Renderer): void {
    for (const p of this.particles) {
      if (p.light) continue;
      this.drawParticle(r, p);
    }

    r.push();
    r.setBlend('add');
    for (const p of this.particles) {
      if (!p.light) continue;
      this.drawParticle(r, p);
    }
    r.pop();

    for (const t of this.texts) {
      const k = t.life / t.maxLife;
      r.push();
      r.setAlpha(Math.min(1, k * 1.6));
      // Ombra portata: il testo resta leggibile su qualunque fondale.
      r.text(t.value, Math.round(t.x), Math.round(t.y) + 1.5, {
        color: 'rgba(0,0,0,0.55)',
        size: t.size,
        align: 'center',
        baseline: 'middle',
      });
      r.text(t.value, Math.round(t.x), Math.round(t.y), {
        color: t.color,
        size: t.size,
        align: 'center',
        baseline: 'middle',
      });
      r.pop();
    }
  }

  /** Una particella: la forma dice di che materia è fatta. */
  private drawParticle(r: Renderer, p: Particle): void {
    const t = p.life / p.maxLife;
    const fade = Math.min(1, t * 1.4);

    if (p.shape === 'circle') {
      // Polvere e fumo: bordo sfumato, mai un cerchio netto.
      r.push();
      r.setAlpha(fade * 0.85);
      r.radial(p.x, p.y, p.size * (2 - t), p.size * (2 - t), [
        { at: 0, color: alpha(p.color, 0.9) },
        { at: 0.5, color: alpha(p.color, 0.45) },
        { at: 1, color: alpha(p.color, 0) },
      ]);
      r.pop();
      return;
    }

    if (p.shape === 'streak') {
      // Scia: allungata nella direzione del moto.
      const len = Math.max(2, p.size * t * 3.2);
      r.push();
      r.setAlpha(fade);
      r.translate(p.x, p.y);
      r.rotate(Math.atan2(p.vy, p.vx));
      r.radial(0, 0, len, Math.max(0.6, p.size * t * 0.4), [
        { at: 0, color: alpha(p.color, 0.95) },
        { at: 1, color: alpha(p.color, 0) },
      ]);
      r.pop();
      return;
    }

    // Scheggia: un frammento solido che ruota su sé stesso.
    const s = Math.max(0.8, p.size * t);
    r.push();
    r.setAlpha(fade);
    r.translate(p.x, p.y);
    r.rotate(p.angle);
    r.rect(-s / 2, -s / 2, s, s * 0.8, p.color);
    r.setAlpha(fade * 0.5);
    r.rect(-s / 2, -s / 2, s, s * 0.25, glare(0.7));
    r.pop();
  }

  /** Da chiamare in coordinate schermo, dopo il mondo. */
  drawOverlay(r: Renderer): void {
    if (this.flashAmount <= 0) return;
    r.push();
    r.setBlend('add');
    r.setAlpha(Math.min(0.7, this.flashAmount));
    // Il lampo è più intenso al centro: un rettangolo pieno acceca e basta.
    r.radial(r.width / 2, r.height / 2, r.width * 0.75, r.height * 0.95, [
      { at: 0, color: alpha(this.flashColor, 0.95) },
      { at: 0.55, color: alpha(this.flashColor, 0.5) },
      { at: 1, color: alpha(this.flashColor, 0.12) },
    ]);
    r.pop();
  }
}
