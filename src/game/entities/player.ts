import type { Input } from '@core/input';
import { clamp } from '@core/math';
import { applyGravity, groundTiles, moveX, moveY, updateGrounded } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import type { Body } from '@engine/types';
import { PHYSICS, SURFACE } from '../config';
import { catById, type CatSkin } from '../cats';
import { PALETTE, alpha, glare, mix, shade, type Material } from '../theme';
import { TILE, beltDirection, isIcy, isSolid } from '../tiles';
import type { World } from '../world';

/**
 * Il gatto.
 *
 * Regola non negoziabile: i controlli non tradiscono mai. Coyote time e jump
 * buffer esistono proprio per questo — il salto deve rispondere anche quando
 * il giocatore lo chiede un frame prima o un frame dopo il momento perfetto.
 *
 * Il secondo mondo aggiunge superfici che *cambiano la fisica* — ghiaccio,
 * nastri, getti di vapore — e non è una violazione del patto: rispondono
 * sempre allo stesso modo, si vedono prima di calpestarle, e il gatto fa
 * esattamente quello che gli si chiede. È il pavimento ad avere regole nuove,
 * non i comandi.
 */

const WIDTH = 22;
const HEIGHT = 28;

/**
 * Pixel percorsi per ogni falcata.
 *
 * L'animazione della corsa è guidata dalla DISTANZA, non dal tempo: le zampe
 * si muovono in proporzione alla velocità, i piedi non "pattinano" e passi e
 * polvere restano sincronizzati con quello che si vede.
 */
const STRIDE = 30;
/** Sotto questa velocità il gatto è fermo, non sta camminando piano. */
const RUN_THRESHOLD = 0.6;

export class Player implements Body {
  x = 0;
  y = 0;
  readonly w = WIDTH;
  readonly h = HEIGHT;
  vx = 0;
  vy = 0;
  onGround = false;
  hitWall = false;

  /** -1 sinistra, +1 destra. */
  facing = 1;

  /** Il manto scelto nel menu: cambia solo l'aspetto, mai la fisica. */
  skin: CatSkin = catById(undefined);

  /** Superfici sotto e attorno al gatto, campionate una volta per tick. */
  private onIce = false;
  private belt = 0;
  private inVent = false;

  private coyote = 0;
  private jumpBuffer = 0;
  private wasOnGround = false;

  /** Squash & stretch: 1 = forma a riposo. */
  private squashX = 1;
  private squashY = 1;

