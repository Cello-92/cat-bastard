import type { Renderer } from '@engine/render/renderer';
import { PHYSICS } from '../config';
import { PALETTE } from '../theme';
import { DEATH_CAUSE } from '../taunts';
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
  private telegraph = TELEGRAPH_TICKS;

  constructor(x: number, y: number) {
    super(x, y, WIDTH, HEIGHT);
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
    world.kill(DEATH_CAUSE.fallingSpike);
  }

  override onStomp(world: World): boolean {
    world.kill(DEATH_CAUSE.fallingSpike);
    return false;
  }

  draw(r: Renderer, tick: number): void {
    // Durante il preavviso trema sul posto invece di cadere.
    const shake = this.telegraph > 0 ? (tick % 2 ? 1.5 : -1.5) : 0;
    const x = Math.round(this.x) + shake;
    const y = Math.round(this.y);

    r.polygon([x, y, x + WIDTH, y, x + WIDTH / 2, y + HEIGHT], PALETTE.stone);
    r.push();
    r.setAlpha(0.3);
    r.polygon([x + WIDTH / 2, y, x + WIDTH, y, x + WIDTH / 2, y + HEIGHT], '#000000');
    r.pop();
    r.rect(x, y, WIDTH, 4, PALETTE.stoneDark);
    // Luce sulla punta: si vede arrivare anche di sfuggita.
    r.push();
    r.setAlpha(0.55);
    r.ellipse(x + WIDTH / 2, y + HEIGHT - 2, 2, 3, PALETTE.paper);
    r.pop();
  }
}
