import { moveY } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { FEEL, LUCIO, TILE_SIZE } from '../config';
import { MATERIAL, PALETTE, alpha, glare, shade } from '../theme';
import { isSolid } from '../tiles';
import { DEATH_CAUSE } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * Gothic Lucio: il boss di 2-11.
 *
 * Il Padrone era un problema **orizzontale** — camminava verso di te e tu
 * sceglievi sotto quale mattone farlo arrivare. Lucio è un problema
 * **verticale**, ed è costruito apposta per non somigliargli in niente:
 *
 *  - non cammina. Vive appeso alla volta, a testa in giù, e scorre là sopra;
 *  - non carica. Si stacca e piomba dritto, una colonna sola, senza curve;
 *  - non lo si colpisce. Non c'è niente da tirargli: l'unica arma dell'arena
 *    è il pavimento, e il pavimento fa male solo a lui.
 *
 * **Come si spegne.** Sul pavimento della cappella ci sono i ceri. Lucio mira
 * la colonna dove sei *quando comincia a mirare* e da lì in poi non cambia più
 * idea: se al momento del tuffo tu sei altrove e sotto di lui c'è un cero
 * acceso, ci finisce dentro e gli prende fuoco il mantello. Quindi il
 * combattimento non è schivare — è **schivare stando sopra la fiamma giusta**,
 * cioè farsi esca in un punto scelto. Dove il Padrone si guidava, Lucio si
 * *attira*.
 *
 * **Come bara.** Il cero su cui atterra se lo porta via schiacciandolo, e in
 * seconda fase l'onda dell'atterraggio spegne anche quelli lì intorno: lo
 * stesso angolo di cappella non funziona due volte, e lo scontro va spostato
 * di continuo verso le fiamme rimaste. Sempre da lì in avanti l'atterraggio fa
 * male anche a chi si è tolto per un pelo, e l'unica risposta è non toccare
 * terra in quel momento.
 */

export type LucioState =
  | 'wait'
  | 'hang'
  | 'aim'
  | 'dive'
  | 'stuck'
  | 'climb'
  | 'hurt'
  | 'rage'
  | 'dead';

/** Distanza a cui si accorge che sei entrato in cappella. */
const WAKE_RANGE = 340;
const WAKE_TIMEOUT = 80;

export class GothicBoss extends Entity {
  state: LucioState = 'wait';
  /** Colpi incassati: 0..4. Sono le quattro candele del suo candelabro. */
  hits = 0;
  phase: 1 | 2 = 1;
  facing = -1;

  /** Quota della volta: ci torna sempre, ed è l'unica cosa che non cambia. */
  readonly ceilingY: number;
  /**
   * Colonna scelta al momento della mira, in pixel.
   *
   * Congelata apposta: un preavviso che continua a inseguirti non è un
   * preavviso, è una condanna con l'animazione davanti.
   */
  private aimX = 0;
  /** L'onda dell'atterraggio è viva? Serve al mondo per sapere se uccide. */
  waveTicks = 0;

  private timer = WAKE_TIMEOUT;
  /** Cronometro solo grafico: respiro, ondeggio del mantello, ciglia. */
  private life = 0;

  constructor(x: number, y: number) {
    super(x, y, LUCIO.width, LUCIO.height);
    this.ceilingY = y;
  }

  // ---------------------------------------------------------------- stato
  get isDead(): boolean {
    return this.state === 'dead';
  }

  /** Sta scendendo addosso a qualcuno: serve al mondo per la battuta giusta. */
  get isDiving(): boolean {
    return this.state === 'dive';
  }

  /** Conficcato nel pavimento: è il momento in cui il cero conta. */
  get isStuck(): boolean {
    return this.state === 'stuck';
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }

  /** Il bordo basso: è quello che deve finire dentro il cero. */
  get feetY(): number {
    return this.y + this.h;
  }

  // ---------------------------------------------------------------- ciclo
  update(world: World): void {
    this.life++;
    if (this.waveTicks > 0) this.waveTicks--;

    switch (this.state) {
      case 'dead':
        this.updateDead(world);
        return;
      case 'wait':
        this.updateWait(world);
        break;
      case 'hang':
        this.updateHang(world);
        break;
      case 'aim':
        this.updateAim(world);
        break;
      case 'dive':
        this.updateDive(world);
        break;
      case 'stuck':
      case 'hurt':
      case 'rage':
        this.updateRooted(world);
        break;
      case 'climb':
        this.updateClimb(world);
        break;
      default:
        break;
    }
  }