  /** Distanza percorsa a terra, in pixel: è l'orologio dell'animazione di corsa. */
  private runPhase = 0;
  private stepParity = 0;
  private blinkTimer = 0;

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.hitWall = false;
    this.facing = 1;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.wasOnGround = false;
    this.squashX = 1;
    this.squashY = 1;
    this.runPhase = 0;
    this.stepParity = 0;
    this.onIce = false;
    this.belt = 0;
    this.inVent = false;
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }

  get centerY(): number {
    return this.y + this.h / 2;
  }

  /** True se sta correndo davvero (serve anche al disegno). */
  get isRunning(): boolean {
    return this.onGround && Math.abs(this.vx) > RUN_THRESHOLD;
  }

  /** Sta scivolando: la corsa non risponde come dovrebbe, e si deve vedere. */
  get isSliding(): boolean {
    return this.onIce && this.onGround;
  }

  update(world: World, input: Input): void {
    // Le superfici si campionano PRIMA di muoversi: quello su cui il gatto
    // poggia adesso è quello che decide come risponderà questo tick.
    this.sampleSurface(world);

    this.handleHorizontal(input);
    moveX(this, world.map, isSolid);
    this.applyBelt(world);

    this.handleJump(world, input);
    // Il getto agisce dopo il taglio del salto e prima della gravità: se
    // agisse prima, rilasciare il tasto azzererebbe anche la spinta del vapore.
    this.applyVent();
    applyGravity(this, PHYSICS.gravity, PHYSICS.terminalVelocity);
    moveY(this, world.map, isSolid, {
      onCeiling: (c, r, tile) => world.onPlayerHeadbutt(c, r, tile),
    });

    // Lo stato "a terra" si sonda, non si deduce dalla collisione: vedi
    // engine/physics.ts. Da questa riga dipendono attrito, salto, animazione,
    // suono dei passi e polvere, quindi va aggiornato prima di tutto il resto.
    updateGrounded(this, world.map, isSolid);

    this.updateTimers();
    this.updateRunCycle(world);
    this.updateJuice(world);
  }

  // ---------------------------------------------------------------- moto
  /**
   * Cosa c'è sotto le zampe e attorno al corpo.
   *
   * Sono tre domande sole — è ghiaccio? è un nastro? sono dentro un getto? — e
   * si fanno una volta per tick, così il resto dell'update non deve più
   * interrogare la mappa e la fisica resta leggibile.
   */
  private sampleSurface(world: World): void {
    this.onIce = false;
    this.belt = 0;
    if (this.onGround) {
      for (const { tile } of groundTiles(this, world.map)) {
        if (isIcy(tile)) this.onIce = true;
        const direction = beltDirection(tile);
        if (direction !== 0) this.belt = direction;
      }
    }

    this.inVent = false;
    for (const { tile } of world.map.touching(this)) {
      // Il getto spento è identico a questo, e non compare qui: è tutta la
      // trappola. Vedi TILE.DEAD_VENT.
      if (tile === TILE.VENT) {
        this.inVent = true;
        break;
      }
    }
  }

  private handleHorizontal(input: Input): void {
    const left = input.isDown('left');
    const right = input.isDown('right');
    // Sul ghiaccio gli artigli non mordono: si accelera piano e non si frena.
    const push = this.onIce ? SURFACE.iceAcceleration : PHYSICS.acceleration;

    if (left) {
      this.vx -= push;
      this.facing = -1;
    }
    if (right) {
      this.vx += push;
      this.facing = 1;
    }
    if (left === right) {
      this.vx *= this.onGround
        ? this.onIce
          ? SURFACE.iceFriction
          : PHYSICS.groundFriction
        : PHYSICS.airFriction;
    }

    this.vx = clamp(this.vx, -PHYSICS.maxSpeed, PHYSICS.maxSpeed);
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
  }

  /**
   * Il nastro trasportatore trascina, non accelera: sposta il corpo di una
   * quantità fissa e restituisce al gatto la sua velocità intatta. È la
   * differenza tra "stare su un nastro" e "avere i comandi alterati".
   */
  private applyBelt(world: World): void {
    if (this.belt === 0) return;
    const own = this.vx;
    this.vx = this.belt * SURFACE.beltSpeed;
    moveX(this, world.map, isSolid);
    this.vx = own;
  }

  /** Getto di vapore: solleva finché ci resti dentro, e non si può dosare. */
  private applyVent(): void {
    if (!this.inVent) return;
    const lifted = Math.max(this.vy - SURFACE.ventLift, -SURFACE.ventMaxRise);
    // Non rallenta mai chi sale già più forte (una molla, per dire).
    this.vy = Math.min(this.vy, lifted);
  }

  private handleJump(world: World, input: Input): void {
    if (input.justPressed('jump')) this.jumpBuffer = PHYSICS.jumpBufferTicks;

    const canJump = this.onGround || this.coyote > 0;
    if (this.jumpBuffer > 0 && canJump) {
      this.vy = -PHYSICS.jumpImpulse;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squashX = 0.76;
      this.squashY = 1.3;
      world.audio.play('jump');
      world.effects.footstepDust(this.centerX, this.y + this.h, PALETTE.dust, this.facing);
    }

    // Salto ad altezza variabile: rilasciare taglia la salita.
    if (!input.isDown('jump') && this.vy < 0) this.vy *= PHYSICS.jumpCut;
  }

  private updateTimers(): void {
    if (this.onGround) this.coyote = PHYSICS.coyoteTicks;
    else if (this.coyote > 0) this.coyote--;
    if (this.jumpBuffer > 0) this.jumpBuffer--;
    if (this.blinkTimer > 0) this.blinkTimer--;
    else if (Math.random() < 0.008) this.blinkTimer = 8;
  }

  /**
   * Avanza il ciclo di corsa e fa scattare un passo ogni `STRIDE` pixel.
   * Passo = un suono + uno sbuffo di polvere, sotto il piede che tocca terra.
   */
  private updateRunCycle(world: World): void {
    if (!this.isRunning) return;

    const previousStep = Math.floor(this.runPhase / STRIDE);
    this.runPhase += Math.abs(this.vx);
    if (Math.floor(this.runPhase / STRIDE) === previousStep) return;

    this.stepParity ^= 1;
    world.audio.play(this.stepParity ? 'step' : 'stepAlt');
    world.effects.footstepDust(
      this.centerX - this.facing * 6,
      this.y + this.h,
      PALETTE.dust,
      this.facing,
    );
  }

  /** Deformazioni e polvere all'atterraggio: puro feedback visivo. */
  private updateJuice(world: World): void {
    if (this.onGround && !this.wasOnGround) {
      const impact = clamp(Math.abs(this.vy) + 6, 6, 16) / 16;
      this.squashX = 1 + 0.34 * impact;
      this.squashY = 1 - 0.3 * impact;
      world.effects.landingDust(this.centerX, this.y + this.h, PALETTE.dust, impact);
      world.audio.play('land');
    }
    this.wasOnGround = this.onGround;

    // Ritorno elastico alla forma normale.
    this.squashX += (1 - this.squashX) * 0.22;
    this.squashY += (1 - this.squashY) * 0.22;

    // Stretch in caduta libera: allunga il gatto, si legge meglio in aria.
    if (!this.onGround) {
      const airStretch = clamp(this.vy / 22, -0.18, 0.2);
      this.squashY += airStretch * 0.35;
      this.squashX -= airStretch * 0.25;
    }
  }

  // ---------------------------------------------------------------- disegno
  /**
   * Il gatto è costruito a strati, dal fondo verso l'osservatore: ombra di
   * contatto, coda, zampe posteriori, corpo, zampe anteriori, testa.
   * L'ordine non è un dettaglio — è quello che dà la profondità alla figura.
   *
   * L'illuminazione segue la regola del mondo: luce dall'alto a sinistra,
   * ventre in ombra, e un filo di luce di contorno sul lato illuminato che
   * stacca il gatto da qualunque fondale si trovi dietro.
   */
  draw(r: Renderer, tick: number): void {
    const cx = Math.round(this.centerX);
    const feet = Math.round(this.y + this.h);
    const running = this.isRunning;
    const speed = Math.abs(this.vx) / PHYSICS.maxSpeed;

    // Fase del ciclo: mezzo giro per falcata, così le due zampe si alternano.
    const cycle = (this.runPhase / STRIDE) * Math.PI;
    const swing = running ? Math.sin(cycle) : 0;
    // Il corpo rimbalza due volte per falcata, in controfase con le zampe.
    const bodyBob = running ? -Math.abs(Math.cos(cycle)) * 1.6 * speed : 0;

    this.drawContactShadow(r, cx, feet);

    r.push();
    // Squash & stretch attorno ai piedi, così il gatto non "galleggia".
    r.translate(cx, feet);
    r.scale(this.squashX, this.squashY);
    r.translate(-cx, -feet);

    const face = this.facing;
    const top = feet - this.h + bodyBob;
    // La testa sta nel terzo superiore, il tronco occupa il resto: sotto le
    // zampe restano visibili. Un gatto tutto testa sembra un peluche.
    const bodyY = top + 10;
    const bodyH = feet - bodyY - 5;

    // Il manto decide solo *quali* materiali usare: la logica di luce, gli
    // strati e le proporzioni restano identiche per tutti i gatti.
    const leg = this.skin.pattern === 'points' ? this.skin.marks : this.skin.fur;
    const paw =
      this.skin.pattern === 'tux' || this.skin.pattern === 'patched' ? this.skin.marks : leg;

    this.drawTail(r, cx, bodyY, face, tick, running);
    // Zampe posteriori: più scure, stanno dietro al corpo.
    drawLeg(r, cx - face * 7, feet, Math.max(0, -swing) * 3, 0.55, leg, paw);
    drawLeg(r, cx + face * 2, feet, Math.max(0, swing) * 3, 0.55, leg, paw);

    this.drawBody(r, cx, bodyY, bodyH, face);

    // Zampe anteriori: in piena luce, davanti a tutto il corpo.
    drawLeg(r, cx + face * 6, feet, Math.max(0, swing) * 3.2, 1, leg, paw);
    drawLeg(r, cx - face * 2, feet, Math.max(0, -swing) * 3.2, 1, leg, paw);

    this.drawHead(r, cx + face * 3, top + 7.5, face, tick);
    r.pop();

    // Sul ghiaccio le zampe non mordono: sotto i piedi resta una striscia
    // lucida e qualche scaglia. Serve a far vedere *perché* non sta frenando,
    // che è l'unica cosa che il giocatore deve capire di questa superficie.
    if (this.isSliding && Math.abs(this.vx) > 1.4) {
      const back = -Math.sign(this.vx);
      r.push();
      r.setAlpha(0.35);
      r.radial(cx + back * 10, feet - 1, 14, 2.4, [
        { at: 0, color: alpha(PALETTE.ice, 0.9) },
        { at: 1, color: alpha(PALETTE.ice, 0) },
      ]);
      r.setAlpha(0.5);
      for (let i = 0; i < 3; i++) {
        const shard = ((tick * 2 + i * 9) % 14) + 2;
        r.ellipse(cx + back * (6 + shard), feet - 2 - (shard % 5), 1.2, 1, PALETTE.ice);
      }
      r.pop();
    }

    // Scia d'aria alle spalle quando è lanciato: due strappi di luce, non una
    // riga continua — si legge come velocità, non come un errore di disegno.
    if (running && speed > 0.85) {
      r.push();
      r.setBlend('add');
      r.setAlpha(0.12 + Math.abs(swing) * 0.12);
      const backX = cx - face * (this.w / 2 + 4);
      for (let i = 0; i < 3; i++) {
        const len = 9 + i * 4;
        const y = feet - 8 - i * 7;
        r.radial(backX - face * len * 0.5, y, len, 1.6, [
          { at: 0, color: glare(0.8) },
          { at: 1, color: glare(0) },
        ]);
      }
      r.pop();
    }
  }

  /** Ombra di contatto: si stringe e si schiarisce man mano che sali. */
  private drawContactShadow(r: Renderer, cx: number, feet: number): void {
    const tight = this.onGround ? 1 : 0.62;
    r.push();
    r.setAlpha(this.onGround ? 0.34 : 0.16);
    r.radial(cx, feet + 1.5, this.w * 0.62 * tight, 4.5 * tight, [
      { at: 0, color: shade(0.85) },
      { at: 0.55, color: shade(0.4) },
      { at: 1, color: shade(0) },
    ]);
    r.pop();
  }

  /** Tronco: massa ovale, ventre in ombra, dorso in luce, pelo corto. */
  private drawBody(r: Renderer, cx: number, y: number, h: number, face: number): void {
    const fur = this.skin.fur;
    const halfW = this.w / 2;
    const midY = y + h * 0.45;

    // Sagoma: spalle più alte della groppa, come un gatto che cammina.
    r.blob(
      [
        cx - halfW + 1, midY - h * 0.28,
        cx - halfW * 0.2, y - 1,
        cx + halfW * 0.7, y + 1,
        cx + halfW - 0.5, midY,
        cx + halfW * 0.75, y + h - 1,
        cx - halfW * 0.6, y + h - 1,
        cx - halfW + 0.5, midY + h * 0.2,
      ],
      fur.base,
    );

    // Dorso in luce: la sorgente sta in alto a sinistra.
    r.push();
    r.setAlpha(0.85);
    r.radial(cx - halfW * 0.35, y + h * 0.18, halfW * 1.05, h * 0.42, [
      { at: 0, color: alpha(fur.light, 0.95) },
      { at: 1, color: alpha(fur.light, 0) },
    ]);
    r.pop();

    // Ventre in ombra: occlusione tra le zampe.
    r.push();
    r.setAlpha(0.6);
    r.radial(cx + halfW * 0.15, y + h * 0.95, halfW * 0.95, h * 0.4, [
      { at: 0, color: alpha(fur.dark, 0.8) },
      { at: 1, color: alpha(fur.dark, 0) },
    ]);
    r.pop();

    // Pelo: pochi tratti corti nel verso del manto, solo dove la luce radente
    // li rivelerebbe davvero.
    r.push();
    r.setAlpha(0.16);
    for (let i = 0; i < 4; i++) {
      const fy = y + 3 + i * (h / 5);
      r.line([cx - halfW * 0.5, fy, cx + halfW * 0.2, fy + 1.5], 0.8, fur.dark);
    }
    r.pop();

    this.drawMarkings(r, cx, y, h, face);

    // Luce di contorno sul lato illuminato: separa il gatto dal fondale.
    r.push();
    r.setAlpha(0.5);
    r.line(
      [
        cx - halfW * 0.1, y - 0.5,
        cx - halfW * 0.75, y + h * 0.22,
        cx - halfW * 0.95, y + h * 0.6,
      ],
      1.2,
      glare(0.9),
    );
    r.pop();

    // Ombra proiettata dalla testa sulle spalle.
    r.push();
    r.setAlpha(0.18);
    r.radial(cx + face * 2, y + 2, halfW * 0.8, 3, [
      { at: 0, color: shade(0.9) },
      { at: 1, color: shade(0) },
    ]);
    r.pop();
  }

  /**
   * Marcature del manto: strisce, pettorina, punte.
   *
   * Vengono disegnate DOPO le luci del corpo e prima del contorno, così
   * ricevono la stessa illuminazione della pelliccia sotto invece di sembrare
   * un adesivo appiccicato sopra.
   */
  private drawMarkings(r: Renderer, cx: number, y: number, h: number, face: number): void {
    const halfW = this.w / 2;
    const marks = this.skin.marks;

    if (this.skin.pattern === 'tabby') {
      // Strisce sulla groppa: si stringono verso la coda, come quelle vere.
      r.push();
      r.setAlpha(0.55);
      for (let i = 0; i < 4; i++) {
        const sy = y + 2 + i * (h / 5.5);
        const width = halfW * (0.9 - i * 0.12);
        r.line(
          [cx - face * width, sy + 2.5, cx - face * width * 0.2, sy, cx + face * width * 0.35, sy + 1.5],
          2.2,
          marks.base,
        );
      }
      r.pop();
      return;
    }

    if (this.skin.pattern === 'tux') {
      // Pettorina: una macchia bianca sul davanti, con la punta verso il muso.
      r.push();
      r.setAlpha(0.95);
      r.blob(
        [
          cx + face * halfW * 0.62, y + h * 0.18,
          cx + face * halfW * 0.78, y + h * 0.55,
          cx + face * halfW * 0.45, y + h * 0.95,
          cx + face * halfW * 0.02, y + h * 0.7,
          cx + face * halfW * 0.2, y + h * 0.28,
        ],
        marks.base,
      );
      r.setAlpha(0.45);
      r.radial(cx + face * halfW * 0.4, y + h * 0.4, halfW * 0.5, h * 0.3, [
        { at: 0, color: alpha(marks.light, 0.9) },
        { at: 1, color: alpha(marks.light, 0) },
      ]);
      r.pop();
      return;
    }

    if (this.skin.pattern === 'points') {
      // Il siamese non ha macchie sul tronco: sfuma verso le estremità.
      r.push();
      r.setAlpha(0.32);
      r.radial(cx - face * halfW * 0.7, y + h * 0.75, halfW * 0.8, h * 0.5, [
        { at: 0, color: alpha(marks.base, 0.8) },
        { at: 1, color: alpha(marks.base, 0) },
      ]);
      r.pop();
      return;
    }

    if (this.skin.pattern === 'patched') {
      // Due chiazze irregolari, una sulla groppa e una sul fianco. Le forme
      // sono scritte a mano e non generate: un gatto pezzato che cambia
      // chiazze a ogni frame non è un gatto, è rumore.
      r.push();
      r.setAlpha(0.92);
      r.blob(
        [
          cx - face * halfW * 0.85, y + h * 0.1,
          cx - face * halfW * 0.15, y + h * 0.02,
          cx + face * halfW * 0.1, y + h * 0.42,
          cx - face * halfW * 0.5, y + h * 0.52,
          cx - face * halfW * 0.95, y + h * 0.34,
        ],
        marks.base,
      );
      r.blob(
        [
          cx + face * halfW * 0.3, y + h * 0.6,
          cx + face * halfW * 0.72, y + h * 0.72,
          cx + face * halfW * 0.5, y + h * 0.99,
          cx + face * halfW * 0.05, y + h * 0.88,
        ],
        marks.base,
      );
      // La luce cade sulle chiazze come su tutto il resto: viene da sopra a
      // sinistra, quindi il bordo alto è più chiaro.
      r.setAlpha(0.4);
      r.line(
        [
          cx - face * halfW * 0.85, y + h * 0.1,
          cx - face * halfW * 0.15, y + h * 0.02,
          cx + face * halfW * 0.1, y + h * 0.42,
        ],
        1.2,
        marks.light,
      );
      r.pop();
      return;
    }

    if (this.skin.pattern === 'spotted') {
      // Rosette sparse, in tre file. Le posizioni derivano dall'indice, non da
      // un caso: lo stesso gatto ha sempre le stesse macchie.
      r.push();
      r.setAlpha(0.6);
      for (let i = 0; i < 7; i++) {
        const row = i % 3;
        const sx = cx + face * halfW * (0.72 - ((i * 5) % 9) * 0.19);
        const sy = y + h * (0.16 + row * 0.27) + ((i % 2) * h) / 22;
        r.ellipse(sx, sy, 2.1, 1.5, marks.base);
        r.ellipse(sx - face * 0.5, sy - 0.5, 1.1, 0.8, marks.dark);
      }
      r.pop();
    }
  }

  /** Testa: cranio, orecchie con padiglione, occhi, muso, baffi. */
  private drawHead(r: Renderer, cx: number, cy: number, face: number, tick: number): void {
    const fur = this.skin.pattern === 'points' ? this.skin.marks : this.skin.fur;
    const skin = this.skin.nose;
    const eye = this.skin.eye;
    const rx = 7.6;
    const ry = 6.8;

    // Orecchie: padiglione rosa dentro, pelo fuori, punta appena piegata.
    for (const side of [-1, 1] as const) {
      const ex = cx + side * 4.8;
      const tipX = ex + side * 2.6;
      const tipY = cy - ry - 4.6;
      r.polygon([ex - 2.9, cy - ry + 2, tipX, tipY, ex + 3, cy - ry + 1.2], fur.base);
      r.polygon([ex - 1.4, cy - ry + 1.3, tipX - side * 0.3, tipY + 2.2, ex + 1.6, cy - ry + 0.8], skin.dark);
      r.polygon([ex - 0.9, cy - ry + 1, tipX - side * 0.5, tipY + 2.8, ex + 1, cy - ry + 0.6], skin.base);
      // L'orecchio rivolto alla luce riceve un bordo chiaro.
      if (side < 0) r.line([ex - 2.7, cy - ry + 1.8, tipX, tipY], 0.9, alpha(fur.light, 0.9));
    }

    // Cranio.
    r.ellipse(cx, cy, rx, ry, fur.base);
    r.push();
    r.setAlpha(0.9);
    r.radial(cx - 2.4, cy - 2.4, rx * 0.85, ry * 0.85, [
      { at: 0, color: alpha(fur.light, 1) },
      { at: 1, color: alpha(fur.light, 0) },
    ]);
    r.pop();
    r.push();
    r.setAlpha(0.45);
    r.radial(cx + 2, cy + 3.2, rx * 0.8, ry * 0.55, [
      { at: 0, color: alpha(fur.dark, 0.9) },
      { at: 1, color: alpha(fur.dark, 0) },
    ]);
    r.pop();

    // La "M" del soriano in mezzo alla fronte: piccola, ma è la firma del manto.
    if (this.skin.pattern === 'tabby') {
      r.push();
      r.setAlpha(0.5);
      for (const side of [-1, 1] as const) {
        r.line([cx + side * 1.4, cy - ry + 1, cx + side * 2.6, cy - ry + 4.4], 1.1, this.skin.marks.base);
      }
      r.pop();
    }

    // Occhi: bulbo scuro, iride, pupilla verticale, riflesso.
    const eyeY = cy - 0.4;
    for (const side of [-1, 1] as const) {
      const ex = cx + side * 3.2 + face * 0.6;
      if (this.blinkTimer > 0) {
        r.line([ex - 2, eyeY, ex + 2, eyeY], 1.2, fur.deep);
        continue;
      }
      r.ellipse(ex, eyeY, 2.3, 2.5, eye.deep);
      r.ellipse(ex, eyeY, 1.9, 2.1, eye.base);
      r.ellipse(ex, eyeY - 0.3, 1.5, 1.5, eye.light);
      // Pupilla a fessura: è ciò che rende inequivocabile che è un gatto.
      r.ellipse(ex + face * 0.25, eyeY, 0.6, 1.8, '#0a0d0a');
      r.ellipse(ex - 0.7, eyeY - 0.9, 0.6, 0.5, glare(0.95));
    }

    // Muso: zona più chiara, naso, bocca.
    const muzzleY = cy + 3.2;
    r.push();
    r.setAlpha(0.6);
    r.ellipse(cx + face * 0.6, muzzleY + 0.5, 3.8, 2.5, alpha(fur.light, 0.9));
    r.pop();
    const noseX = cx + face * 0.6;
    r.polygon([noseX - 1.2, muzzleY, noseX + 1.2, muzzleY, noseX, muzzleY + 1.3], skin.dark);
    r.line([noseX, muzzleY + 1.3, noseX, muzzleY + 2], 0.7, alpha(fur.deep, 0.8));
    r.push();
    r.setAlpha(0.75);
    r.line([noseX - 1.9, muzzleY + 2.7, noseX, muzzleY + 2], 0.7, fur.deep);
    r.line([noseX + 1.9, muzzleY + 2.7, noseX, muzzleY + 2], 0.7, fur.deep);
    r.pop();

    // Baffi: si muovono appena, sempre allo stesso ritmo.
    const twitch = Math.sin(tick / 26) * 0.6;
    r.push();
    r.setAlpha(0.55);
    for (const side of [-1, 1] as const) {
      const wx = cx + side * 3;
      for (let i = 0; i < 3; i++) {
        const wy = muzzleY + 0.2 + i * 1.2;
        r.line([wx, wy, wx + side * (6 + i), wy - 1.6 + i * 1.2 + twitch], 0.6, glare(0.7));
      }
    }
    r.pop();
  }

  /**
   * Coda: quattro segmenti che si inseguono con un ritardo crescente, così la
   * punta arriva sempre dopo la base. Sferza più veloce quando corre.
   */
  private drawTail(r: Renderer, cx: number, bodyY: number, face: number, tick: number, running: boolean): void {
    const fur = this.skin.pattern === 'points' ? this.skin.marks : this.skin.fur;
    const rate = running ? 5 : 11;
    const amplitude = running ? 4.2 : 2.8;
    const rootX = cx - face * (this.w / 2 - 3);
    const rootY = bodyY + 7;

    // La coda parte bassa dietro la groppa, poi si alza: è la curva a S che
    // rende riconoscibile la sagoma di un gatto anche in silhouette.
    // I segmenti si accorciano in orizzontale e crescono in verticale: la coda
    // esce indietro, poi risale e si ripiega. È la curva a S del gatto vero.
    const reach = [3, 5.4, 6.8, 6.4];
    const rise = [-0.5, 2.6, 7, 11.5];
    const points: number[] = [rootX, rootY];
    for (let i = 0; i < 4; i++) {
      const wag = Math.sin(tick / rate - i * 0.7) * amplitude * ((i + 1) / 4);
      points.push(rootX - face * (reach[i] ?? 0), rootY - (rise[i] ?? 0) + wag);
    }

    // Tre passate sempre più strette: la coda si assottiglia verso la punta.
    r.line(points, 3.2, fur.dark);
    r.line(points, 2.2, fur.base);
    r.push();
    r.setAlpha(0.55);
    r.line(points.slice(0, 6), 1, fur.light);
    r.pop();

    // Anelli sulla coda: li ha solo il soriano, e sono la prima cosa che si
    // vede quando il gatto scappa verso destra.
    if (this.skin.pattern === 'tabby') {
      r.push();
      r.setAlpha(0.6);
      for (let i = 1; i < 4; i++) {
        const px = points[i * 2] ?? rootX;
        const py = points[i * 2 + 1] ?? rootY;
        r.ellipse(px, py, 1.9, 1.6, this.skin.marks.base);
      }
      r.pop();
    }

    r.ellipse(points[8] ?? rootX, points[9] ?? rootY, 1.6, 1.5, fur.light);
  }
}

