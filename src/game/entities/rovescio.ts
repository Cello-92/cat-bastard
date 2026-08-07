import { applyGravity, moveX, moveY, updateGrounded, type Down } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { FEEL, PHYSICS, ROVESCIO } from '../config';
import { MATERIAL, PALETTE, alpha, shade } from '../theme';
import { DEATH_CAUSE } from '../taunts';
import { isSolid } from '../tiles';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * Il Rovescio: il boss di 4-11.
 *
 * I primi tre si combattono contro qualcosa che sta nella stanza. Il Padrone
 * si *guida* sotto un mattone, Lucio si *attira* sopra un cero, la Sfinge si
 * *aspetta* sul terreno che ha rotto lei. In tutti e tre l'arma è un pezzo di
 * mappa, e il gatto decide dove far succedere le cose.
 *
 * Qui l'arma la spara **lui**, ogni volta, e sempre tutta insieme: la sua
 * unica mossa è ribaltare la stanza, e quando la stanza si ribalta cadono
 * anche le zavorre — comprese quelle che sono ferme esattamente dove sta lui.
 * Non c'è niente da portargli addosso e niente su cui attirarlo: il problema è
 * l'opposto, perché prima di ribaltare **si toglie** dalla colonna pericolosa
 * (`World.rovescioDanger`), e lo fa una volta sola per ciclo.
 *
 * Quindi lo scontro non è guidarlo, attirarlo o aspettarlo: è **chiudergli le
 * uscite**. Lo si costringe a fermarsi dove non ha più un posto libero in cui
 * scansarsi — contro una parete, o in mezzo a due zavorre — e poi si sta a
 * guardare mentre si fa cadere addosso la stanza da solo. È l'unico dei
 * quattro che si uccide non facendo niente, se non essere nel posto giusto.
 *
 * Vale il numero non negoziabile di tutti e quattro: cammina più lento del
 * gatto (`ROVESCIO.stalkSpeed` < `PHYSICS.maxSpeed`). Se un giorno lo
 * superasse smetterebbe di farsi portare e comincerebbe a inseguire, che è il
 * combattimento di qualcun altro.
 */

export type RovescioState =
  | 'wait'
  | 'stalk'
  | 'shuffle'
  | 'wind'
  | 'recover'
  | 'hurt'
  | 'rage'
  | 'dead';

/** Distanza a cui si accorge che qualcuno è entrato nella sala. */
const WAKE_RANGE = 380;
const WAKE_TIMEOUT = 100;

export class Rovescio extends Entity {
  state: RovescioState = 'wait';
  /** Colpi incassati: 0..4. Sono i quattro anelli accesi sulla schiena. */
  hits = 0;
  phase: 1 | 2 = 1;
  facing = -1;

  private timer = WAKE_TIMEOUT;
  /** Cronometro solo grafico: respiro, brace, ronzio della piastra. */
  private life = 0;
  /** Verso in cui pesa in questo momento: lo decide la stanza, non lui. */
  private down: Down = 1;
  /** Direzione dello scarto in corso: è il suo unico modo di barare. */
  private shuffleDir = 0;

  constructor(x: number, y: number) {
    super(x, y, ROVESCIO.width, ROVESCIO.height);
  }

  // ---------------------------------------------------------------- stato
  get isDead(): boolean {
    return this.state === 'dead';
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }

  /**
   * Sta per ribaltare: da qui in poi il punto è congelato.
   *
   * Pubblico perché è l'unico preavviso dello scontro e i test lo verificano —
   * un boss che ribaltasse senza rimbombare non sarebbe difficile, sarebbe un
   * dado, e il patto (CLAUDE.md, punto 1) non lo permette.
   */
  get isWinding(): boolean {
    return this.state === 'wind';
  }

  /** Fermo e incassabile: dopo un colpo e durante il cambio di fase. */
  get isStunned(): boolean {
    return this.state === 'hurt' || this.state === 'rage';
  }

  private enter(state: RovescioState, timer: number): void {
    this.state = state;
    this.timer = timer;
  }

  private value(normal: number, furious: number): number {
    return this.phase === 1 ? normal : furious;
  }

  // ---------------------------------------------------------------- ciclo
  update(world: World): void {
    this.life++;
    // Il peso lo decide la stanza: lui la ribalta, e poi la subisce come tutti
    // gli altri. Un boss che ribaltasse la stanza restando in piedi non sarebbe
    // un boss, sarebbe un interruttore con la faccia.
    this.down = world.gravityAt(this);

    if (this.state !== 'dead') {
      this.think(world);
      this.walk(world);
    }

    // Peso proprio, sempre e comunque: anche mentre rimbomba, anche mentre è
    // intontito. È di ferro, e il ferro cade.
    applyGravity(this, PHYSICS.gravity, PHYSICS.terminalVelocity, this.down);
    moveY(this, world.map, isSolid);
    updateGrounded(this, world.map, isSolid, this.down);
  }

