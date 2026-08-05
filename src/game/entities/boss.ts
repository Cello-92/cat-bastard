import { applyGravity, moveX, moveY, updateGrounded } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { BOSS, FEEL, PHYSICS } from '../config';
import { MATERIAL, PALETTE, alpha, glare, mix, shade } from '../theme';
import { isSolid } from '../tiles';
import { DEATH_CAUSE } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * Il Padrone: quello che ha messo le trappole.
 *
 * Non ha una barra della vita e non l'avrà mai. Quello che ha è una corona con
 * quattro gemme, e ogni masso che gli arriva in testa ne spegne una: la salute
 * del boss è un oggetto che si vede addosso a lui, non un rettangolo in un
 * angolo dello schermo. Quando la corona è spenta, è finita.
 *
 * Il suo comportamento è un ciclo fisso — cammina, ruggisce, carica, sbatte, si
 * riprende — perché la regola numero uno del gioco vale anche per lui: stesso
 * input, stessa morte. Niente è casuale. L'unica cosa che decide il giocatore è
 * *dove* succede, ed è tutto il combattimento: il Padrone va sempre verso di te,
 * quindi sei tu a scegliere sotto quale mattone farlo arrivare.
 *
 * E bara, ovviamente. Mentre cammina, se vede della muratura che gli sta
 * cadendo addosso si sposta — un colpo onesto non lo prende mai. Lo si becca
 * solo quando è impegnato in qualcosa: la carica, il capogiro contro il muro,
 * o (in seconda fase) la botta a terra con cui cerca di seppellire te.
 */

export type BossState =
  | 'wait'
  | 'stalk'
  | 'wind'
  | 'charge'
  | 'stun'
  | 'slamWind'
  | 'slam'
  | 'hurt'
  | 'rage'
  | 'dead';

/** Distanza a cui si accorge che sei entrato nell'arena. */
const WAKE_RANGE = 360;
const WAKE_TIMEOUT = 90;

export class Boss extends Entity {
  state: BossState = 'wait';
  /** Colpi incassati: 0..4. È anche il numero di gemme spente sulla corona. */
  hits = 0;
  phase: 1 | 2 = 1;
  facing = -1;

  private timer = WAKE_TIMEOUT;
  private chargeLeft = 0;
  private dodgeTimer = 0;
  private dodgeDir = 0;
  /** In fase 2 alterna carica e botta a terra: si impara a memoria. */
  private slamNext = false;
  /** Cronometro solo grafico: respiro, ondeggio del mantello, scintille. */
  private life = 0;

  constructor(x: number, y: number) {
    super(x, y, BOSS.width, BOSS.height);
  }

  // ---------------------------------------------------------------- stato
  /** Un masso che arriva adesso fa danno? */
  get vulnerable(): boolean {
    return this.state !== 'dead' && this.state !== 'hurt' && this.state !== 'rage';
  }

  /** Può scansare un masso? Solo mentre cammina: il resto è già impegno. */
  get canDodge(): boolean {
    return this.state === 'stalk' && this.dodgeTimer <= 0;
  }

  get isDead(): boolean {
    return this.state === 'dead';
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }

  // ---------------------------------------------------------------- ciclo
  update(world: World): void {
    this.life++;

    if (this.state === 'dead') {
      this.fall(world);
      return;
    }

    switch (this.state) {
      case 'wait':
        this.updateWait(world);
        break;
      case 'stalk':
        this.updateStalk(world);
        break;
      case 'wind':
      case 'slamWind':
      case 'slam':
      case 'rage':
        this.vx = 0;
        this.updateRooted(world);
        break;
      case 'charge':
        this.updateCharge(world);
        break;
      case 'stun':
      case 'hurt':
        this.vx *= 0.82;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
        this.updateRooted(world);
        break;
      default:
        break;
    }

    moveX(this, world.map, isSolid);
    if (this.state === 'charge' && this.hitWall) this.crash(world);

    this.fall(world);
  }