  private updateDead(world: World): void {
    // Cade come cade un gatto che ha finito di fare il gatto: dritto.
    this.vy = Math.min(this.vy + 0.6, 14);
    moveY(this, world.map, isSolid);
  }

  private updateWait(world: World): void {
    this.faceThe(world);
    const dx = Math.abs(world.player.centerX - this.centerX);
    if (--this.timer > 0 && dx > WAKE_RANGE) return;

    world.audio.play('reveal');
    world.camera.shake(5);
    world.effects.floatingText(this.centerX, this.y + this.h + 18, 'GOTHIC LUCIO', PALETTE.hot, 15);
    this.enter('hang', this.value(LUCIO.hangTicks, LUCIO.hangTicksFurious));
  }

  /**
   * Appeso, scorre verso il gatto. Più lento di lui, sempre: è il gatto a
   * decidere dove si combatte, esattamente come col Padrone — cambia solo che
   * qui il posto lo si sceglie *sopra* un cero invece che *sotto* un mattone.
   */
  private updateHang(world: World): void {
    this.faceThe(world);
    const speed = this.value(LUCIO.slideSpeed, LUCIO.slideSpeedFurious);
    const delta = world.player.centerX - this.centerX;
    this.x += Math.sign(delta) * Math.min(speed, Math.abs(delta));
    this.clampToArena(world);
    this.y = this.ceilingY;

    // Si stacca quando è **sopra** il gatto, non quando scade un cronometro:
    // è quello che rende il tuffo una cosa che si può provocare, e provocarlo
    // sopra il cero giusto è tutto il combattimento. Il tetto sul tempo serve
    // solo a chi scappa per sempre — scorre più lento del gatto, quindi
    // qualcuno che non si ferma mai riuscirebbe a non farlo tuffare mai.
    const aligned = Math.abs(delta) <= LUCIO.alignRange;
    if (!aligned && --this.timer > 0) return;

    this.aimX = world.player.centerX;
    this.enter('aim', this.value(LUCIO.aimTicks, LUCIO.aimTicksFurious));
    world.audio.play('bump');
  }

  /** Mira: si allunga, punta la colonna, e da qui in poi non cambia più idea. */
  private updateAim(world: World): void {
    const delta = this.aimX - this.centerX;
    // Si allinea alla colonna scelta, non al gatto: è la differenza fra un
    // preavviso e un inseguimento.
    this.x += Math.sign(delta) * Math.min(2.2, Math.abs(delta));
    this.clampToArena(world);

    if (this.life % 4 === 0) {
      world.effects.burst(this.centerX, this.feetY, PALETTE.hotDeep, {
        count: 1,
        speed: 0.6,
        size: 3,
        life: 22,
        shape: 'circle',
        angle: Math.PI / 2,
        spread: 0.6,
      });
    }

    if (--this.timer > 0) return;
    this.enter('dive', 0);
    this.vy = this.value(LUCIO.diveSpeed, LUCIO.diveSpeedFurious);
    world.audio.play('trap');
  }

  private updateDive(world: World): void {
    this.vy = this.value(LUCIO.diveSpeed, LUCIO.diveSpeedFurious);
    let landed = false;
    moveY(this, world.map, isSolid, { onLand: () => (landed = true) });

    if (this.life % 2 === 0) {
      world.effects.burst(this.centerX, this.y, PALETTE.ink, {
        count: 2,
        speed: 1.4,
        size: 4,
        life: 16,
        shape: 'circle',
        angle: -Math.PI / 2,
        spread: 0.8,
      });
    }

    if (landed) this.plant(world);
  }

