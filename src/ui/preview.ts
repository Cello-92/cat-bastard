import { Canvas2DRenderer } from '@engine/render/canvas2d';
import type { Renderer } from '@engine/render/renderer';

/**
 * Il riquadro d'anteprima accanto alle voci del menu.
 *
 * Non sa cosa ci sia dentro. Possiede il canvas, il backend e l'orologio, e
 * chiama il disegno che gli è stato dato: se un giorno servisse l'anteprima di
 * un livello invece che di un gatto, questo file non cambia di una riga.
 *
 * Perché un canvas e non un'immagine: il gioco non ha nemmeno un asset binario
 * (vedi CLAUDE.md), quindi l'unico modo di far vedere un gatto è disegnarlo —
 * e disegnarlo col codice del gioco significa che l'anteprima non può mentire.
 *
 * Come tutto `ui/`, è l'unico strato che tocca il DOM; e come tutto il gioco
 * disegna solo via `Renderer`, mai sul contesto del canvas.
 */

export type PreviewPainter = (r: Renderer, tick: number) => void;

/** Lato del canvas in pixel logici. Il CSS decide quanto è grande sullo schermo. */
const SIZE = 150;

export class Preview {
  private readonly renderer: Renderer | null = null;
  private painter: PreviewPainter | null = null;
  private frame: number | undefined;
  private tick = 0;

  constructor(
    private readonly figure: HTMLElement | null,
    canvas: HTMLCanvasElement | null,
    private readonly caption: HTMLElement | null,
  ) {
    if (canvas) this.renderer = new Canvas2DRenderer(canvas, SIZE, SIZE);
  }

  /**
   * Mostra qualcosa e comincia ad animarlo.
   *
   * Si può richiamare a ogni spostamento della selezione: cambia il disegno e
   * basta, senza spegnere e riaccendere il ciclo di animazione — è quello che
   * tiene continuo il respiro del gatto mentre si scorre la lista.
   */
  show(painter: PreviewPainter, caption = ''): void {
    if (!this.renderer) return;
    this.painter = painter;
    if (this.caption) this.caption.textContent = caption;
    if (this.figure) this.figure.hidden = false;
    if (this.frame === undefined) this.loop();
  }

  /** Nessuna anteprima su questa pagina: si nasconde e si smette di disegnare. */
  hide(): void {
    this.painter = null;
    if (this.figure) this.figure.hidden = true;
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
      this.frame = undefined;
    }
  }

  private readonly loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const painter = this.painter;
    if (!painter || !this.renderer) return;

    // Il ritratto è fermo per quasi tutto: gli basta il tempo che passa per
    // respirare, e nient'altro. Non c'è nessuna simulazione qui dietro.
    this.tick++;
    this.renderer.begin();
    painter(this.renderer, this.tick);
    this.renderer.end();
  };
}