  private fall(world: World): void {
    applyGravity(this, PHYSICS.gravity, 15);
    moveY(this, world.map, isSolid);
    updateGrounded(this, world.map, isSolid);
  }

  private updateWait(world: World): void {
    this.vx = 0;
    this.faceThe(world);
    const dx = Math.abs(world.player.centerX - this.centerX);
    if (--this.timer > 0 && dx > WAKE_RANGE) return;

    world.audio.play('reveal');
    world.camera.shake(6);
    world.effects.floatingText(this.centerX, this.y - 12, 'IL PADRONE', PALETTE.gold, 15);
    this.enter('stalk', this.value(BOSS.stalkTicks, BOSS.stalkTicksFurious));
  }

  private updateStalk(world: World): void {
    if (this.dodgeTimer > 0) {
      // Sta scansando: la direzione l'ha decisa il masso, non il gatto.
      this.dodgeTimer--;
      this.vx = this.dodgeDir * BOSS.dodgeSpeed;
    } else {
      this.faceThe(world);
      this.vx = this.facing * this.value(BOSS.stalkSpeed, BOSS.stalkSpeedFurious);
    }

    if (--this.timer > 0) return;

    // In fase 2 le due mosse si alternano, sempre nello stesso ordine.
    if (this.phase === 2 && this.slamNext) {
      this.slamNext = false;
      this.enter('slamWind', BOSS.slamWindTicks);
      world.audio.play('trap');
      return;
    }
    this.slamNext = true;
    this.faceThe(world);
    this.enter('wind', this.value(BOSS.windTicks, BOSS.windTicksFurious));
    world.audio.play('bump');
  }

  private updateRooted(world: World): void {
    if (--this.timer > 0) return;

    switch (this.state) {
      case 'wind':
        // La direzione era già stata decisa quando ha cominciato a ruggire:
        // da lì in poi si può ingannare, ed è metà del combattimento.
        this.chargeLeft = BOSS.chargeDistance;
        this.enter('charge', 0);
        world.audio.play('trap');
        break;

      case 'slamWind':
        this.slam(world);
        break;

      case 'slam':
      case 'stun':
        this.enter('stalk', this.value(BOSS.stalkTicks, BOSS.stalkTicksFurious));
        break;

      case 'hurt':
        if (this.hits >= BOSS.hitsPerPhase && this.phase === 1) this.beginRage(world);
        else this.enter('stalk', this.value(BOSS.stalkTicks, BOSS.stalkTicksFurious));
        break;

      case 'rage':
        this.enter('stalk', BOSS.stalkTicksFurious);
        break;

      default:
        break;
    }
  }

  private updateCharge(world: World): void {
    const speed = this.value(BOSS.chargeSpeed, BOSS.chargeSpeedFurious);
    this.vx = this.facing * speed;
    this.chargeLeft -= speed;

    // Polvere sotto le zampe: la carica dev'essere leggibile anche di spalle.
    if (this.life % 3 === 0) {
      world.effects.burst(this.centerX - this.facing * 20, this.y + this.h - 2, PALETTE.dust, {
        count: 2,
        speed: 1.8,
        size: 4,
        life: 18,
        shape: 'circle',
        angle: this.facing > 0 ? Math.PI : 0,
        spread: Math.PI * 0.5,
      });
    }

    if (this.chargeLeft <= 0) this.crash(world);
  }

  /** Fine corsa: contro il muro o a fine slancio. In entrambi i casi, capogiro. */
  private crash(world: World): void {
    this.vx = 0;
    this.enter('stun', this.value(BOSS.stunTicks, BOSS.stunTicksFurious));
    world.audio.play('reveal');
    world.camera.shake(FEEL.screenShakeOnTrap + 3);
    world.effects.freeze(3);
    world.effects.burst(this.centerX + this.facing * 24, this.y + this.h - 8, PALETTE.dust, {
      count: 12,
      speed: 3.4,
      size: 5,
      life: 26,
      shape: 'circle',
      angle: this.facing > 0 ? -0.5 : Math.PI + 0.5,
      spread: Math.PI * 0.8,
    });
  }