  /** Atterrato. Il mondo guarda cosa c'era lì sotto e decide se brucia. */
  private plant(world: World): void {
    this.vy = 0;
    this.enter('stuck', this.value(LUCIO.stuckTicks, LUCIO.stuckTicksFurious));
    world.audio.play('death');
    world.camera.shake(FEEL.screenShakeOnTrap + 4);
    world.effects.freeze(3);
    world.effects.burst(this.centerX, this.feetY, PALETTE.stone, {
      count: 14,
      speed: 3.8,
      size: 4.5,
      life: 26,
      angle: -Math.PI / 2,
      spread: Math.PI * 0.9,
    });

    // L'onda esiste solo in seconda fase: la prima metà dello scontro serve a
    // insegnare il tuffo, non a punirlo due volte.
    if (this.phase === 2) {
      this.waveTicks = LUCIO.waveTicks;
      world.effects.ring(this.centerX, this.feetY - 4, PALETTE.hot, 6, LUCIO.waveRadius);
    }

    world.lucioPlanted(this);
  }

  private updateRooted(world: World): void {
    if (--this.timer > 0) return;

    switch (this.state) {
      case 'stuck':
        this.enter('climb', 0);
        world.audio.play('bump');
        break;
      case 'hurt':
        if (this.hits >= LUCIO.hitsPerPhase && this.phase === 1) this.beginRage(world);
        else this.enter('hang', this.value(LUCIO.hangTicks, LUCIO.hangTicksFurious));
        break;
      case 'rage':
        this.enter('hang', LUCIO.hangTicksFurious);
        break;
      default:
        break;
    }
  }

  /** Risale verso la volta. Non è una fuga: è dove abita. */
  private updateClimb(world: World): void {
    this.y -= LUCIO.climbSpeed;
    // Cenere che si stacca dal sudario risalendo: dice "sta tornando su" anche
    // a chi in quel momento sta guardando dall'altra parte.
    if (this.life % 3 === 0) {
      world.effects.burst(this.centerX, this.feetY, PALETTE.ink, {
        count: 1,
        speed: 0.9,
        size: 3,
        life: 20,
        shape: 'circle',
        angle: Math.PI / 2,
        spread: 0.9,
      });
    }
    if (this.y > this.ceilingY) return;
    this.y = this.ceilingY;
    this.enter('hang', this.value(LUCIO.hangTicks, LUCIO.hangTicksFurious));
  }

  private beginRage(world: World): void {
    this.phase = 2;
    this.y = this.ceilingY;
    this.enter('rage', LUCIO.rageTicks);
    world.audio.play('death');
    world.camera.shake(12);
    world.effects.flash(0.42, PALETTE.hot);
    world.effects.floatingText(this.centerX, this.feetY + 16, 'BUIO', PALETTE.hot, 15);
    world.onLucioRage();
  }

  // ---------------------------------------------------------------- danno
  /**
   * È finito dentro un cero acceso. Ritorna true se il colpo conta: il mondo lo
   * usa per decidere se festeggiare o se il tuffo è andato a vuoto.
   */
  takeHit(world: World): boolean {
    if (this.state !== 'stuck') return false;

    this.hits++;
    world.audio.play('stomp');
    world.camera.shake(FEEL.screenShakeOnDeath);
    world.effects.freeze(6);
    world.effects.flash(0.3, PALETTE.gold);
    world.effects.ring(this.centerX, this.y + this.h * 0.4, PALETTE.gold, 6, 24);
    world.effects.burst(this.centerX, this.y + this.h * 0.5, PALETTE.gold, {
      count: 22,
      speed: 4.8,
      size: 4,
      life: 36,
      light: true,
    });

    const left = LUCIO.hitsPerPhase * 2 - this.hits;
    world.effects.floatingText(
      this.centerX,
      this.y - 10,
      left > 0 ? `${left} CANDELE` : 'CANDELABRO SPENTO',
      PALETTE.gold,
      14,
    );

    if (left <= 0) {
      this.die(world);
      return true;
    }

    // Torna appeso: incassa il colpo dove vive, non dove l'ha preso.
    this.y = this.ceilingY;
    this.enter('hurt', LUCIO.hurtTicks);
    return true;
  }

  private die(world: World): void {
    this.state = 'dead';
    this.timer = 0;
    this.vy = -3;
    world.audio.play('win');
    world.camera.shake(14);
    world.effects.freeze(8);
    world.effects.flash(0.55, PALETTE.paper);
    world.effects.ring(this.centerX, this.y + 12, PALETTE.hot, 7, 28);
    world.effects.burst(this.centerX, this.y + 12, MATERIAL.violet.light, {
      count: 34,
      speed: 6,
      size: 5,
      life: 64,
      gravity: 0.28,
      light: true,
    });
  }