  private think(world: World): void {
    if (this.timer > 0) this.timer--;

    switch (this.state) {
      case 'wait': {
        const near = Math.abs(world.player.centerX - this.centerX) < WAKE_RANGE;
        if (near || this.timer <= 0) {
          world.audio.play('trap');
          world.camera.shake(5);
          this.enter('stalk', this.value(ROVESCIO.stalkTicks, ROVESCIO.stalkTicksFurious));
        }
        break;
      }

      case 'stalk': {
        const dx = world.player.centerX - this.centerX;
        this.facing = dx >= 0 ? 1 : -1;
        // Si ferma quando ti arriva accanto, o quando è passato abbastanza
        // tempo: il tetto è una valvola, perché cammina più piano di te e
        // senza bastarebbe correre per sempre (vedi LUCIO.hangTicks).
        if (Math.abs(dx) < ROVESCIO.alignRange || this.timer <= 0) this.decide(world);
        break;
      }

      case 'shuffle':
        if (this.timer <= 0) this.wind(world);
        break;

      case 'wind':
        if (this.timer <= 0) {
          // Il ribaltamento vero e proprio. Non lo fa lui: lo chiede al mondo,
          // che è l'unico a sapere cosa c'è dentro la stanza da capovolgere.
          world.flipRoom();
          this.enter('recover', this.value(ROVESCIO.recoverTicks, ROVESCIO.recoverTicksFurious));
        } else if (this.timer % 6 === 0) {
          world.camera.shake(2);
          world.effects.burst(this.centerX, this.feetY(), PALETTE.dust, {
            count: 4,
            speed: 1.8,
            size: 3,
            life: 16,
            shape: 'circle',
          });
        }
        break;

      case 'recover':
        if (this.timer <= 0) {
          this.enter('stalk', this.value(ROVESCIO.stalkTicks, ROVESCIO.stalkTicksFurious));
        }
        break;

      case 'hurt':
        if (this.timer <= 0) {
          this.enter('stalk', this.value(ROVESCIO.stalkTicks, ROVESCIO.stalkTicksFurious));
        }
        break;

      case 'rage':
        if (this.timer <= 0) {
          this.enter('stalk', ROVESCIO.stalkTicksFurious);
        }
        break;

      default:
        break;
    }
  }

  /**
   * Il momento in cui decide, e l'unico in cui bara.
   *
   * Guarda cosa gli sta addosso — glielo dice il mondo, che è l'unico a sapere
   * dove sono le zavorre — e se c'è qualcosa si sposta. **Una volta sola.**
   * Se dopo lo scarto è ancora in guai suoi, ribalta lo stesso: è quello che
   * rende lo scontro vincibile, ed è anche quello che lo rende un puzzle
   * invece che una rincorsa.
   */
  private decide(world: World): void {
    const escape = world.rovescioEscape(this);
    if (escape === 0) {
      this.wind(world);
      return;
    }

    this.shuffleDir = Math.sign(escape);
    // Si sposta esattamente di quanto gli serve, non di quanto potrebbe: il
    // conto lo ha già fatto il mondo, qui si traduce in tick.
    world.audio.play('bump');
    world.effects.floatingText(this.centerX, this.y - 10, 'no', PALETTE.paper, 12);
    this.enter('shuffle', Math.ceil(Math.abs(escape) / ROVESCIO.shuffleSpeed));
  }

  private wind(world: World): void {
    world.audio.play('block');
    world.camera.shake(4);
    world.effects.floatingText(this.centerX, this.y - 14, 'SOTTO', PALETTE.field, 14);
    this.enter('wind', this.value(ROVESCIO.windTicks, ROVESCIO.windTicksFurious));
  }

  private walk(world: World): void {
    if (this.state === 'stalk') {
      this.vx = this.facing * this.value(ROVESCIO.stalkSpeed, ROVESCIO.stalkSpeedFurious);
    } else if (this.state === 'shuffle') {
      this.vx = this.shuffleDir * ROVESCIO.shuffleSpeed;
    } else {
      this.vx = 0;
    }

    if (this.vx === 0) return;
    moveX(this, world.map, isSolid);
    // Contro una parete lo scarto finisce lì. È il punto in cui il gatto vince:
    // in un angolo non ha più dove togliersi, e la stanza gliela ribalta
    // addosso lo stesso.
    if (this.hitWall && this.state === 'shuffle') this.timer = 0;
  }

