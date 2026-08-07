import type { Renderer } from '@engine/render/renderer';
import { FEEL, SPHINX, TILE_SIZE } from '../config';
import { MATERIAL, PALETTE, alpha, glare, shade } from '../theme';
import { DEATH_CAUSE } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * La Sfinge: il boss di 3-11.
 *
 * I primi due scontri si combattono **contro** qualcosa. Il Padrone cammina
 * verso di te e tu scegli sotto quale mattone farlo arrivare; Lucio si tuffa e
 * tu scegli sopra quale cero farti trovare. In tutti e due i casi l'arma è un
 * pezzo di mappa che esiste da prima e sta lì fermo ad aspettare.
 *
 * Qui l'arma non esiste ancora: **la fabbrica lei**.
 *
 * La Sfinge vive sotto il pavimento della sala e ci scava dentro verso di te —
 * più lenta di te, sempre, come gli altri due, quindi è ancora il gatto a
 * decidere dove si combatte. Quando ti arriva sotto si ferma, il pavimento
 * rimbomba, e poi erutta. Se sotto il suo corpo la pietra è sana, l'eruzione la
 * sbriciola in sabbia: la stanza si consuma un pezzo per volta, e non è un
 * effetto scenico — è il combattimento. Se invece lì sotto c'è già la sabbia
 * che ha fatto lei, non trova presa: viene su a metà e resta conficcata, ed è
 * l'unico modo di farle male.
 *
 * Quindi non si schiva e non si attira: si **sceglie il terreno**. Ci si mette
 * sul bordo delle proprie macerie — sul bordo, non sopra: il suo corpo è largo
 * due celle e le basta toccarne una guasta — e ci si toglie prima che esca. È
 * un problema di spazio, ed è l'unico dei tre in cui l'arena a fine scontro non
 * somiglia più a quella dell'inizio.
 *
 * Lo stato vive qui, ma **le decisioni no**: cosa c'è sotto il pavimento lo sa
 * solo il mondo, quindi al momento di uscire questa classe chiede a lui
 * (`world.sphinxSurfaces`) e lui risponde chiamando `erupt()` o `sink()`. È la
 * regola di sempre — chi deve sapere due cose insieme sta in `world.ts`.
 */

export type SphinxState =
  | 'wait'
  | 'burrow'
  | 'rumble'
  | 'erupt'
  | 'crest'
  | 'dive'
  | 'sink'
  | 'hurt'
  | 'rage'
  | 'dead';

/** Distanza a cui si accorge che qualcuno è entrato nella sala. */
const WAKE_RANGE = 360;
const WAKE_TIMEOUT = 90;
/** Quanto sta sotto il filo del pavimento mentre scava: solo la gobba si vede. */
const BURIED_DEPTH = 6;

export class Sphinx extends Entity {
  state: SphinxState = 'wait';
  /** Colpi incassati: 0..4. Sono le quattro fasce d'oro del suo copricapo. */
  hits = 0;
  phase: 1 | 2 = 1;
  facing = -1;

  /** Filo del pavimento della sala: la quota a cui torna sempre. */
  readonly floorY: number;

  private timer = WAKE_TIMEOUT;
  /** Cronometro solo grafico: sabbia che cola, occhi, respiro della pietra. */
  private life = 0;
  /** Quanto è uscita, in pixel: serve al disegno e alla collisione. */
  private risen = 0;

  constructor(x: number, y: number) {
    super(x, y, SPHINX.width, SPHINX.height);
    this.floorY = y + SPHINX.height;
    this.bury();
  }

  // ---------------------------------------------------------------- stato
  get isDead(): boolean {
    return this.state === 'dead';
  }

  /** Sepolta: non tocca nessuno, e nessuno può toccare lei. */
  get isBuried(): boolean {
    return this.state === 'burrow' || this.state === 'rumble' || this.state === 'wait';
  }

  /** Conficcata nella propria sabbia: è il momento in cui il colpo conta. */
  get isSunk(): boolean {
    return this.state === 'sink';
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }

  /** La riga di pavimento su cui poggia: è quella che rompe e che la rompe. */
  get floorRow(): number {
    return Math.floor(this.floorY / TILE_SIZE);
  }

  /** Mette il corpo sotto il filo del pavimento, dove non tocca niente. */
  private bury(): void {
    this.risen = 0;
    this.y = this.floorY + BURIED_DEPTH;
  }

  private enter(state: SphinxState, timer: number): void {
    this.state = state;
    this.timer = timer;
  }

  private value(normal: number, furious: number): number {
    return this.phase === 1 ? normal : furious;
  }