  // ---------------------------------------------------------------- contatto
  onTouch(world: World): void {
    if (this.state === 'dead') return;
    world.kill(this.state === 'dive' ? DEATH_CAUSE.lucioDive : DEATH_CAUSE.lucio);
  }

  /** Collare di borchie, tutte rivolte in su. Saltargli addosso è una scelta. */
  override onStomp(world: World): boolean {
    if (this.state === 'dead') return false;
    world.kill(DEATH_CAUSE.lucioStomp);
    return false;
  }

  // ---------------------------------------------------------------- utilità
  private enter(state: LucioState, ticks: number): void {
    this.state = state;
    this.timer = ticks;
  }

  private faceThe(world: World): void {
    const delta = world.player.centerX - this.centerX;
    if (Math.abs(delta) > 6) this.facing = delta > 0 ? 1 : -1;
  }

  /** Non esce dall'arena: la cappella è larga uno schermo e finisce. */
  private clampToArena(world: World): void {
    const max = world.map.widthPx - this.w - TILE_SIZE;
    this.x = Math.max(TILE_SIZE, Math.min(max, this.x));
  }

  private value(calm: number, furious: number): number {
    return this.phase === 1 ? calm : furious;
  }

  // ---------------------------------------------------------------- disegno
  /**
   * Un gatto lungo e nero, appeso per le zampe posteriori.
   *
   * La posa dice lo stato prima di qualunque dettaglio, come per il Padrone: se
   * penzola sta scegliendo, se è teso sta mirando, se è a testa in giù nel
   * pavimento ha appena sbagliato. L'unica cosa che serve leggere in fretta è
   * **quando comincia a mirare**, e infatti è l'unico momento in cui si
   * illumina.
   */
  draw(r: Renderer, tick: number): void {
    const dead = this.state === 'dead';
    const aiming = this.state === 'aim';
    const diving = this.state === 'dive';
    const stuck = this.state === 'stuck';
    const raging = this.state === 'rage';

    const cx = this.centerX;
    const sway = dead || stuck ? 0 : Math.sin(this.life / 26) * 2.6;
    const shiver = aiming || raging ? (tick % 2 ? 1.4 : -1.4) : 0;
    // Appeso è lungo e stretto, in tuffo è una lama, conficcato è schiacciato.
    const stretch = diving ? 1.18 : aiming ? 1.1 : stuck ? 0.78 : 1;
    const bodyH = this.h * stretch;
    const bodyW = this.w * (diving ? 0.82 : stuck ? 1.22 : 1);
    const top = this.y + (this.h - bodyH) * (stuck ? 1 : 0);
    const hx = cx + sway + shiver;

    // Il filo di seta a cui sta appeso: c'è solo quando è appeso davvero, ed è
    // l'unica cosa che spiega perché non cade.
    if (!dead && !diving && !stuck) {
      r.push();
      r.setAlpha(0.5);
      r.line([cx, this.ceilingY - 10, hx, top + 6], 1.3, MATERIAL.onyx.light);
      r.pop();
    }

    if (raging || (this.phase === 2 && !dead)) {
      r.push();
      r.setBlend('add');
      r.setAlpha(0.09 + Math.abs(Math.sin(this.life / 20)) * 0.13);
      r.radial(hx, top + bodyH * 0.5, bodyW * 1.3, bodyH * 1.1, [
        { at: 0, color: alpha(MATERIAL.violet.base, 0.75) },
        { at: 1, color: alpha(MATERIAL.violet.base, 0) },
      ]);
      r.pop();
    }

    this.drawShroud(r, hx, top, bodyW, bodyH, dead);
    this.drawBody(r, hx, top, bodyW, bodyH, dead);
    this.drawCollar(r, hx, top, bodyW, bodyH, stuck);
    this.drawFace(r, hx, top, bodyW, bodyH, aiming, stuck, dead);
    this.drawCandelabrum(r, hx, top, bodyW, bodyH, dead);

    if (aiming) {
      // La colonna mirata, disegnata fino a terra: è tutto il preavviso che c'è,
      // e senza di lei il tuffo sarebbe un'imboscata invece che una minaccia.
      r.push();
      r.setBlend('add');
      r.setAlpha(0.14 + Math.abs(Math.sin(this.life / 5)) * 0.12);
      r.gradientRect(this.aimX - 11, top + bodyH, 22, 480, [
        { at: 0, color: alpha(PALETTE.hot, 0.8) },
        { at: 1, color: alpha(PALETTE.hot, 0) },
      ]);
      r.pop();
    }

    if (this.waveTicks > 0) {
      // L'onda dell'atterraggio: dura pochissimo e si vede benissimo, perché
      // uccide anche chi si era tolto.
      const t = this.waveTicks / LUCIO.waveTicks;
      r.push();
      r.setBlend('add');
      r.setAlpha(t * 0.55);
      r.radial(cx, this.feetY - 4, LUCIO.waveRadius * (1.3 - t * 0.5), 22, [
        { at: 0, color: alpha(PALETTE.hot, 0) },
        { at: 0.7, color: alpha(PALETTE.hot, 0.9) },
        { at: 1, color: alpha(PALETTE.hot, 0) },
      ]);
      r.pop();
    }
  }

