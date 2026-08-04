import { TICK_HZ } from '@core/loop';

/** Tick di gioco → "m:ss". Il tempo del gioco è contato in tick, non in ms. */
export function formatTicks(ticks: number): string {
  const totalSeconds = Math.floor(ticks / TICK_HZ);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** "3 morti" / "1 morte": l'italiano ha il plurale, usiamolo. */
export function plural(count: number, singular: string, plural_: string): string {
  return `${count} ${count === 1 ? singular : plural_}`;
}
