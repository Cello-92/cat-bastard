import { moveX } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { FEEL, SURFACE } from '../config';
import { MATERIAL, PALETTE, alpha, glare } from '../theme';
import { DEATH_CAUSE } from '../taunts';
import { isSolid, windDirection } from '../tiles';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * Lo scarabeo.
 *
 * È l'unico nemico del gioco che **non decide niente**: vola sempre alla stessa
 * velocità nel verso in cui è girato, e la corrente d'aria se lo porta come si
 * porta il gatto, con lo stesso identico numero (`SURFACE.windSpeed`). Dentro
 * una corrente contraria arretra, dentro una a favore sfreccia, e in aria ferma
 * fa avanti e indietro come un metronomo.
 *
 * Quindi non è solo un nemico: è **il vento reso visibile**. Il mondo 3 sposta
 * il gatto nell'unico momento in cui non può correggere, e la regola 7 del
 * patto dice che ogni cosa dev'essere ricostruibile — le raffiche disegnate lo
 * dicono, ma uno scarabeo che viene ributtato indietro da una corrente lo dice
 * meglio, perché è una cosa che si vede *misurata*. Chi guarda dove vanno gli
 * scarabei sa dove lo porterà il salto prima di farlo.
 *
 * Si schiaccia, e questo è deliberato: dopo tre trappole che puniscono la
 * fiducia serve una cosa che si comporti come ci si aspetta. Ma non è mai una
 * piattaforma necessaria — nessun passaggio dipende da lui, perché il
 * risolutore non conosce le entità e non potrebbe garantirlo.
 */

const WIDTH = 22;
const HEIGHT = 16;
/** Volo proprio: molto meno del vento, così è il vento a comandare. */
const SPEED = 0.55;
/** Ampiezza dell'ondeggio verticale: è un volo, non una rotaia. */
const BOB = 3.2;

export class Scarab extends Entity {
  /** Quota di crociera: ci torna sempre, perché non ha nessun altro piano. */
  private readonly homeY: number;
  /** Fase dell'ondeggio, dedotta dalla posizione: due scarabei non sincroni. */
  private readonly phase: number;

  constructor(x: number, y: number) {
    super(x, y, WIDTH, HEIGHT);
    this.homeY = y;
    this.phase = (x * 0.07) % (Math.PI * 2);
    this.vx = SPEED;
  }

  update(world: World): void {
    // Prima il volo suo, poi la corrente: esattamente l'ordine del gatto
    // (`Player.update`), perché la cosa che questo nemico deve raccontare è
    // proprio quella — il vento non cambia quello che fai, ti sposta mentre
    // lo fai.
    const own = this.vx;
    moveX(this, world.map, isSolid);
    if (this.hitWall) {
      // Contro una parete si gira. È l'unica decisione che prende in tutta la
      // sua vita, ed è quella che prenderebbe qualunque cosa con sei zampe.
      this.vx = -own;
    }

    const gust = this.windHere(world);
    if (gust !== 0) {
      this.vx = gust * SURFACE.windSpeed;
      moveX(this, world.map, isSolid);
      this.vx = this.hitWall ? -own : own;
    }

    // L'ondeggio è una funzione del tempo, non un'accumulazione: uno scarabeo
    // spinto avanti e indietro per mezzo minuto deve restare alla sua quota.
    this.y = this.homeY + Math.sin(world.ticks / 16 + this.phase) * BOB;
  }

  /**
   * La corrente che lo investe, letta come la legge il gatto (vince l'ultima)
   * ma su una sagoma **allargata di mezza cella per lato**.
   *
   * Non è un vezzo, è una necessità: il marcatore `k` viene tolto dalla griglia
   * al caricamento, quindi lo scarabeo nasce sempre dentro una cella vuota. Con
   * la sagoma esatta quella cella è un buco d'aria ferma largo quanto lui, e la
   * bestia ci resta impigliata a oscillare sul bordo invece di farsi portare —
   * cioè fa esattamente l'unica cosa che non deve fare, visto che esiste per
   * mostrare dove va il vento.
   */
  private windHere(world: World): number {
    const reach = 8;
    const probe = { x: this.x - reach, y: this.y, w: this.w + reach * 2, h: this.h };
    let direction = 0;
    for (const { tile } of world.map.touching(probe)) {
      const gust = windDirection(tile);
      if (gust !== 0) direction = gust;
    }
    return direction;
  }