  /** Il sudario: velluto che pende verso l'alto, perché lui pende verso il basso. */
  private drawShroud(
    r: Renderer,
    cx: number,
    top: number,
    bodyW: number,
    bodyH: number,
    dead: boolean,
  ): void {
    const cloth = MATERIAL.onyx;
    const drift = dead ? 0 : Math.sin(this.life / 15) * 4;
    const hemY = this.state === 'stuck' || dead ? top + bodyH + 4 : top - 6 - Math.abs(drift) * 0.4;

    r.blob(
      [
        cx - bodyW * 0.5, top + bodyH * 0.34,
        cx - bodyW * 0.34 + drift, hemY,
        cx + bodyW * 0.36 + drift, hemY - 3,
        cx + bodyW * 0.5, top + bodyH * 0.38,
        cx, top + bodyH * 0.62,
      ],
      cloth.base,
    );
    r.push();
    r.setAlpha(0.5);
    r.blob(
      [
        cx - bodyW * 0.22, top + bodyH * 0.38,
        cx - bodyW * 0.1 + drift * 0.5, hemY + 4,
        cx + bodyW * 0.2 + drift * 0.5, hemY + 2,
        cx, top + bodyH * 0.56,
      ],
      cloth.deep,
    );
    r.pop();
    r.push();
    r.setAlpha(0.35);
    r.line([cx - bodyW * 0.46, top + bodyH * 0.36, cx - bodyW * 0.3 + drift, hemY + 2], 1.3, cloth.light);
    r.pop();
  }