  /** Botta a terra: il soffitto cede sopra al gatto. Poi resta lì a guardare. */
  private slam(world: World): void {
    this.enter('slam', BOSS.slamRecoveryTicks);
    world.audio.play('death');
    world.camera.shake(11);
    world.effects.freeze(4);
    world.effects.burst(this.centerX, this.y + this.h, PALETTE.stone, {
      count: 16,
      speed: 4.4,
      size: 5,
      life: 30,
      angle: -Math.PI / 2,
      spread: Math.PI,
    });
    world.bossSlam(this);
  }

  private beginRage(world: World): void {
    this.phase = 2;
    this.slamNext = true;
    this.enter('rage', BOSS.ragTicks);
    world.audio.play('death');
    world.camera.shake(12);
    world.effects.flash(0.4, PALETTE.hot);
    world.effects.floatingText(this.centerX, this.y - 14, 'ADESSO BASTA', PALETTE.hot, 15);
    world.onBossRage();
  }

  // ---------------------------------------------------------------- danno
  /**
   * Un masso l'ha preso. Ritorna true se il colpo è andato a segno: il mondo
   * lo usa per decidere se festeggiare o se il masso è arrivato a vuoto.
   */
  takeHit(world: World): boolean {
    if (!this.vulnerable) return false;

    this.hits++;
    this.vx = -this.facing * 1.6;
    world.audio.play('stomp');
    world.camera.shake(FEEL.screenShakeOnDeath);
    world.effects.freeze(6);
    world.effects.flash(0.3, PALETTE.gold);
    world.effects.ring(this.centerX, this.y + 6, PALETTE.gold, 5.5, 20);
    world.effects.burst(this.centerX, this.y + 4, PALETTE.gold, {
      count: 18,
      speed: 4.6,
      size: 4,
      life: 34,
      light: true,
    });

    const left = BOSS.hitsPerPhase * 2 - this.hits;
    world.effects.floatingText(
      this.centerX,
      this.y - 10,
      left > 0 ? `${left} GEMME` : 'CORONA SPENTA',
      PALETTE.gold,
      14,
    );

    if (left <= 0) {
      this.die(world);
      return true;
    }

    this.enter('hurt', BOSS.hurtTicks);
    return true;
  }

  private die(world: World): void {
    this.state = 'dead';
    this.timer = 0;
    this.vx = 0;
    this.vy = -5;
    world.audio.play('win');
    world.camera.shake(14);
    world.effects.freeze(8);
    world.effects.flash(0.55, PALETTE.paper);
    world.effects.ring(this.centerX, this.y + 10, PALETTE.hot, 7, 26);
    world.effects.burst(this.centerX, this.y + 10, PALETTE.gold, {
      count: 30,
      speed: 6,
      size: 5,
      life: 60,
      gravity: 0.3,
      light: true,
    });
  }

  /** Il mondo gli segnala un masso in arrivo. Se può, si sposta. */
  dodge(direction: number): void {
    if (!this.canDodge) return;
    this.dodgeTimer = BOSS.dodgeTicks;
    this.dodgeDir = direction === 0 ? -this.facing : Math.sign(direction);
  }

  // ---------------------------------------------------------------- contatto
  onTouch(world: World): void {
    if (this.state === 'dead') return;
    world.kill(this.state === 'charge' ? DEATH_CAUSE.bossCharge : DEATH_CAUSE.boss);
  }

  /** Ha una corona di punte d'oro: saltargli in testa è un modo di morire. */
  override onStomp(world: World): boolean {
    if (this.state === 'dead') return false;
    world.kill(DEATH_CAUSE.bossStomp);
    return false;
  }

  // ---------------------------------------------------------------- utilità
  private enter(state: BossState, ticks: number): void {
    this.state = state;
    this.timer = ticks;
    this.dodgeTimer = 0;
  }

