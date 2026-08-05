import type { Renderer } from '@engine/render/renderer';
import type { CatSkin } from '../cats';
import { Player } from '../entities/player';
import { MATERIAL, PALETTE, alpha, glare } from '../theme';

/**
 * Il ritratto di un gatto, per la collezione.
 *
 * Disegna il gatto **col codice del gioco**, non con un'illustrazione a parte:
 * è lo stesso `Player.draw` che gira sessanta volte al secondo mentre si muore.
 * Costa una riga in più qui e toglie l'unico modo che una galleria ha di
 * mentire — mostrare un gatto più bello di quello che poi ti ritrovi.
 *
 * Il `Player` di servizio è uno solo e sta fermo: non viene mai aggiornato, gli
 * si cambia solo il manto. Non è nel mondo, non ha una fisica da far girare, e
 * `draw` non ha mai avuto bisogno del mondo per disegnare (vedi `player.ts`).
 */

/** Il modello. Costruito alla prima anteprima e poi riusato: è arredamento. */
let model: Player | undefined;

/**
 * Il manto di un gatto ancora chiuso.
 *
 * Non si nasconde il gatto: si nasconde *di che colore è*. La sagoma si vede
 * tutta — orecchie, coda, posa — perché la ricompensa promessa deve essere
 * leggibile, e quello che manca è esattamente la cosa che si guadagna.
 */
const LOCKED: CatSkin = {
  id: '?',
  name: '?',
  blurb: '',
  yarn: 0,
  fur: MATERIAL.soot,
  marks: MATERIAL.soot,
  eye: MATERIAL.soot,
  nose: MATERIAL.soot,
  pattern: 'plain',
};

export interface CatPortraitOptions {
  /** Il gatto è ancora da sbloccare: si vede la sagoma e basta. */
  locked?: boolean;
  /** Il gatto attualmente indossato: si prende il piedistallo acceso. */
  current?: boolean;
}

export function drawCatPortrait(
  r: Renderer,
  skin: CatSkin,
  tick: number,
  options: CatPortraitOptions = {},
): void {
  const { locked = false, current = false } = options;
  const cx = r.width / 2;
  const floor = r.height * 0.78;

  r.clear(PALETTE.ink);

  // Fondale: un alone che stacca la figura dal nero. Acceso per il gatto in
  // uso, spento per gli altri — è l'unico modo che ha la galleria di dire
  // "questo è quello che indossi" senza scriverlo una seconda volta.
  r.push();
  r.setBlend('add');
  r.setAlpha(current ? 0.3 : 0.14);
  r.radial(cx, floor - r.height * 0.2, r.width * 0.46, r.height * 0.4, [
    { at: 0, color: alpha(current ? PALETTE.hot : PALETTE.stone, 0.85) },
    { at: 1, color: alpha(current ? PALETTE.hot : PALETTE.stone, 0) },
  ]);
  r.pop();

  // Il piedistallo: un'ellisse di luce sotto le zampe. Senza, il gatto
  // galleggia — è lo stesso problema che l'ombra di contatto risolve in gioco.
  r.push();
  r.setAlpha(0.5);
  r.radial(cx, floor + 2, r.width * 0.3, 7, [
    { at: 0, color: alpha(current ? PALETTE.hot : PALETTE.stone, 0.55) },
    { at: 1, color: alpha(PALETTE.ink, 0) },
  ]);
  r.pop();

  // Il gatto, ingrandito attorno ai piedi: la posa e le proporzioni restano
  // quelle vere, cambia solo quanto è grande.
  const cat = (model ??= new Player());
  cat.skin = locked ? LOCKED : skin;
  cat.facing = 1;
  cat.reset(cx - cat.w / 2, floor - cat.h);

  const zoom = Math.min(r.width / 46, r.height / 46);
  r.push();
  r.translate(cx, floor);
  r.scale(zoom, zoom);
  r.translate(-cx, -floor);
  // Un respiro lentissimo: il ritratto è fermo, non morto.
  r.translate(0, Math.sin(tick / 42) * 0.5);
  cat.draw(r, tick);
  r.pop();

  if (locked) {
    // Il punto interrogativo sta *davanti* alla sagoma e non al posto suo: il
    // gatto c'è, si sa già che forma ha, non si sa ancora chi è.
    r.push();
    r.setAlpha(0.85);
    r.text('?', cx, floor - r.height * 0.26, {
      color: glare(0.7),
      size: Math.round(r.height * 0.28),
      align: 'center',
      weight: 'bold',
    });
    r.pop();
  }
}