  private drawBody(
    r: Renderer,
    cx: number,
    top: number,
    bodyW: number,
    bodyH: number,
    dead: boolean,
  ): void {
    const coat = MATERIAL.onyx;
    const hw = bodyW / 2;

    // Sagoma affusolata: un gatto tirato per le zampe, non una palla.
    r.blob(
      [
        cx, top + 2,
        cx + hw * 0.86, top + bodyH * 0.24,
        cx + hw * 0.72, top + bodyH * 0.74,
        cx, top + bodyH,
        cx - hw * 0.72, top + bodyH * 0.74,
        cx - hw * 0.86, top + bodyH * 0.24,
      ],
      coat.base,
    );

    r.push();
    r.setAlpha(0.75);
    r.radial(cx - hw * 0.3, top + bodyH * 0.28, hw * 0.9, bodyH * 0.34, [
      { at: 0, color: alpha(coat.light, 0.9) },
      { at: 1, color: alpha(coat.light, 0) },
    ]);
    r.pop();
    r.push();
    r.setAlpha(0.55);
    r.radial(cx + hw * 0.24, top + bodyH * 0.8, hw * 0.8, bodyH * 0.26, [
      { at: 0, color: alpha(coat.deep, 0.9) },
      { at: 1, color: alpha(coat.deep, 0) },
    ]);
    r.pop();

    // Il costato: quattro righe d'osso sul fianco. Non è una decorazione, è il
    // motivo per cui il manto sbloccato si chiama gotico e non "nero".
    r.push();
    r.setAlpha(0.34);
    for (let i = 0; i < 4; i++) {
      const y = top + bodyH * (0.3 + i * 0.13);
      r.line([cx - hw * 0.6, y + 2, cx, y, cx + hw * 0.6, y + 2], 1.6, MATERIAL.bone.base);
    }
    r.pop();

    // Le zampe posteriori, aggrappate in alto. Sono la cosa che rende leggibile
    // "sta appeso" invece di "sta volando".
    if (!dead) {
      for (const side of [-1, 1] as const) {
        const lx = cx + side * hw * 0.44;
        r.line([lx, top + 6, lx + side * 3, top - 8], 5, coat.dark);
        r.ellipse(lx + side * 3, top - 9, 4, 3.4, coat.base);
      }
    }

    // La coda: lunga, verso il basso, con la punta che si arriccia.
    const tailX = cx + (this.facing > 0 ? -1 : 1) * hw * 0.5;
    const wag = Math.sin(this.life / 12) * 5;
    r.line(
      [
        tailX, top + bodyH * 0.8,
        tailX - this.facing * 8, top + bodyH + 10 + wag * 0.3,
        tailX - this.facing * 2 + wag, top + bodyH + 22,
      ],
      3.2,
      coat.dark,
    );
    r.line(
      [
        tailX, top + bodyH * 0.8,
        tailX - this.facing * 8, top + bodyH + 10 + wag * 0.3,
        tailX - this.facing * 2 + wag, top + bodyH + 22,
      ],
      2,
      coat.base,
    );
  }

  /** Collare di borchie: la ragione per cui non si schiaccia. */
  private drawCollar(
    r: Renderer,
    cx: number,
    top: number,
    bodyW: number,
    bodyH: number,
    stuck: boolean,
  ): void {
    const y = top + bodyH * (stuck ? 0.34 : 0.68);
    const w = bodyW * 0.72;
    r.roundedRect(cx - w / 2, y - 3, w, 6, 3, MATERIAL.onyx.deep);
    r.rect(cx - w / 2, y - 3, w, 1.4, alpha(MATERIAL.onyx.light, 0.5));
    for (let i = 0; i < 5; i++) {
      const px = cx - w / 2 + (i + 0.5) * (w / 5);
      // Le punte guardano *verso il basso* nello spazio del disegno, che stando
      // lui a testa in giù vuol dire verso chi salta.
      r.polygon([px - 2.4, y + 2, px + 2.4, y + 2, px, y + 9], MATERIAL.steel.light);
      r.line([px, y + 3, px, y + 7], 0.9, glare(0.6));
    }
  }

