import { applyGravity, moveY, updateGrounded } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { FEEL, PHYSICS } from '../config';
import { MATERIAL, PALETTE, alpha, glare, shade } from '../theme';
import { DEATH_CAUSE } from '../taunts';
import { isSolid } from '../tiles';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * La zavorra.
 *
 * Un blocco di piombo che non decide niente e non insegue nessuno: **obbedisce
 * al campo**. Cade nel verso in cui il campo la manda, si ferma dove trova
 * appoggio, e sta lì. Nient'altro.
 *
 * È il campo rovescio reso visibile, ed è il suo mestiere — come lo scarabeo
 * era il vento del mondo 3. La regola 7 del patto dice che tutto dev'essere
 * ricostruibile, e il luccichio del campo lo dice a metà: dice che lì c'è
 * qualcosa, non se funziona. Una zavorra appoggiata al **soffitto** dice
 * "questo campo è vero"; una zavorra rimasta a terra sotto una colonna che
 * luccica dice "questo campo è spento, e se ci salti dentro cadi". Chi le
 * guarda prima di saltare non muore, e chi non le guarda impara guardandole
 * dopo — che è esattamente il ritmo di questo gioco.
 *
 * Non si schiaccia: pesa una tonnellata. Toccarla uccide da qualunque parte,
 * ed è deliberato — è ferro con i ganci, non un nemico con una testa.
 */

const SIZE = 26;
/** Terminale sua: più lenta di un gatto in caduta, così si vede partire. */
const TERMINAL = 11;

export class Ballast extends Entity {
  /**
   * Si sta muovendo?
   *
   * Serve allo scontro di 4-11, e non è un dettaglio: quello che fa male al
   * Rovescio è il peso che **cade**, non il peso che sta lì. È la stessa
   * identica regola del masso del Padrone, che se è già a terra non è più
   * un'arma di nessuno.
   */
  falling = false;

  /** Da che parte è caduta l'ultima volta: serve solo al disegno della polvere. */
  private down = 1;

  constructor(x: number, y: number) {
    super(x, y, SIZE, SIZE);
  }

  update(world: World): void {
    // Il campo lo si chiede al mondo, esattamente come fa il gatto: è l'unico
    // che sa insieme quali celle sono campi e se la stanza intera è capovolta.
    //
    // Ma su una sagoma **allargata di cinque pixel per lato**, e per la stessa
    // ragione dello scarabeo del mondo 3: il marcatore `z` viene tolto dalla
    // griglia al caricamento, quindi la zavorra nasce sempre dentro una cella
    // vuota alta e larga quanto lei. Con la sagoma esatta quella cella è un
    // buco di campo spento in mezzo alla colonna, e il peso partirebbe **in
    // giù** dentro un campo che tira in su — cioè direbbe la bugia che questo
    // oggetto esiste apposta per non dire.
    const probe = { x: this.x - 5, y: this.y - 5, w: this.w + 10, h: this.h + 10 };
    const down = world.gravityAt(probe);
    this.down = down;

    const wasResting = this.onGround;
    applyGravity(this, PHYSICS.gravity, TERMINAL, down);
    moveY(this, world.map, isSolid);
    updateGrounded(this, world.map, isSolid, down);
    this.falling = !this.onGround;

    // Il tonfo: si sente e si vede, perché è il momento in cui la zavorra
    // dichiara da che parte tira il campo in cui è dentro.
    if (this.onGround && !wasResting) {
      world.audio.play('land');
      world.camera.shake(3);
      world.effects.burst(
        this.x + this.w / 2,
        down > 0 ? this.y + this.h : this.y,
        PALETTE.dust,
        { count: 8, speed: 2.4, size: 3.5, life: 20, shape: 'circle' },
      );
    }

    // Fuori dalla mappa da tutte e due le parti: quaggiù si cade anche in su.
    if (this.y > world.map.heightPx + 240 || this.y + this.h < -240) this.expired = true;
  }

  /**
   * Schiacciata dal Rovescio: si spacca, e con lei finisce il colpo.
   * La chiama `World.handleRovescioFight`, che è l'unico a sapere insieme dove
   * sta lei e dove sta lui.
   */
  crush(world: World): void {
    this.expired = true;
    world.audio.play('crumble');
    world.camera.shake(FEEL.screenShakeOnTrap);
    world.effects.burst(this.x + this.w / 2, this.y + this.h / 2, MATERIAL.lead.base, {
      count: 20,
      speed: 4.4,
      size: 5,
      life: 34,
      gravity: 0.4 * this.down,
    });
  }

