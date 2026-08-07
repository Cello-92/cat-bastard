import type { Renderer } from '@engine/render/renderer';
import { MATERIAL, PALETTE, alpha, glare, shade } from '../theme';
import { DEATH_CAUSE } from '../taunts';
import type { World } from '../world';
import { Entity } from './entity';

/**
 * Il pendolo.
 *
 * È l'unico congegno del gioco che si muove da solo senza che nessuno lo abbia
 * toccato, e sta nel quarto mondo per una ragione precisa: un pendolo **è** la
 * gravità, disegnata. Oscilla sempre uguale, con lo stesso periodo e la stessa
 * ampiezza, e riparte esattamente dallo stesso punto a ogni rinascita — il
 * cronometro è suo e nasce a zero quando nasce lui, non è l'orologio del
 * livello. Quella differenza è tutto il patto: dopo la morte il mondo viene
 * ricostruito, quindi un pendolo agganciato ai tick del livello sarebbe a una
 * fase diversa a ogni tentativo, e imparare il livello a memoria non
 * servirebbe più a niente.
 *
 * Il verso in cui pende lo decide il **campo sotto il perno**: dentro un campo
 * rovescio oscilla verso l'alto. È la cosa che convince, più di qualunque
 * scritta, che qui il basso è davvero un'altra cosa.
 */

const SIZE = 22;
/** Lunghezza della corda, in pixel: poco più di tre celle. */
const LENGTH = 104;
/** Ampiezza massima, in radianti: poco meno di mezzo quadrante. */
const SWING = 1.02;
/** Tick per mezzo giro: un'oscillazione completa dura poco più di due secondi. */
const PERIOD = 42;

export class Pendulum extends Entity {
  private readonly pivotX: number;
  private readonly pivotY: number;
  /**
   * Fase iniziale, dedotta dalla posizione del perno.
   *
   * Due pendoli vicini non devono oscillare all'unisono, o diventano un muro
   * invece che due ostacoli. E siccome viene dalla posizione, resta identica a
   * ogni caricamento: è la stessa regola delle texture dei tile.
   */
  private readonly phase: number;
  /** Cronometro suo. Vedi il commento in testa: è la ragione per cui esiste. */
  private age = 0;
  /** Verso in cui pende: +1 in giù, -1 in su. */
  private down = 1;

  constructor(pivotX: number, pivotY: number) {
    super(pivotX - SIZE / 2, pivotY + LENGTH - SIZE / 2, SIZE, SIZE);
    this.pivotX = pivotX;
    this.pivotY = pivotY;
    this.phase = (pivotX * 0.031 + pivotY * 0.017) % (Math.PI * 2);
  }

  update(world: World): void {
    this.age++;

    // Il campo si campiona **al perno**, non alla sfera: è il perno a essere
    // fissato al mondo, e una corda non cambia idea a metà oscillazione. La
    // sagoma copre una cella sopra e una sotto perché il marcatore `t` viene
    // tolto dalla griglia al caricamento — vale la stessa avvertenza della
    // zavorra e dello scarabeo: chiedendo solo la propria cella, un perno
    // dentro una colonna capovolta si crederebbe diritto.
    this.down = world.gravityAt({
      x: this.pivotX - 10,
      y: this.pivotY - 24,
      w: 20,
      h: 48,
    });

    const angle = Math.sin(this.age / PERIOD + this.phase) * SWING;
    this.x = this.pivotX + Math.sin(angle) * LENGTH - SIZE / 2;
    this.y = this.pivotY + this.down * Math.cos(angle) * LENGTH - SIZE / 2;
  }

  /** Una palla di ferro non si schiaccia: si prende in faccia e basta. */
  override onStomp(world: World): boolean {
    world.kill(DEATH_CAUSE.pendulum);
    return false;
  }

  onTouch(world: World): void {
    world.kill(DEATH_CAUSE.pendulum);
  }