  private drawFace(
    r: Renderer,
    cx: number,
    top: number,
    bodyW: number,
    bodyH: number,
    aiming: boolean,
    stuck: boolean,
    dead: boolean,
  ): void {
    // La testa sta in basso: è appeso. Quando è conficcato nel pavimento la
    // testa è dentro il pavimento, e si vede solo il collo.
    const headY = top + bodyH * (stuck ? 0.98 : 0.88);
    const hw = bodyW * 0.3;
    const sleeping = this.state === 'wait';

    if (stuck) {
      // Conficcato: niente faccia, solo le crepe intorno al buco. È la posa più
      // umiliante che il gioco riesca a disegnare, ed è meritata.
      r.push();
      r.setAlpha(0.6);
      for (let i = -2; i <= 2; i++) {
        r.line([cx + i * 7, headY - 4, cx + i * 10, headY + 6], 1.4, PALETTE.ink);
      }
      r.pop();
      return;
    }

    r.ellipse(cx, headY, hw, hw * 0.86, MATERIAL.onyx.base);
    r.push();
    r.setAlpha(0.5);
    r.radial(cx - hw * 0.3, headY - hw * 0.3, hw, hw * 0.7, [
      { at: 0, color: alpha(MATERIAL.onyx.light, 0.9) },
      { at: 1, color: alpha(MATERIAL.onyx.light, 0) },
    ]);
    r.pop();

    // Orecchie: verso il basso, perché tutto in lui è verso il basso.
    for (const side of [-1, 1] as const) {
      r.polygon(
        [cx + side * hw * 0.6, headY + hw * 0.2, cx + side * hw * 0.95, headY + hw * 1.15, cx + side * hw * 0.2, headY + hw * 0.7],
        MATERIAL.onyx.dark,
      );
    }

    const eyeY = headY - hw * 0.1;
    for (const side of [-1, 1] as const) {
      const ex = cx + side * hw * 0.42;
      if (dead) {
        r.line([ex - 3.4, eyeY - 3.4, ex + 3.4, eyeY + 3.4], 1.8, MATERIAL.bone.base);
        r.line([ex + 3.4, eyeY - 3.4, ex - 3.4, eyeY + 3.4], 1.8, MATERIAL.bone.base);
        continue;
      }
      if (sleeping) {
        r.line([ex - 3.6, eyeY, ex + 3.6, eyeY], 1.6, MATERIAL.onyx.deep);
        continue;
      }

      r.ellipse(ex, eyeY, 3.8, 4.2, MATERIAL.violet.dark);
      r.ellipse(ex, eyeY, 3, 3.4, MATERIAL.violet.base);
      r.ellipse(ex, eyeY, 1.1, 3, PALETTE.ink);
      r.ellipse(ex - 1, eyeY - 1.2, 0.9, 0.8, glare(0.85));
      // Ciglia: tre per occhio, lunghissime. È il dettaglio che lo fa gotico
      // invece che semplicemente nero.
      r.push();
      r.setAlpha(0.9);
      for (let i = -1; i <= 1; i++) {
        r.line(
          [ex + i * 2.6, eyeY + 3.4, ex + i * 3.6 + side * 1.5, eyeY + 8],
          1.1,
          MATERIAL.onyx.deep,
        );
      }
      r.pop();

      if (aiming) {
        r.push();
        r.setBlend('add');
        r.setAlpha(0.55);
        r.radial(ex, eyeY, 13, 12, [
          { at: 0, color: alpha(MATERIAL.violet.light, 0.9) },
          { at: 1, color: alpha(MATERIAL.violet.light, 0) },
        ]);
        r.pop();
      }
    }
  }

  /**
   * Il candelabro che porta in testa — cioè, stando lui a testa in giù, sotto.
   * **È la barra della vita**, come la corona del Padrone: quattro candele, una
   * per colpo, e sta addosso a lui invece che in un angolo dello schermo.
   */
  private drawCandelabrum(
    r: Renderer,
    cx: number,
    top: number,
    bodyW: number,
    bodyH: number,
    dead: boolean,
  ): void {
    const iron = MATERIAL.iron;
    const y = top + bodyH * (dead ? 0.5 : 1.06);
    const w = bodyW * 0.78;

    r.push();
    r.translate(cx, y);
    r.rotate(dead ? -0.6 : 0);

    r.roundedRect(-w / 2, -2, w, 4, 2, iron.base);
    r.rect(-w / 2, -2, w, 1.2, alpha(iron.light, 0.7));

    for (let i = 0; i < 4; i++) {
      const px = -w / 2 + (i + 0.5) * (w / 4);
      const alive = i >= this.hits && !dead;
      // Il braccio del candelabro e la candela: verso il basso, come tutto.
      r.line([px, -2, px, 5], 1.6, iron.dark);
      r.rect(px - 2, 5, 4, 7, alive ? MATERIAL.wax.base : MATERIAL.wax.dark);
      if (!alive) {
        r.push();
        r.setAlpha(0.5);
        r.line([px, 12, px + 1.5, 17], 1, shade(0.7));
        r.pop();
        continue;
      }
      const flick = Math.abs(Math.sin(this.life / 7 + i * 1.7));
      r.ellipse(px, 14 + flick, 2.2, 3.4 + flick, PALETTE.gold);
      r.ellipse(px, 14 + flick, 1.1, 1.9, PALETTE.paper);
      r.push();
      r.setBlend('add');
      r.setAlpha(0.2 + flick * 0.2);
      r.radial(px, 13, 11, 12, [
        { at: 0, color: alpha(PALETTE.gold, 0.8) },
        { at: 1, color: alpha(PALETTE.gold, 0) },
      ]);
      r.pop();
    }
    r.pop();
  }
}