  // ---------------------------------------------------------------- ciclo
  update(world: World): void {
    this.life++;

    switch (this.state) {
      case 'dead':
        return;
      case 'wait':
        this.updateWait(world);
        break;
      case 'burrow':
        this.updateBurrow(world);
        break;
      case 'rumble':
        this.updateRumble(world);
        break;
      case 'erupt':
        this.updateErupt(world);
        break;
      case 'crest':
        this.updateCrest(world);
        break;
      case 'dive':
        this.updateDive(world);
        break;
      case 'sink':
      case 'hurt':
      case 'rage':
        this.updateRooted(world);
        break;
      default:
        break;
    }
  }

  private updateWait(world: World): void {
    const dx = Math.abs(world.player.centerX - this.centerX);
    if (--this.timer > 0 && dx > WAKE_RANGE) return;

    world.audio.play('reveal');
    world.camera.shake(6);
    world.effects.floatingText(this.centerX, this.floorY - 40, 'LA SFINGE', PALETTE.hot, 15);
    this.enter('burrow', this.value(SPHINX.burrowTicks, SPHINX.burrowTicksFurious));
  }

  /**
   * Scava sotto il pavimento verso il gatto.
   *
   * Non attraversa i muri: si ferma dove finisce la sala, come il Padrone. E si
   * ferma anche quando arriva **sotto** il gatto — non allo scadere di un
   * cronometro — perché è quello che rende l'eruzione una cosa che si può
   * chiamare, e chiamarla sopra le macerie giuste è tutto il combattimento. Il
   * tetto sul tempo serve solo perché scava più piano di quanto il gatto corra.
   */
  private updateBurrow(world: World): void {
    const speed = this.value(SPHINX.burrowSpeed, SPHINX.burrowSpeedFurious);
    const delta = world.player.centerX - this.centerX;
    this.facing = delta < 0 ? -1 : 1;
    this.x += Math.sign(delta) * Math.min(speed, Math.abs(delta));
    this.clampToArena(world);
    this.bury();

    // La gobba di sabbia che avanza: è l'unica cosa che si vede di lei, ed è
    // anche l'unico modo che il giocatore ha di sapere dove sta. Va tenuta.
    if (this.life % 5 === 0) {
      world.effects.burst(this.centerX - this.facing * 10, this.floorY - 2, PALETTE.sand, {
        count: 2,
        speed: 1.6,
        size: 3,
        life: 18,
        gravity: 0.3,
        angle: -Math.PI / 2,
        spread: 1.1,
      });
    }

    const aligned = Math.abs(delta) <= SPHINX.alignRange;
    if (!aligned && --this.timer > 0) return;

    this.enter('rumble', this.value(SPHINX.rumbleTicks, SPHINX.rumbleTicksFurious));
    world.audio.play('crumble');
  }

  /** Il rimbombo: da qui il punto è deciso e non cambia più. */
  private updateRumble(world: World): void {
    this.bury();
    world.camera.shake(1.5);
    if (this.life % 3 === 0) {
      world.effects.burst(
        this.centerX + (this.life % 2 ? 14 : -14),
        this.floorY - 3,
        PALETTE.sand,
        { count: 2, speed: 2.2, size: 3, life: 20, gravity: 0.35, angle: -Math.PI / 2, spread: 0.9 },
      );
    }

    if (--this.timer > 0) return;
    // Il mondo guarda cosa c'è sotto e decide: pietra sana o sabbia sua.
    world.sphinxSurfaces(this);
  }

  /** Esce dal pavimento sbriciolandolo. Chiamata dal mondo. */
  erupt(world: World): void {
    this.enter('erupt', 0);
    this.risen = 0;
    world.audio.play('trap');
    world.camera.shake(FEEL.screenShakeOnTrap + 5);
    world.effects.freeze(3);
    world.effects.ring(this.centerX, this.floorY, PALETTE.sand, 5, 26);
    world.effects.burst(this.centerX, this.floorY, MATERIAL.sandstone.base, {
      count: 20,
      speed: 5,
      size: 5,
      life: 34,
      gravity: 0.42,
      angle: -Math.PI / 2,
      spread: Math.PI * 0.8,
    });
  }

  /**
   * Non ha trovato presa: la sabbia che ha fatto lei se la tiene. Chiamata dal
   * mondo, che è l'unico a sapere cosa c'è sotto.
   */
  sink(world: World): void {
    this.enter('sink', this.value(SPHINX.sinkTicks, SPHINX.sinkTicksFurious));
    // Esce a metà: si vede benissimo che è uscita male, e si vede da lontano.
    this.risen = SPHINX.eruptHeight * 0.42;
    this.y = this.floorY - this.risen;
    world.audio.play('crumble');
    world.camera.shake(5);
    world.effects.burst(this.centerX, this.floorY, PALETTE.sand, {
      count: 16,
      speed: 2.6,
      size: 4,
      life: 30,
      gravity: 0.2,
      shape: 'circle',
    });
  }

