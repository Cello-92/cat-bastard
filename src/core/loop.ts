/**
 * Game loop a timestep fisso.
 *
 * La simulazione gira sempre a 60 update/secondo indipendentemente dal refresh
 * dello schermo: su un monitor a 144Hz il gatto non deve saltare più in alto.
 * Il rendering invece gira a ogni frame disponibile e riceve `alpha`, la
 * frazione di step già trascorsa, per interpolare le posizioni.
 */

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Oltre questa soglia si scarta il tempo accumulato (tab in background). */
const MAX_ACCUMULATED_MS = TICK_MS * 5;

export type UpdateFn = (tick: number) => void;
export type RenderFn = (alpha: number) => void;

export class GameLoop {
  /** Numero di update eseguiti dall'avvio: è l'orologio del gioco. */
  tick = 0;

  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  constructor(
    private readonly onUpdate: UpdateFn,
    private readonly onRender: RenderFn,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    const elapsed = now - this.lastTime;
    this.lastTime = now;
    this.accumulator = Math.min(this.accumulator + elapsed, MAX_ACCUMULATED_MS);

    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      this.tick++;
      this.onUpdate(this.tick);
    }

    this.onRender(this.accumulator / TICK_MS);
  };
}