  /**
   * Non si schiaccia: è piombo, e il piombo vince sempre. Ma **da ferma non fa
   * male a nessuno**, ed è la regola più importante che abbia.
   *
   * Quello che uccide è il peso che *cade*, non il peso che sta lì — la stessa
   * identica cosa del masso del Padrone, che una volta a terra non è più
   * l'arma di nessuno. Senza questa regola una zavorra appoggiata sarebbe un
   * muro invalicabile invece che un cartello, e il quarto mondo perderebbe
   * l'unico strumento che ha per raccontarsi: chi la guarda ferma impara da
   * che parte tira il campo, e per impararlo deve poterle stare accanto.
   */
  override onStomp(world: World): boolean {
    if (this.falling) world.kill(DEATH_CAUSE.ballast);
    return false;
  }

  onTouch(world: World): void {
    if (this.falling) world.kill(DEATH_CAUSE.ballast);
  }

  /**
   * Un blocco di piombo cerchiato di ferro, con l'anello in cima e i ganci
   * agli angoli. È volutamente la cosa più pesante che il gioco disegni: niente
   * riflessi larghi, niente colori, solo un bordo di luce sopra e un'ombra che
   * lo incolla alla superficie su cui sta.
   */
  draw(r: Renderer, tick: number): void {
    const lead = MATERIAL.lead;
    const iron = MATERIAL.iron;
    const x = this.x;
    const y = this.y;
    const cx = x + this.w / 2;

    // Ombra: dalla parte in cui sta cadendo, così si legge il verso anche da
    // ferma. È l'unica informazione che questo nemico deve dare.
    r.push();
    r.setAlpha(this.falling ? 0.12 : 0.3);
    r.ellipse(cx, this.down > 0 ? y + this.h + 1 : y - 1, this.w * 0.44, 3.4, shade(1));
    r.pop();

    // Massa: gradiente sempre nel verso della luce del mondo, che non cambia
    // mai — la gravità si capovolge, il sole no.
    r.gradientRect(x + 1, y + 1, this.w - 2, this.h - 2, [
      { at: 0, color: lead.light },
      { at: 0.3, color: lead.base },
      { at: 1, color: lead.dark },
    ]);

    // Cerchiature: due bande di ferro incrociate, imbullonate.
    r.rect(x + 1, y + this.h * 0.34, this.w - 2, 3.2, iron.base);
    r.rect(x + 1, y + this.h * 0.34, this.w - 2, 1, alpha(iron.light, 0.7));
    r.rect(x + this.w * 0.36, y + 1, 3.2, this.h - 2, iron.dark);
    r.rect(x + this.w * 0.36, y + 1, 1, this.h - 2, alpha(iron.light, 0.4));

    for (const [dx, dy] of [[4, 4], [SIZE - 4, 4], [4, SIZE - 4], [SIZE - 4, SIZE - 4]] as const) {
      r.ellipse(x + dx, y + dy + 0.5, 1.9, 1.9, alpha(iron.deep, 0.8));
      r.ellipse(x + dx, y + dy, 1.9, 1.9, iron.base);
      r.ellipse(x + dx - 0.5, y + dy - 0.5, 0.9, 0.8, iron.light);
    }

    // L'anello: sta sempre dalla parte da cui il campo la tira, cioè "in alto"
    // secondo lei. È il modo più economico per dire da che parte pende.
    const ringY = this.down > 0 ? y : y + this.h;
    r.push();
    r.setAlpha(0.9);
    r.line(
      [cx - 4, ringY, cx - 3, ringY - this.down * 5, cx + 3, ringY - this.down * 5, cx + 4, ringY],
      2.2,
      iron.base,
    );
    r.pop();

    // Mentre cade fischia: due scie corte alle spalle, nel verso opposto.
    if (this.falling) {
      r.push();
      r.setBlend('add');
      r.setAlpha(0.12 + Math.abs(Math.sin(tick / 4)) * 0.06);
      for (const side of [-7, 7] as const) {
        r.radial(cx + side, ringY, 3, 14, [
          { at: 0, color: glare(0.7) },
          { at: 1, color: glare(0) },
        ]);
      }
      r.pop();
    }

    // Bordo di luce sul lato esposto al sole: in alto a sinistra, come tutto.
    r.push();
    r.setAlpha(0.5);
    r.line([x + 1, y + this.h - 2, x + 1, y + 1, x + this.w - 2, y + 1], 1.2, glare(0.75));
    r.pop();
  }
}