  /** La quota su cui poggia adesso: cambia col peso, come per il gatto. */
  private feetY(): number {
    return this.down > 0 ? this.y + this.h : this.y;
  }

  // ---------------------------------------------------------------- colpi
  /**
   * Una zavorra gli è finita addosso mentre cadeva.
   *
   * Lo chiama `World.handleRovescioFight`, e non poteva essere altrimenti: chi
   * sa insieme dove sta lui e quali pesi si stanno muovendo è uno solo.
   */
  takeHit(world: World): boolean {
    if (this.state === 'dead' || this.isStunned) return false;

    this.hits++;
    world.audio.play('stomp');
    world.camera.shake(FEEL.screenShakeOnDeath);
    world.effects.freeze(6);
    world.effects.flash(0.3, PALETTE.field);
    world.effects.ring(this.centerX, this.y + this.h * 0.4, PALETTE.field, 6, 26);
    world.effects.burst(this.centerX, this.y + this.h * 0.5, MATERIAL.lead.light, {
      count: 22,
      speed: 4.6,
      size: 5,
      life: 36,
    });

    const left = ROVESCIO.hitsPerPhase * 2 - this.hits;
    world.effects.floatingText(
      this.centerX,
      this.y - 12,
      left > 0 ? `${left}` : 'DIRITTO',
      PALETTE.field,
      15,
    );

    if (this.hits >= ROVESCIO.hitsPerPhase * 2) {
      this.enter('dead', 0);
      world.effects.flash(0.55, PALETTE.paper);
      return true;
    }

    if (this.hits === ROVESCIO.hitsPerPhase) {
      this.phase = 2;
      this.enter('rage', ROVESCIO.rageTicks);
      world.onRovescioRage();
      return true;
    }

    this.enter('hurt', ROVESCIO.hurtTicks);
    return true;
  }

  onTouch(world: World): void {
    if (this.isDead) return;
    world.kill(DEATH_CAUSE.rovescio);
  }

  /** Ha una piastra d'acciaio sulla schiena. Da tutte e due le parti. */
  override onStomp(world: World): boolean {
    if (this.isDead) return false;
    world.kill(DEATH_CAUSE.rovescioStomp);
    return false;
  }

  // ---------------------------------------------------------------- disegno
  /**
   * Un gatto di ferro grande quanto due celle, con una piastra imbullonata
   * sulla schiena e quattro anelli accesi lungo la colonna: sono i colpi che
   * gli restano, e si spengono uno per volta.
   *
   * Come il gatto giocante, a testa in giù non si ridisegna niente: si ribalta
   * tutto attorno al centro e si lascia lavorare lo stesso codice. È l'unico
   * modo perché il boss capovolto sia *lo stesso* boss.
   */
  draw(r: Renderer, tick: number): void {
    if (this.down < 0) {
      const cy = this.y + this.h / 2;
      r.push();
      r.translate(this.centerX, cy);
      r.scale(1, -1);
      r.translate(-this.centerX, -cy);
      this.drawUpright(r, tick);
      r.pop();
      return;
    }
    this.drawUpright(r, tick);
  }

