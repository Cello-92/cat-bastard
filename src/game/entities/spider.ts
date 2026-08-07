import { isGrounded, moveX, type Down } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import type { TileMap } from '@engine/tilemap';
import { FEEL, TILE_SIZE } from '../config';
import { MATERIAL, PALETTE, alpha, glare } from '../theme';
import { DEATH_CAUSE } from '../taunts';
import { isSolid } from '../tiles';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * Il ragno di vetro.
 *
 * È il nemico del quarto mondo perché è l'unico che della gravità **non sa
 * niente**: sta attaccato con le zampe e cammina, e se la superficie è un
 * soffitto cammina uguale. Non insegue, non cambia idea, non cade mai: arriva
 * in fondo alla lastra, si gira, torna indietro. Un metronomo con sei zampe.
 *
 * Serve a due cose, e la seconda è quella che conta. La prima è ovvia: mette
 * un nemico dove il giocatore non guarda mai, cioè sopra la testa. La seconda
 * è che **si schiaccia solo arrivandoci dalla sua parte** — e sul soffitto
 * quello vuol dire essere capovolti. È l'unico nemico del gioco che cambia da
 * cosa-che-uccide a cosa-che-si-schiaccia a seconda di come sei messo tu, e
 * non perché lui faccia qualcosa di diverso: la regola dello stomp è sempre
 * la stessa, misurata rispetto al proprio peso (vedi `World.handleEntities`).
 *
 * Non è mai un appoggio necessario, come tutti gli altri nemici: il
 * risolutore non conosce le entità, quindi un passaggio che dipendesse da lui
 * sarebbe un passaggio che nessun test può garantire.
 */

const WIDTH = 22;
const HEIGHT = 14;
const SPEED = 0.85;

export class Spider extends Entity {
  /**
   * A quale superficie è attaccato: +1 al pavimento, -1 al soffitto.
   *
   * Si decide una volta sola, al caricamento, guardando la cella: se sopra il
   * marcatore c'è del solido il ragno ci sta appeso, altrimenti poggia su
   * quello che ha sotto. Non cambia mai — un ragno che si stacca è un ragno
   * che cade, e questa bestia non cade.
   */
  private readonly cling: Down;

  constructor(c: number, r: number, map: TileMap) {
    const hanging = isSolid(map.get(c, r - 1));
    const y = hanging ? r * TILE_SIZE : (r + 1) * TILE_SIZE - HEIGHT;
    super(c * TILE_SIZE + (TILE_SIZE - WIDTH) / 2, y, WIDTH, HEIGHT);
    this.cling = hanging ? -1 : 1;
    this.vx = SPEED;
  }

  /** Sta appeso a testa in giù? Serve solo al disegno. */
  get hanging(): boolean {
    return this.cling < 0;
  }

  update(world: World): void {
    const before = this.x;
    moveX(this, world.map, isSolid);

    // Due modi di dover tornare indietro, e vengono trattati uguale: un muro
    // davanti, o la lastra che finisce. Il secondo si sonda dopo aver mosso e
    // si annulla, che è il modo più semplice per non staccarsi mai di un pixel.
    if (this.hitWall || !isGrounded(this, world.map, isSolid, this.cling)) {
      this.x = before;
      this.vx = -this.vx;
    }
  }

  /** Schiacciarlo funziona, ma bisogna arrivarci dalla parte della sua pancia. */
  override onStomp(world: World): boolean {
    this.expired = true;
    world.audio.play('stomp');
    world.camera.shake(FEEL.screenShakeOnStomp);
    world.effects.freeze(3);
    world.effects.burst(this.x + this.w / 2, this.y + this.h / 2, PALETTE.shard, {
      count: 16,
      speed: 3.8,
      size: 4,
      gravity: 0.4 * this.cling,
    });
    world.effects.ring(this.x + this.w / 2, this.y + this.h / 2, MATERIAL.glass.light, 3.2, 12);
    return true;
  }

  onTouch(world: World): void {
    world.kill(DEATH_CAUSE.spider);
  }

  /**
   * Corpo di vetro soffiato con dentro qualcosa che si muove, e sei zampe di
   * ottone che finiscono in ganci. Tutto il disegno è scritto come se fosse
   * appoggiato a terra e poi ribaltato se sta appeso: è la stessa scelta fatta
   * per il gatto, e per lo stesso motivo — un secondo disegno prima o poi
   * diverge dal primo.
   */
  draw(r: Renderer, tick: number): void {
    if (this.hanging) {
      const cy = this.y + this.h / 2;
      r.push();
      r.translate(this.x + this.w / 2, cy);
      r.scale(1, -1);
      r.translate(-(this.x + this.w / 2), -cy);
      this.drawUpright(r, tick);
      r.pop();
      return;
    }
    this.drawUpright(r, tick);
  }

  private drawUpright(r: Renderer, tick: number): void {
    const shell = MATERIAL.glass;
    const brass = MATERIAL.brass;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h * 0.42;
    const facing = Math.sign(this.vx) || 1;
    // Le zampe si muovono con la distanza percorsa, non col tempo: un ragno
    // fermo (non capita, ma) non deve zampettare per aria.
    const step = Math.sin(this.x / 5) * 2.2;

    this.drawShadow(r, 0.16);

    // Zampe: tre per lato, il piede sempre appoggiato alla lastra.
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1] as const) {
        const knee = cx + side * (7 + i * 2.5);
        const foot = cx + side * (10 + i * 3.5);
        const lift = i === 1 ? Math.max(0, step * side) : 0;
        r.line(
          [cx + side * 3, cy + 1, knee, cy - 3 - i, foot, this.y + this.h - lift],
          1.4,
          brass.dark,
        );
        r.line([knee, cy - 3 - i, foot, this.y + this.h - lift], 0.8, alpha(brass.light, 0.6));
        // Il gancio in punta: è quello che spiega perché non cade.
        r.ellipse(foot, this.y + this.h - lift, 1.2, 0.9, brass.base);
      }
    }

    // Addome: una goccia di vetro. Si vede attraverso, quindi va disegnato
    // prima quello che c'è dentro e poi il guscio sopra.
    r.push();
    r.setAlpha(0.55);
    r.ellipse(cx - facing * 3, cy + 1, 7.5, 5.2, alpha(shell.base, 0.9));
    r.pop();
    r.push();
    r.setBlend('add');
    r.setAlpha(0.3 + Math.abs(Math.sin(tick / 18)) * 0.2);
    r.ellipse(cx - facing * 3, cy + 1, 3.4, 2.4, alpha(PALETTE.field, 0.9));
    r.pop();
    r.push();
    r.setAlpha(0.6);
    r.line(
      [cx - facing * 9, cy - 1, cx - facing * 3, cy - 4, cx + facing * 3, cy - 1],
      1,
      alpha(shell.spec, 0.9),
    );
    r.pop();

    // Cefalotorace e occhi: quattro punti in fila, e guardano avanti.
    r.ellipse(cx + facing * 5, cy, 4.2, 3.4, brass.base);
    r.ellipse(cx + facing * 4, cy - 1, 2.2, 1.6, brass.light);
    for (let i = 0; i < 4; i++) {
      const ex = cx + facing * (6.5 + (i % 2) * 1.6);
      const ey = cy - 1.4 + Math.floor(i / 2) * 2;
      r.ellipse(ex, ey, 0.75, 0.75, PALETTE.ink);
      r.ellipse(ex - 0.25, ey - 0.25, 0.3, 0.3, glare(0.9));
    }
  }
}
