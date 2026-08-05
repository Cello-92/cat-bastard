import { TICK_HZ, ticksToMs } from '@core/loop';

/** Tick di gioco → "m:ss". Il tempo del gioco è contato in tick, non in ms. */
export function formatTicks(ticks: number): string {
  const totalSeconds = Math.floor(ticks / TICK_HZ);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Millisecondi → "m:ss.mmm".
 *
 * Serve dove i tempi si confrontano — la classifica, i record — e lì il
 * secondo tondo non basta: fra il primo e il secondo di un livello imparato a
 * memoria ci sono i millesimi, ed è esattamente quello che si va a guardare.
 * Nell'HUD invece resta `formatTicks`, perché tre cifre che girano a 60Hz sono
 * rumore che si muove in un angolo dello schermo mentre si sta saltando.
 */
export function formatMs(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const millis = safe % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/** Tick → "m:ss.mmm", per i record locali che nascono in tick. */
export const formatTicksPrecise = (ticks: number): string => formatMs(ticksToMs(ticks));

/** "3 morti" / "1 morte": l'italiano ha il plurale, usiamolo. */
export function plural(count: number, singular: string, plural_: string): string {
  return `${count} ${count === 1 ? singular : plural_}`;
}