  private updateErupt(world: World): void {
    this.risen = Math.min(SPHINX.eruptHeight, this.risen + SPHINX.eruptSpeed);
    this.y = this.floorY - this.risen;
    if (this.life % 2 === 0) {
      world.effects.burst(this.centerX, this.y + this.h, PALETTE.sand, {
        count: 2,
        speed: 1.8,
        size: 3.5,
        life: 22,
        gravity: 0.3,
        shape: 'circle',
      });
    }
    if (this.risen < SPHINX.eruptHeight) return;
    this.enter('crest', this.value(SPHINX.crestTicks, SPHINX.crestTicksFurious));
  }

  /** Fuori, ferma, a guardare dove sei andato. Non fa niente: guarda. */
  private updateCrest(world: World): void {
    this.facing = world.player.centerX < this.centerX ? -1 : 1;
    if (--this.timer > 0) return;
    this.enter('dive', 0);
    world.audio.play('bump');
  }

  private updateDive(world: World): void {
    this.risen = Math.max(0, this.risen - SPHINX.diveSpeed);
    this.y = this.floorY - this.risen;
    if (this.risen > 0) return;

    this.bury();
    this.enter('burrow', this.value(SPHINX.burrowTicks, SPHINX.burrowTicksFurious));
    world.effects.burst(this.centerX, this.floorY, PALETTE.sand, {
      count: 10,
      speed: 2.4,
      size: 4,
      life: 24,
      gravity: 0.35,
      angle: -Math.PI / 2,
      spread: Math.PI * 0.7,
    });
  }

  private updateRooted(world: World): void {
    if (--this.timer > 0) return;

    switch (this.state) {
      case 'sink':
      case 'hurt':
        if (this.hits >= SPHINX.hitsPerPhase && this.phase === 1) this.beginRage(world);
        else {
          this.bury();
          this.enter('burrow', this.value(SPHINX.burrowTicks, SPHINX.burrowTicksFurious));
        }
        break;
      case 'rage':
        this.bury();
        this.enter('burrow', SPHINX.burrowTicksFurious);
        break;
      default:
        break;
    }
  }

  private beginRage(world: World): void {
    this.phase = 2;
    this.risen = SPHINX.eruptHeight;
    this.y = this.floorY - this.risen;
    this.enter('rage', SPHINX.rageTicks);
    world.audio.play('death');
    world.camera.shake(12);
    world.effects.flash(0.4, PALETTE.sand);
    world.effects.floatingText(this.centerX, this.y - 14, 'LA SALA È MIA', PALETTE.hot, 15);
    world.onSphinxRage();
  }

  private clampToArena(world: World): void {
    const limit = world.map.widthPx - this.w - TILE_SIZE;
    this.x = Math.max(TILE_SIZE, Math.min(limit, this.x));
  }

  // ---------------------------------------------------------------- danno
  /**
   * È rimasta conficcata nella propria sabbia. Ritorna true se il colpo conta:
   * il mondo lo usa per decidere se festeggiare.
   */
  takeHit(world: World): boolean {
    if (this.state !== 'sink') return false;

    this.hits++;
    world.audio.play('stomp');
    world.camera.shake(FEEL.screenShakeOnDeath);
    world.effects.freeze(6);
    world.effects.flash(0.3, PALETTE.gold);
    world.effects.ring(this.centerX, this.y + this.h * 0.4, PALETTE.gold, 6, 26);
    world.effects.burst(this.centerX, this.y + this.h * 0.5, PALETTE.gold, {
      count: 22,
      speed: 4.6,
      size: 4,
      life: 36,
      light: true,
    });

    const left = SPHINX.hitsPerPhase * 2 - this.hits;
    world.effects.floatingText(
      this.centerX,
      this.y - 12,
      left > 0 ? `${left}` : 'SEPOLTA',
      PALETTE.gold,
      15,
    );

    if (this.hits >= SPHINX.hitsPerPhase * 2) {
      this.enter('dead', 0);
      this.risen = SPHINX.eruptHeight * 0.42;
      world.effects.flash(0.55, PALETTE.paper);
      return true;
    }

    // Resta conficcata per il resto della finestra, poi torna sotto.
    this.timer = SPHINX.hurtTicks;
    this.state = 'hurt';
    return true;
  }

