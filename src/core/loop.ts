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

/**
 * Tolleranza dell'aggancio al refresh dello schermo.
 *
 * Il browser non consegna 16.6667ms: consegna 16.6 o 16.7, perché arrotonda i
 * timestamp (lo fa apposta, è una contromisura di sicurezza). Con 16.6ms
 * l'accumulatore resta indietro di 0.067ms a frame e ogni ~250 frame arriva un
 * frame che non fa nessun update, seguito da uno che ne fa due. Lo schermo non
 * ha perso niente — è la *simulazione* ad andare a scatti — e infatti succede
 * su qualunque computer, veloce o lento che sia. Con 33.3ms (uno schermo a
 * 30Hz) il difetto è ancora più evidente: 1 e 2 update a frame quasi alternati.
 *
 * Un millesimo di secondo abbondante basta a coprire l'arrotondamento senza
 * mai agganciare una cadenza che è davvero diversa da quella dello schermo.
 */
const SNAP_TOLERANCE_MS = 1.2;
/** Fino a quanti tick per frame vale la pena riconoscere (30Hz, 20Hz, 15Hz). */
const SNAP_STEPS = 4;

/**
 * Porta il tempo trascorso al multiplo esatto di un tick, se ci va vicino.
 *
 * Non è un trucco per andare più veloce: è il modo di dire "questo frame vale
 * esattamente un frame di simulazione", che è quello che il monitor sta
 * effettivamente facendo. Uno scarto vero — un frame lungo per un rallentamento
 * o per un carico improvviso — resta quello che è e viene recuperato.
 */
const snapToRefresh = (elapsed: number): number => {
  for (let n = 1; n <= SNAP_STEPS; n++) {
    const target = n * TICK_MS;
    if (Math.abs(elapsed - target) <= SNAP_TOLERANCE_MS) return target;
  }
  return elapsed;
};

export type UpdateFn = (tick: number) => void;
export type RenderFn = (alpha: number) => void;

export class GameLoop {
  /** Numero di update eseguiti dall'avvio: è l'orologio del gioco. */
  tick = 0;

  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  /** Almeno un frame è già stato disegnato? Il primo va fatto comunque. */
  private painted = false;

  constructor(
    private readonly onUpdate: UpdateFn,
    private readonly onRender: RenderFn,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.painted = false;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    const elapsed = snapToRefresh(now - this.lastTime);
    this.lastTime = now;
    this.accumulator = Math.min(this.accumulator + elapsed, MAX_ACCUMULATED_MS);

    let stepped = false;
    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      this.tick++;
      this.onUpdate(this.tick);
      stepped = true;
    }

    // Senza update non c'è niente di nuovo da vedere: il disegno dipende solo
    // dallo stato del mondo e dal numero di tick, quindi ridisegnare
    // produrrebbe *esattamente* la stessa immagine. Su uno schermo a 144Hz
    // sono due frame su tre di lavoro buttato — e il lavoro buttato è quello
    // che poi manca quando serve davvero.
    if (stepped || !this.painted) {
      this.painted = true;
      this.onRender(this.accumulator / TICK_MS);
    }
  };
}