  private faceThe(world: World): void {
    const delta = world.player.centerX - this.centerX;
    if (Math.abs(delta) > 6) this.facing = delta > 0 ? 1 : -1;
  }

  /** Sceglie il valore giusto per la fase in corso. */
  private value(calm: number, furious: number): number {
    return this.phase === 1 ? calm : furious;
  }

  // ---------------------------------------------------------------- disegno
  /**
   * Il Padrone è disegnato dal fondo verso di noi: mantello, corpo, braccia,
   * testa, corona. Ogni stato cambia la posa — non un'icona sopra la testa: si
   * deve capire cosa sta per fare guardando *lui*.
   */
  draw(r: Renderer, tick: number): void {
    const hide = MATERIAL.hide;
    const dead = this.state === 'dead';
    const charging = this.state === 'wind' || this.state === 'slamWind';
    const stunned = this.state === 'stun' || this.state === 'hurt';
    const raging = this.state === 'rage';

    // Pose: la sagoma dice lo stato prima di qualunque dettaglio.
    const breathe = Math.sin(this.life / (this.phase === 2 ? 12 : 20)) * (this.phase === 2 ? 1.6 : 1);
    const shiver = charging || raging ? (tick % 2 ? 1.8 : -1.8) : 0;
    const walking = this.state === 'stalk' || this.state === 'charge';
    const gait = walking ? Math.sin(this.life / (this.state === 'charge' ? 3 : 7)) : 0;
    const lean = this.state === 'charge' ? this.facing * 5 : charging ? -this.facing * 3 : 0;

    const squashY = dead ? 0.45 : stunned ? 0.92 : 1 + gait * 0.04;
    const squashX = dead ? 1.35 : stunned ? 1.06 : 1 - gait * 0.03;

    const cx = this.x + this.w / 2 + shiver + lean;
    const feet = this.y + this.h;
    const bodyH = this.h * squashY;
    const bodyW = this.w * squashX;
    const top = feet - bodyH + breathe * (dead ? 0 : 1);

    // Ombra a terra: larga, morbida, sempre sotto di lui.
    r.push();
    r.setAlpha(0.34);
    r.radial(cx, feet + 1, bodyW * 0.6, 6, [
      { at: 0, color: shade(0.9) },
      { at: 1, color: shade(0) },
    ]);
    r.pop();

    // Aura: in seconda fase brucia, e si vede da tutta l'arena.
    if (this.phase === 2 && !dead) {
      r.push();
      r.setBlend('add');
      r.setAlpha(0.1 + Math.abs(Math.sin(this.life / 22)) * 0.12);
      r.radial(cx, top + bodyH * 0.5, bodyW * 1.1, bodyH * 1.1, [
        { at: 0, color: alpha(PALETTE.hot, 0.7) },
        { at: 1, color: alpha(PALETTE.hot, 0) },
      ]);
      r.pop();
    }

    this.drawCape(r, cx, top, bodyW, bodyH, gait, dead);
    this.drawBody(r, cx, top, bodyW, bodyH, hide, dead);
    this.drawArms(r, cx, top, bodyW, bodyH, gait);
    if (!dead) this.drawLegs(r, cx, feet, bodyW, gait);
    this.drawFace(r, cx, top, bodyW, bodyH, stunned, charging, dead);
    this.drawCrown(r, cx, top, bodyW, dead);

    // Capogiro: le stelle sopra la testa sono l'invito a colpire adesso.
    if (stunned && !dead) {
      r.push();
      r.setBlend('add');
      for (let i = 0; i < 3; i++) {
        const a = this.life / 14 + (i / 3) * Math.PI * 2;
        r.setAlpha(0.5 + Math.sin(this.life / 8 + i) * 0.3);
        r.ellipse(cx + Math.cos(a) * 20, top - 14 + Math.sin(a) * 5, 2.4, 2.4, PALETTE.gold);
      }
      r.pop();
    }
  }