  onTouch(world: World): void {
    if (this.isBuried) return;
    world.kill(this.state === 'erupt' ? DEATH_CAUSE.sphinxErupt : DEATH_CAUSE.sphinx);
  }

  /** Schiacciarla è la cosa più naturale del mondo, ed è pietra. */
  override onStomp(world: World): boolean {
    if (this.isBuried) return false;
    world.kill(DEATH_CAUSE.sphinxStomp);
    return false;
  }

  // ---------------------------------------------------------------- disegno
  /**
   * Sepolta si vede solo la gobba; fuori si vede una statua che si muove.
   *
   * La forma è quella delle incisioni sulle pareti del tempio — copricapo a
   * fasce, muso di gatto, zampe davanti — e i materiali sono gli stessi:
   * arenaria per la pietra, oro per le fasce, smalto turchese per gli occhi.
   * Serve a far capire, senza dirlo, che quella sui muri era lei.
   */
  draw(r: Renderer, tick: number): void {
    if (this.isBuried) {
      this.drawMound(r, tick);
      return;
    }

    const stone = MATERIAL.sandstone;
    const gold = MATERIAL.gold;
    const cx = this.centerX;
    const top = this.y;
    const bottom = this.y + this.h;
    const face = this.facing;
    const hurt = this.state === 'sink' || this.state === 'hurt';

    // Ombra sul pavimento: se è fuori, si vede che è fuori.
    r.push();
    r.setAlpha(0.3);
    r.ellipse(cx, this.floorY + 2, this.w * 0.5, 5, PALETTE.ink);
    r.pop();

    // Sabbia che cola dai fianchi: è appena uscita di sotto, e continua a
    // perdere la stanza che si è portata addosso.
    r.push();
    r.setAlpha(0.4);
    for (let i = 0; i < 4; i++) {
      const sx = cx - this.w * 0.4 + i * (this.w * 0.26);
      const fall = ((tick * 2 + i * 17) % 26) + 2;
      r.line([sx, bottom - 6, sx - 1, bottom - 6 + fall], 1.4, PALETTE.sand);
    }
    r.pop();

    // Corpo: un blocco di arenaria squadrato, non un animale. È una statua.
    r.gradientRect(cx - this.w / 2, top + this.h * 0.42, this.w, this.h * 0.58, [
      { at: 0, color: stone.light },
      { at: 0.3, color: stone.base },
      { at: 1, color: stone.dark },
    ]);
    r.rect(cx - this.w / 2, top + this.h * 0.42, this.w, 1.4, alpha(stone.spec, 0.6));

    // Zampe davanti: due parallelepipedi che escono dal blocco, verso di te.
    for (const side of [-1, 1] as const) {
      const px = cx + face * (this.w * 0.22) + side * 9;
      r.gradientRect(px - 5, bottom - 14, 10, 14, [
        { at: 0, color: stone.base },
        { at: 1, color: stone.deep },
      ]);
      r.rect(px - 5, bottom - 14, 10, 1.2, alpha(stone.light, 0.7));
      // Unghie: tre tacche d'oro, come sui rilievi.
      for (let i = 0; i < 3; i++) {
        r.rect(px - 4 + i * 3, bottom - 3, 2, 3, alpha(gold.base, 0.8));
      }
    }

    // Copricapo a fasce: le fasce sono i colpi. Quelle spente diventano pietra,
    // e sono l'unico contatore dello scontro — non c'è HUD che lo dica.
    const headY = top + this.h * 0.3;
    for (let i = 0; i < 4; i++) {
      const lit = i >= this.hits;
      const bandY = headY - 12 + i * 5;
      const half = this.w * (0.34 - i * 0.02);
      r.rect(cx - half, bandY, half * 2, 3.4, lit ? gold.base : stone.dark);
      if (lit) {
        r.rect(cx - half, bandY, half * 2, 1.2, gold.light);
        r.push();
        r.setBlend('add');
        r.setAlpha(0.12 + Math.abs(Math.sin(tick / 30 + i)) * 0.1);
        r.radial(cx, bandY + 1.5, half * 1.3, 8, [
          { at: 0, color: alpha(gold.light, 0.8) },
          { at: 1, color: alpha(gold.light, 0) },
        ]);
        r.pop();
      }
    }

    // Testa: muso di gatto squadrato, con le orecchie dentro il copricapo.
    r.blob(
      [
        cx - this.w * 0.26, headY - 6,
        cx + this.w * 0.26, headY - 6,
        cx + this.w * 0.3, headY + 10,
        cx + face * 4, headY + 17,
        cx - this.w * 0.3, headY + 10,
      ],
      stone.base,
    );
    r.push();
    r.setAlpha(0.8);
    r.radial(cx - 8, headY - 1, 20, 12, [
      { at: 0, color: alpha(stone.light, 0.9) },
      { at: 1, color: alpha(stone.light, 0) },
    ]);
    r.pop();
    for (const side of [-1, 1] as const) {
      r.polygon(
        [cx + side * 15, headY - 5, cx + side * 21, headY - 16, cx + side * 24, headY - 3],
        stone.dark,
      );
    }

    // Occhi: smalto turchese, gli stessi dei glifi. Da spenti diventano nero.
    const eye = hurt ? MATERIAL.onyx : MATERIAL.faience;
    for (const side of [-1, 1] as const) {
      const ex = cx + side * 9 + face * 2;
      r.ellipse(ex, headY + 2, 4.6, 3, MATERIAL.sandstone.deep);
      r.ellipse(ex, headY + 2, 3.6, 2.2, eye.base);
      r.ellipse(ex + face * 0.6, headY + 2, 1.1, 2, PALETTE.ink);
      if (!hurt) {
        r.push();
        r.setBlend('add');
        r.setAlpha(0.2 + Math.abs(Math.sin(tick / 24)) * 0.18);
        r.radial(ex, headY + 2, 13, 9, [
          { at: 0, color: alpha(eye.light, 0.7) },
          { at: 1, color: alpha(eye.light, 0) },
        ]);
        r.pop();
      }
      // Riga di kohl: parte dall'occhio e arriva alla tempia. È il dettaglio
      // che rende la faccia una faccia egizia invece che un sasso con due punti.
      r.line([ex + side * 5, headY + 1, ex + side * 11, headY - 1], 1.4, alpha(gold.dark, 0.9));
    }

    // Naso e bocca: due incisioni, niente di più. Una statua non sorride.
    r.polygon([cx - 2, headY + 8, cx + 2, headY + 8, cx, headY + 11], stone.deep);
    r.line([cx - 5, headY + 13, cx + 5, headY + 13], 1.2, alpha(stone.deep, 0.8));

    // Crepe: compaiono man mano che incassa, e restano. È l'altro contatore.
    if (this.hits > 0) {
      r.push();
      r.setAlpha(0.5);
      for (let i = 0; i < this.hits; i++) {
        const sx = cx - this.w * 0.3 + i * (this.w * 0.22);
        r.line(
          [sx, top + this.h * 0.45, sx + 5, top + this.h * 0.68, sx - 3, bottom - 6],
          1.4,
          stone.deep,
        );
      }
      r.pop();
    }

    if (this.state === 'dead') {
      r.push();
      r.setAlpha(0.5);
      r.rect(cx - this.w / 2, top, this.w, this.h, shade(0.6));
      r.pop();
    }
  }