  /**
   * Perno d'ottone, corda a maglie, sfera di piombo. La corda si disegna per
   * intero dal perno alla sfera perché è quella a raccontare l'oscillazione:
   * una palla che va avanti e indietro senza niente sopra sembra un nemico
   * volante, e questo invece è un oggetto appeso.
   */
  draw(r: Renderer, tick: number): void {
    const brass = MATERIAL.brass;
    const lead = MATERIAL.lead;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;

    // Corda: maglie disegnate lungo il segmento, così si vede la lunghezza.
    const links = 9;
    for (let i = 1; i <= links; i++) {
      const t = i / (links + 1);
      const lx = this.pivotX + (cx - this.pivotX) * t;
      const ly = this.pivotY + (cy - this.pivotY) * t;
      r.ellipse(lx, ly, 2.2, 1.5, i % 2 ? brass.dark : brass.base);
      r.ellipse(lx - 0.6, ly - 0.5, 0.9, 0.6, alpha(brass.light, 0.7));
    }

    // Perno: una piastra imbullonata al soffitto (o al pavimento, se il campo
    // qui è rovescio). Il perno non si sposta mai: è l'unico punto fermo.
    r.ellipse(this.pivotX, this.pivotY, 5.4, 5.4, brass.dark);
    r.ellipse(this.pivotX, this.pivotY, 3.8, 3.8, brass.base);
    r.ellipse(this.pivotX - 1.2, this.pivotY - 1.2, 1.6, 1.4, brass.light);

    // Sfera: piombo, con un solo riflesso stretto in alto a sinistra — la luce
    // del mondo viene da lì e non si capovolge con la gravità.
    r.push();
    r.setAlpha(0.28);
    r.ellipse(cx + 2, cy + 2, SIZE * 0.5, SIZE * 0.5, shade(1));
    r.pop();
    r.ellipse(cx, cy, SIZE * 0.5, SIZE * 0.5, lead.base);
    r.push();
    r.setAlpha(0.85);
    r.radial(cx - 3, cy - 3.5, 8, 7, [
      { at: 0, color: alpha(lead.light, 0.95) },
      { at: 1, color: alpha(lead.light, 0) },
    ]);
    r.pop();
    r.ellipse(cx - 3.4, cy - 4, 1.9, 1.5, glare(0.75));

    // Fascia equatoriale e ganci: dicono che è un oggetto costruito.
    r.push();
    r.setAlpha(0.6);
    r.line([cx - SIZE * 0.48, cy + 1, cx + SIZE * 0.48, cy + 1], 1.6, MATERIAL.iron.dark);
    r.pop();

    // Scia: due strappi di luce dalla parte da cui arriva, e solo quando corre
    // davvero. È l'unica cosa che dice quanto sta andando forte adesso.
    const speed = Math.abs(Math.cos(this.age / PERIOD + this.phase));
    if (speed > 0.6) {
      const back = -Math.sign(Math.cos(this.age / PERIOD + this.phase)) || 1;
      r.push();
      r.setBlend('add');
      r.setAlpha(0.08 + speed * 0.1);
      for (let i = 1; i <= 2; i++) {
        r.radial(cx + back * i * 9, cy, 8, 7, [
          { at: 0, color: alpha(PALETTE.shard, 0.5) },
          { at: 1, color: alpha(PALETTE.shard, 0) },
        ]);
      }
      r.pop();
    }

    // Un punto di brace nella fessura della sfera: la sola cosa viva del
    // congegno, e pulsa piano perché sennò non si nota che è un pendolo acceso.
    r.push();
    r.setBlend('add');
    r.setAlpha(0.2 + Math.abs(Math.sin(tick / 26)) * 0.15);
    r.radial(cx, cy + 1, 9, 4, [
      { at: 0, color: alpha(PALETTE.field, 0.7) },
      { at: 1, color: alpha(PALETTE.field, 0) },
    ]);
    r.pop();
  }
}