  /** Mantello di stoffa: è la bandiera finta, cucita addosso. */
  private drawCape(
    r: Renderer,
    cx: number,
    top: number,
    bodyW: number,
    bodyH: number,
    gait: number,
    dead: boolean,
  ): void {
    const cloth = MATERIAL.cap;
    const back = cx - this.facing * bodyW * 0.42;
    const sway = dead ? 0 : Math.sin(this.life / 18) * 3 + gait * 3;
    const hemY = top + bodyH * (dead ? 0.7 : 1.02);

    r.blob(
      [
        back, top + 6,
        back - this.facing * (16 + sway), top + bodyH * 0.35,
        back - this.facing * (22 + sway * 1.4), hemY,
        back + this.facing * 6, hemY - 4,
        back + this.facing * 4, top + 10,
      ],
      cloth.base,
    );
    // Piega interna in ombra: senza, il mantello è un adesivo.
    r.push();
    r.setAlpha(0.55);
    r.blob(
      [
        back, top + 8,
        back - this.facing * (9 + sway * 0.6), top + bodyH * 0.5,
        back - this.facing * (6 + sway), hemY - 3,
        back + this.facing * 3, hemY - 6,
      ],
      cloth.dark,
    );
    r.pop();
    r.push();
    r.setAlpha(0.4);
    r.line([back + this.facing * 2, top + 7, back - this.facing * (14 + sway), hemY - 2], 1.4, cloth.light);
    r.pop();
  }

  private drawBody(
    r: Renderer,
    cx: number,
    top: number,
    bodyW: number,
    bodyH: number,
    hide: typeof MATERIAL.hide,
    dead: boolean,
  ): void {
    const hw = bodyW / 2;
    const coat = this.phase === 2 ? mix(hide.base, PALETTE.hotDeep, 0.22) : hide.base;

    // Sagoma irsuta: dieci punte alternate, come il nemico piccolo ma enorme.
    const points: number[] = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const ruffle = i % 2 === 0 ? 1.08 : 0.94;
      points.push(
        cx + Math.cos(a) * hw * ruffle,
        top + bodyH * 0.52 + Math.sin(a) * bodyH * 0.5 * ruffle,
      );
    }
    r.blob(points, coat);

    // Dorso in luce, ventre in ombra: la luce viene sempre da sinistra in alto.
    r.push();
    r.setAlpha(0.8);
    r.radial(cx - hw * 0.35, top + bodyH * 0.24, hw * 0.95, bodyH * 0.42, [
      { at: 0, color: alpha(hide.light, 0.9) },
      { at: 1, color: alpha(hide.light, 0) },
    ]);
    r.pop();
    r.push();
    r.setAlpha(0.6);
    r.radial(cx + hw * 0.2, top + bodyH * 0.86, hw * 0.9, bodyH * 0.3, [
      { at: 0, color: alpha(hide.dark, 0.9) },
      { at: 1, color: alpha(hide.dark, 0) },
    ]);
    r.pop();

    // Cicatrici: una per gemma spenta. Il danno si vede addosso a lui.
    r.push();
    r.setAlpha(0.5);
    for (let i = 0; i < this.hits; i++) {
      const sy = top + 12 + i * 7;
      r.line([cx - hw * 0.5 + i * 4, sy, cx + hw * 0.2 + i * 4, sy + 6], 1.6, hide.deep);
      r.line([cx - hw * 0.5 + i * 4, sy + 1.4, cx + hw * 0.2 + i * 4, sy + 7.4], 1, PALETTE.hotDeep);
    }
    r.pop();