  /**
   * La gobba: una cresta di sabbia che avanza, e nient'altro.
   *
   * È l'unica informazione che il giocatore ha per metà dello scontro, quindi
   * dev'essere leggibile da lontano e non deve mai mancare. La punta guarda
   * dove sta andando.
   */
  private drawMound(r: Renderer, tick: number): void {
    const cx = this.centerX;
    const base = this.floorY;
    const height = this.state === 'rumble' ? 13 + Math.sin(tick / 2) * 2.5 : 10;
    const half = this.w * 0.46;

    r.blob(
      [
        cx - half, base,
        cx - half * 0.5, base - height * 0.7,
        cx + this.facing * 6, base - height,
        cx + half * 0.55, base - height * 0.55,
        cx + half, base,
      ],
      MATERIAL.sand.base,
    );
    r.push();
    r.setAlpha(0.7);
    r.line(
      [cx - half * 0.8, base - height * 0.42, cx + this.facing * 4, base - height + 1],
      1.6,
      MATERIAL.sand.light,
    );
    r.pop();
    // Ombra davanti alla cresta: senza, la gobba sembra disegnata sul pavimento
    // invece che spinta da sotto.
    r.push();
    r.setAlpha(0.3);
    r.ellipse(cx + this.facing * half * 0.6, base - 1, half * 0.5, 3, PALETTE.ink);
    r.pop();

    // Quando rimbomba, la sabbia salta: è il preavviso, e dura poco.
    if (this.state !== 'rumble') return;
    r.push();
    r.setAlpha(0.6);
    for (let i = 0; i < 5; i++) {
      const jx = cx - half + ((tick * 3 + i * 23) % (half * 2));
      const jy = base - 2 - Math.abs(Math.sin(tick / 3 + i)) * 7;
      r.ellipse(jx, jy, 1.6, 1.4, glare(0.7));
    }
    r.pop();
  }
}