/**
 * Una zampa: `lift` la stacca da terra durante la falcata, `exposure` dice
 * quanta luce le arriva (le posteriori sono in ombra dietro al corpo).
 * `fur` e `paw` arrivano dal manto scelto: certi gatti hanno le zampe di un
 * colore e i cuscinetti di un altro.
 */
function drawLeg(
  r: Renderer,
  x: number,
  feet: number,
  lift: number,
  exposure: number,
  fur: Material,
  paw: Material,
): void {
  const height = 7 - lift;
  if (height <= 0.5) return;

  const body = exposure < 1 ? mix(fur.base, fur.dark, 0.55) : fur.base;
  const top = feet - height;

  // Gamba.
  r.line([x, top, x, feet - 1.6], 4.4, body);
  // Zampa: una piccola ellisse schiacciata, con l'ombra sotto.
  r.ellipse(x, feet - 1.4, 3.2, 1.9, exposure < 1 ? mix(paw.base, paw.dark, 0.4) : paw.light);
  r.push();
  r.setAlpha(0.35 * exposure);
  r.line([x - 1.6, top + 1, x - 1.6, feet - 2.4], 1, alpha(fur.light, 0.9));
  r.pop();
  r.push();
  r.setAlpha(0.3);
  r.ellipse(x, feet - 0.4, 3, 1, PALETTE.ink);
  r.pop();
}