    if (!dead) {
      // Pelo: tratti corti sul dorso, sempre negli stessi punti.
      r.push();
      r.setAlpha(0.2);
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI * 0.95 + i * 0.26;
        r.line(
          [
            cx + Math.cos(a) * hw * 0.55,
            top + bodyH * 0.5 + Math.sin(a) * bodyH * 0.3,
            cx + Math.cos(a) * hw * 1.02,
            top + bodyH * 0.5 + Math.sin(a) * bodyH * 0.52,
          ],
          1.4,
          hide.deep,
        );
      }
      r.pop();
    }
  }

  private drawArms(
    r: Renderer,
    cx: number,
    top: number,
    bodyW: number,
    bodyH: number,
    gait: number,
  ): void {
    const hide = MATERIAL.hide;
    const raised = this.state === 'slamWind';
    const slamming = this.state === 'slam';
    const hw = bodyW / 2;

    for (const side of [-1, 1] as const) {
      const shoulderX = cx + side * hw * 0.82;
      const shoulderY = top + bodyH * 0.42;
      const handY = raised
        ? top - 12
        : slamming
          ? top + bodyH * 0.98
          : shoulderY + 14 + side * gait * 3;
      const handX = raised ? shoulderX + side * 4 : shoulderX + side * (slamming ? 9 : 5);

      r.line([shoulderX, shoulderY, handX, handY], 7, hide.dark);
      r.ellipse(handX, handY, 6, 5.5, hide.base);
      // Unghie: tre per zampa, rivolte in basso.
      r.push();
      r.setAlpha(0.9);
      for (let i = -1; i <= 1; i++) {
        r.polygon(
          [handX + i * 3 - 1.2, handY + 3, handX + i * 3 + 1.2, handY + 3, handX + i * 3, handY + 8],
          MATERIAL.steel.light,
        );
      }
      r.pop();
    }
  }

  private drawLegs(r: Renderer, cx: number, feet: number, bodyW: number, gait: number): void {
    const hide = MATERIAL.hide;
    for (const [i, side] of [-1, 1].entries()) {
      const lift = Math.max(0, (i === 0 ? gait : -gait)) * 3;
      const lx = cx + side * bodyW * 0.28;
      r.roundedRect(lx - 8, feet - 9 - lift, 16, 9, 4, hide.dark);
      r.rect(lx - 6, feet - 9 - lift, 12, 2, alpha(hide.light, 0.35));
      r.push();
      r.setAlpha(0.85);
      for (let c = -1; c <= 1; c++) {
        r.line([lx + c * 4.5, feet - 3 - lift, lx + c * 4.5, feet - lift], 1.4, PALETTE.paper);
      }
      r.pop();
    }
  }

  private drawFace(
    r: Renderer,
    cx: number,
    top: number,
    bodyW: number,
    bodyH: number,
    stunned: boolean,
    charging: boolean,
    dead: boolean,
  ): void {
    const eyeY = top + bodyH * 0.34;
    const spread = bodyW * 0.21;
    const sleeping = this.state === 'wait';

    for (const side of [-1, 1] as const) {
      const ex = cx + side * spread;

      if (dead || stunned) {
        // Occhi a croce: il linguaggio è quello dei cartoni, e si legge subito.
        r.line([ex - 4, eyeY - 4, ex + 4, eyeY + 4], 2, PALETTE.ink);
        r.line([ex + 4, eyeY - 4, ex - 4, eyeY + 4], 2, PALETTE.ink);
        continue;
      }
      if (sleeping) {
        r.line([ex - 4.5, eyeY, ex + 4.5, eyeY], 2, MATERIAL.hide.deep);
        continue;
      }

      r.ellipse(ex, eyeY, 5.4, 5, PALETTE.paper);
      r.ellipse(ex, eyeY, 4.6, 4.2, MATERIAL.gold.light);
      r.ellipse(ex + side * 0.5, eyeY, 1.7, 3.4, '#120c08');
      r.ellipse(ex - 1.4, eyeY - 1.8, 1.1, 0.9, glare(0.9));
      // Sopracciglio: è quello che lo fa sembrare arrabbiato e non stupito.
      r.polygon(
        [ex - side * 6.5, eyeY - 8, ex + side * 5.5, eyeY - 3.6, ex + side * 5.5, eyeY - 7],
        MATERIAL.hide.deep,
      );

      if (charging) {
        // In carica gli occhi si accendono: è il preavviso, e dura pochissimo.
        r.push();
        r.setBlend('add');
        r.setAlpha(0.5);
        r.radial(ex, eyeY, 14, 12, [
          { at: 0, color: alpha(PALETTE.hot, 0.8) },
          { at: 1, color: alpha(PALETTE.hot, 0) },
        ]);
        r.pop();
      }
    }

    // Ghigno con i denti d'oro: il sorriso di chi ha messo lui le trappole.
    const mouthY = top + bodyH * 0.62;
    const open = charging || this.state === 'charge' || this.state === 'slam';
    if (dead) {
      r.line([cx - 8, mouthY + 2, cx + 8, mouthY + 2], 2, MATERIAL.hide.deep);
      return;
    }
    if (open) {
      r.blob(
        [cx - 11, mouthY - 2, cx, mouthY - 4, cx + 11, mouthY - 2, cx + 8, mouthY + 9, cx - 8, mouthY + 9],
        PALETTE.hotDeep,
      );
      for (let i = -2; i <= 2; i++) {
        r.polygon(
          [cx + i * 4.4 - 2, mouthY - 2, cx + i * 4.4 + 2, mouthY - 2, cx + i * 4.4, mouthY + 3.5],
          MATERIAL.gold.light,
        );
      }
    } else {
      r.line([cx - 10, mouthY, cx - 3, mouthY + 4, cx + 3, mouthY + 4, cx + 10, mouthY], 2, MATERIAL.hide.deep);
      r.polygon([cx + 4, mouthY + 3, cx + 8, mouthY + 3, cx + 6, mouthY + 8], MATERIAL.gold.base);
    }
  }

  /**
   * La corona: quattro gemme, una per colpo. **È la barra della vita**, e sta
   * addosso al boss invece che in un angolo dello schermo — si guarda lui, non
   * l'interfaccia.
   */
  private drawCrown(r: Renderer, cx: number, top: number, bodyW: number, dead: boolean): void {
    const gold = MATERIAL.gold;
    const y = dead ? top + 6 : top - 4;
    const w = bodyW * 0.66;
    const tilt = dead ? 0.5 : 0;

    r.push();
    r.translate(cx, y);
    r.rotate(tilt);

    // Cerchio della corona e cinque punte.
    r.gradientRect(-w / 2, -2, w, 8, [
      { at: 0, color: gold.light },
      { at: 0.45, color: gold.base },
      { at: 1, color: gold.dark },
    ]);
    for (let i = 0; i < 5; i++) {
      const px = -w / 2 + (i + 0.5) * (w / 5);
      r.polygon([px - w / 12, -2, px + w / 12, -2, px, -12], gold.base);
      r.line([px, -10, px, -3], 1, alpha(gold.spec, 0.8));
    }
    r.rect(-w / 2, -2, w, 1.4, alpha(gold.spec, 0.7));

    // Le gemme: accese quelle che restano, buchi neri quelle spente.
    for (let i = 0; i < 4; i++) {
      const px = -w / 2 + (i + 0.5) * (w / 4);
      const alive = i >= this.hits;
      if (alive) {
        r.ellipse(px, 2, 3, 3.4, PALETTE.hotDeep);
        r.ellipse(px, 2, 2.1, 2.5, PALETTE.hot);
        r.ellipse(px - 0.7, 1.2, 0.8, 0.8, glare(0.9));
        r.push();
        r.setBlend('add');
        r.setAlpha(0.25 + Math.abs(Math.sin(this.life / 26 + i)) * 0.2);
        r.radial(px, 2, 9, 9, [
          { at: 0, color: alpha(PALETTE.hot, 0.8) },
          { at: 1, color: alpha(PALETTE.hot, 0) },
        ]);
        r.pop();
      } else {
        r.ellipse(px, 2, 3, 3.4, gold.deep);
        r.ellipse(px, 2, 2, 2.4, PALETTE.ink);
      }
    }
    r.pop();
  }
}