  override onStomp(world: World): boolean {
    this.expired = true;
    world.audio.play('stomp');
    world.camera.shake(FEEL.screenShakeOnStomp);
    world.effects.freeze(3);
    world.effects.burst(this.x + this.w / 2, this.y + this.h / 2, MATERIAL.faience.base, {
      count: 14,
      speed: 3.6,
      size: 4,
      gravity: 0.42,
    });
    world.effects.ring(this.x + this.w / 2, this.y + this.h / 2, PALETTE.sand, 3.2, 12);
    return true;
  }

  onTouch(world: World): void {
    world.kill(DEATH_CAUSE.scarab);
  }

  /**
   * Guscio di smalto turchese e oro, come le incisioni del tempio: è la stessa
   * mano che ha decorato le pareti, e serve a far capire che questa bestia
   * appartiene a qui. Le ali vibrano troppo in fretta per vedersi, quindi si
   * disegnano come due velature — e il verso del volo si legge dalla testa.
   */
  draw(r: Renderer, tick: number): void {
    const shell = MATERIAL.faience;
    const gold = MATERIAL.gold;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const facing = Math.sign(this.vx) || 1;

    this.drawShadow(r, 0.18);

    // Ali: due dischi sfocati dal movimento, uno per lato, in controfase.
    for (const side of [-1, 1] as const) {
      const beat = Math.abs(Math.sin(tick / 1.6 + side * 0.7)) * 0.6 + 0.7;
      r.push();
      r.setAlpha(0.3);
      r.ellipse(cx - facing * 2, cy - 5 + side * 1.5, 9 * beat, 2.6, alpha(PALETTE.steam, 0.9));
      r.pop();
    }

    // Corpo: elitre bombate, con la sutura in mezzo e il riflesso in alto a
    // sinistra come ogni altra superficie del gioco.
    r.blob(
      [
        cx - WIDTH * 0.4, cy,
        cx - WIDTH * 0.2, cy - HEIGHT * 0.42,
        cx + WIDTH * 0.26, cy - HEIGHT * 0.36,
        cx + WIDTH * 0.42, cy + 1,
        cx + WIDTH * 0.24, cy + HEIGHT * 0.4,
        cx - WIDTH * 0.24, cy + HEIGHT * 0.42,
      ],
      shell.base,
    );
    r.push();
    r.setAlpha(0.85);
    r.radial(cx - 3, cy - 3, 9, 5, [
      { at: 0, color: alpha(shell.light, 0.95) },
      { at: 1, color: alpha(shell.light, 0) },
    ]);
    r.pop();
    r.line([cx - WIDTH * 0.28, cy - 1, cx + WIDTH * 0.3, cy - 0.5], 1.1, alpha(shell.deep, 0.8));

    // Marchio d'oro sulle elitre: lo stesso smalto dei glifi sulle pareti.
    r.push();
    r.setAlpha(0.8);
    r.ellipse(cx - facing * 1, cy + 1.5, 2.6, 1.8, gold.base);
    r.ellipse(cx - facing * 1.4, cy + 1, 1.2, 0.8, gold.light);
    r.pop();

    // Testa e mandibole: guardano dove sta andando, che qui è un'informazione.
    const hx = cx + facing * (WIDTH * 0.42);
    r.ellipse(hx, cy + 1, 3.4, 3, shell.dark);
    r.ellipse(hx - facing * 0.6, cy + 0.2, 1.6, 1.3, shell.base);
    r.line([hx + facing * 2, cy - 1.5, hx + facing * 5.5, cy - 3], 1.2, gold.dark);
    r.line([hx + facing * 2, cy + 2.5, hx + facing * 5.5, cy + 4], 1.2, gold.dark);
    // Occhio: un punto solo, e basta a dare una direzione allo sguardo.
    r.ellipse(hx + facing * 0.4, cy - 0.4, 0.9, 0.9, PALETTE.ink);
    r.ellipse(hx + facing * 0.1, cy - 0.8, 0.4, 0.4, glare(0.9));

    // Zampe: tre per lato, ripiegate. Si vedono appena, ma senza sembra un sasso.
    r.push();
    r.setAlpha(0.6);
    for (let i = 0; i < 3; i++) {
      const lx = cx - WIDTH * 0.24 + i * 5;
      const kick = Math.sin(tick / 9 + i) * 1.2;
      r.line([lx, cy + HEIGHT * 0.3, lx - 2, cy + HEIGHT * 0.55 + kick], 1, shell.deep);
    }
    r.pop();
  }
}
