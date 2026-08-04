/** Utilità matematiche condivise. Nessuna dipendenza dal gioco. */

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Muove `v` verso `target` di al massimo `step`. */
export const approach = (v: number, target: number, step: number): number =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);

export const randRange = (min: number, max: number): number =>
  min + Math.random() * (max - min);

export const randInt = (min: number, max: number): number =>
  Math.floor(randRange(min, max + 1));

export const pick = <T>(items: readonly T[]): T => {
  const item = items[randInt(0, items.length - 1)];
  if (item === undefined) throw new Error('pick() su un array vuoto');
  return item;
};

/** Oscillazione seno normalizzata in [0,1], comoda per le animazioni. */
export const wave = (t: number, period: number): number =>
  (Math.sin((t / period) * Math.PI * 2) + 1) / 2;