  private drawUpright(r: Renderer, tick: number): void {
    const iron = MATERIAL.iron;
    const lead = MATERIAL.lead;
    const brass = MATERIAL.brass;
    const cx = this.centerX;
    const feet = this.y + this.h;
    const face = this.facing;

    // Mentre rimbomba trema: è l'unico preavviso, e deve vedersi da lontano.
    const shiver = this.state === 'wind' ? Math.sin(this.life * 1.7) * 2.2 : 0;

    r.push();
    r.translate(shiver, 0);

    // Ombra di contatto.
    r.push();
    r.setAlpha(this.onGround ? 0.34 : 0.16);
    r.ellipse(cx, feet + 2, this.w * 0.46, 5, shade(0.9));
    r.pop();

    // Zampe: quattro colonne tozze, due davanti e due dietro.
    for (const [dx, depth] of [[-18, 0.55], [-6, 0.55], [8, 1], [19, 1]] as const) {
      const shade_ = depth < 1 ? lead.dark : lead.base;
      r.rect(cx + dx * face - 4, feet - 14, 8, 14, shade_);
      r.rect(cx + dx * face - 4, feet - 2, 8, 2, iron.dark);
    }

    // Corpo: un blocco di piombo cerchiato di ferro.
    const bodyY = this.y + 12;
    const bodyH = feet - bodyY - 12;
    r.gradientRect(cx - this.w / 2 + 4, bodyY, this.w - 8, bodyH, [
      { at: 0, color: lead.light },
      { at: 0.32, color: lead.base },
      { at: 1, color: lead.dark },
    ]);
    r.rect(cx - this.w / 2 + 4, bodyY, this.w - 8, 1.6, alpha(lead.spec, 0.7));

    // La piastra sulla schiena: quella che rende inutile saltargli addosso.
    r.rect(cx - this.w / 2 + 6, bodyY - 5, this.w - 12, 7, iron.base);
    r.rect(cx - this.w / 2 + 6, bodyY - 5, this.w - 12, 1.4, alpha(iron.light, 0.8));
    for (let i = 0; i < 5; i++) {
      const bx = cx - this.w / 2 + 12 + i * ((this.w - 24) / 4);
      r.ellipse(bx, bodyY - 1.5, 1.8, 1.8, iron.dark);
      r.ellipse(bx - 0.4, bodyY - 2, 0.8, 0.7, iron.light);
    }

    // Gli anelli: i colpi che gli restano. Si spengono da davanti, e sono
    // tanti quanti ne servono — la spaziatura si ricava dal numero, così
    // cambiare `hitsPerPhase` non li fa uscire dalla schiena.
    const rings = ROVESCIO.hitsPerPhase * 2;
    const gap = (this.w * 0.56) / Math.max(1, rings - 1);
    for (let i = 0; i < rings; i++) {
      const rx = cx - this.w * 0.28 + i * gap;
      const lit = i >= this.hits;
      r.ellipse(rx, bodyY + bodyH * 0.45, 4, 4, iron.deep);
      r.ellipse(rx, bodyY + bodyH * 0.45, 2.8, 2.8, lit ? PALETTE.field : iron.dark);
      if (!lit) continue;
      r.push();
      r.setBlend('add');
      r.setAlpha(0.25 + Math.abs(Math.sin(tick / 20 + i)) * 0.2);
      r.radial(rx, bodyY + bodyH * 0.45, 11, 11, [
        { at: 0, color: alpha(PALETTE.field, 0.8) },
        { at: 1, color: alpha(PALETTE.field, 0) },
      ]);
      r.pop();
    }

    // Coda: una catena con la zavorra in punta. È la firma della sagoma, e
    // dice cosa fa questo boss prima ancora che lo faccia.
    const tailX = cx - face * (this.w / 2 - 2);
    const swing = Math.sin(this.life / 24) * 5;
    r.line(
      [tailX, bodyY + 6, tailX - face * 10, bodyY + 2 + swing, tailX - face * 17, bodyY + 12 + swing],
      2.6,
      brass.dark,
    );
    r.ellipse(tailX - face * 18, bodyY + 14 + swing, 5, 5, lead.base);
    r.ellipse(tailX - face * 19, bodyY + 12.6 + swing, 2, 1.6, lead.light);

    // Testa: squadrata, con due orecchie di lamiera e due fessure accese.
    const headX = cx + face * (this.w * 0.3);
    const headY = this.y + 12;
    r.polygon(
      [headX - 12, headY + 2, headX - 8, headY - 10, headX - 2, headY - 2, headX + 4, headY - 2,
        headX + 10, headY - 10, headX + 13, headY + 3, headX + 11, headY + 14, headX - 11, headY + 14],
      iron.base,
    );
    r.push();
    r.setAlpha(0.8);
    r.radial(headX - 4, headY, 11, 9, [
      { at: 0, color: alpha(iron.light, 0.9) },
      { at: 1, color: alpha(iron.light, 0) },
    ]);
    r.pop();
    for (const side of [-1, 1] as const) {
      const ex = headX + side * 5 + face * 1.5;
      r.rect(ex - 2.6, headY + 3, 5.2, 2.4, PALETTE.ink);
      r.push();
      r.setBlend('add');
      r.setAlpha(this.state === 'wind' ? 0.55 : 0.3);
      r.rect(ex - 2.6, headY + 3, 5.2, 2.4, PALETTE.field);
      r.pop();
    }
    r.push();
    r.setAlpha(0.55);
    r.line([headX - 11, headY + 10, headX + 11, headY + 10], 1.2, iron.deep);
    r.pop();

    // Mentre rimbomba, l'aria attorno comincia già a tirare dall'altra parte:
    // quattro grani di polvere che salgono. È il preavviso, e dice **cosa**
    // sta per succedere, non solo che sta per succedere qualcosa.
    if (this.state === 'wind') {
      r.push();
      r.setBlend('add');
      for (let i = 0; i < 5; i++) {
        const phase = ((this.life / 14 + i * 0.2) % 1);
        r.setAlpha(0.3 * (1 - phase));
        r.ellipse(cx - 24 + i * 12, feet - phase * 46, 1.6, 4.2, alpha(PALETTE.field, 0.9));
      }
      r.pop();
    }

    r.pop();
  }
}
