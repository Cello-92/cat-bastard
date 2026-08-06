import type { Renderer } from '@engine/render/renderer';
import { PHYSICS } from '../config';
import { MATERIAL, alpha, glare, shade } from '../theme';
import { DEATH_CAUSE, type DeathCause } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * La stalattite che cade dal mattone-trappola quando ci passi sotto.
 *
 * Ignora la mappa di proposito: attraversa tutto, deve solo raggiungerti.
 * Ha un breve preavviso visivo (tremolio) perché la trappola resti leale:
 * al secondo tentativo il giocatore deve poterla evitare.
 */

const WIDTH = 24;
const HEIGHT = 26;
const TELEGRAPH_TICKS = 14;

export class FallingSpike extends Entity {
  private telegraph: number;
  private readonly cause: DeathCause;

  /**
   * `telegraph` è quanti tick trema prima di partire. Il mattone-trappola ne
   * concede una manciata; il masso che crolla dal soffitto zero — cade
   * nell'istante in cui gli passi sotto, e la prima volta non c'è verso di
   * saperlo.
   *
   * E siccome sono due trappole diverse, sono anche due morti diverse: `cause`
   * decide quale battuta arriva dopo. Con una sola, il crollo di `K` finiva
   * spiegato come una stalattite di `T`, che è la spiegazione sbagliata.
   */
  constructor(
    x: number,
    y: number,
    telegraph = TELEGRAPH_TICKS,
    cause: DeathCause = DEATH_CAUSE.fallingSpike,
  ) {
    super(x, y, WIDTH, HEIGHT);
    this.telegraph = telegraph;
    this.cause = cause;
  }

  update(world: World): void {
    if (this.telegraph > 0) {
      this.telegraph--;
      return;
    }
    this.vy = Math.min(this.vy + PHYSICS.gravity * 0.9, 13);
    this.y += this.vy;

    if (this.y > world.map.heightPx + 200) this.expired = true;
  }

  onTouch(world: World): void {
    world.kill(this.cause);
  }

  override onStomp(world: World): boolean {
    world.kill(this.cause);
    return false;
  }

  /**
   * Stalattite di roccia: sezione a strati, punta bagnata, e durante il
   * preavviso una vibrazione con la polvere che si stacca dal soffitto.
   */
  draw(r: Renderer, tick: number): void {
    const rock = MATERIAL.rock;
    const warning = this.telegraph > 0;
    // Durante il preavviso trema sul posto invece di cadere.
    const shake = warning ? (tick % 2 ? 1.6 : -1.6) : 0;
    const x = this.x + shake;
    const y = this.y;
    const cx = x + WIDTH / 2;
    const tipY = y + HEIGHT;

    // Corpo: due facce divise dallo spigolo centrale.
    r.polygon([x, y, x + WIDTH, y, cx, tipY], rock.base);
    r.polygon([x, y, cx, tipY, cx, y], rock.light);
    r.polygon([cx, y, cx, tipY, x + WIDTH, y], rock.dark);

    // Strati di deposito: anelli orizzontali che seguono il restringimento.
    r.push();
    r.setAlpha(0.4);
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const half = (WIDTH / 2) * (1 - t) + 1;
      const ly = y + HEIGHT * t;
      r.line([cx - half, ly, cx + half, ly], 1, i % 2 ? rock.deep : rock.light);
    }
    r.pop();

    // Attacco al soffitto: la roccia da cui si è staccata.
    r.gradientRect(x - 2, y - 2, WIDTH + 4, 6, [
      { at: 0, color: rock.dark },
      { at: 0.5, color: rock.base },
      { at: 1, color: rock.deep },
    ]);
    r.rect(x - 2, y - 2, WIDTH + 4, 1, alpha(rock.light, 0.5));

    // Punta: bagnata, quindi con un riflesso netto. Si vede arrivare.
    r.push();
    r.setAlpha(0.8);
    r.radial(cx, tipY - 3, 3, 5, [
      { at: 0, color: glare(0.85) },
      { at: 1, color: glare(0) },
    ]);
    r.pop();
    r.line([cx, tipY - 7, cx, tipY], 1.2, alpha(rock.spec, 0.9));

    if (warning) {
      // Polvere che cade dal soffitto: il preavviso deve vedersi da lontano.
      r.push();
      r.setAlpha(0.35 + (tick % 4) * 0.05);
      for (let i = 0; i < 4; i++) {
        const dx = x + 3 + i * 6;
        r.rect(dx, y + 6 + ((tick * 2 + i * 7) % 18), 1.2, 3, alpha(rock.light, 0.9));
      }
      r.pop();
      r.push();
      r.setBlend('add');
      r.setAlpha(0.12 + (tick % 6) * 0.02);
      r.radial(cx, y + 8, 22, 16, [
        { at: 0, color: glare(0.5) },
        { at: 1, color: glare(0) },
      ]);
      r.pop();
    } else {
      // In caduta lascia una scia d'aria compressa.
      r.push();
      r.setAlpha(0.2);
      r.radial(cx, y - 6, 6, 14, [
        { at: 0, color: shade(0.5) },
        { at: 1, color: shade(0) },
      ]);
      r.pop();
    }
  }
}
