import { LEVEL_ROWS, SEGMENT_COLS } from '../config';
import type { SkyName } from '../theme';

/**
 * I livelli si scrivono come mappe ASCII, non come dati generati.
 *
 * Il motivo è di design: un rage game è fatto di trappole piazzate a mano, una
 * per una, e una mappa leggibile nel sorgente è l'unico modo per progettarle
 * davvero. Ogni segmento è largo `SEGMENT_COLS` e i segmenti si concatenano in
 * orizzontale: si può riordinare un livello spostando una riga di codice.
 *
 * Legenda completa dei caratteri: vedi `game/tiles.ts`.
 */

export type RowMap = Readonly<Record<number, string>>;

export interface SegmentSpec {
  /** Riempie le due righe più in basso di terreno. */
  ground?: boolean;
  /** Contenuto per indice di riga (0 = in alto, 14 = in basso). */
  rows?: RowMap;
}

export interface LevelDef {
  id: string;
  /** Nome mostrato nell'HUD, es. "1-1". */
  name: string;
  title: string;
  sky: SkyName;
  spawn: { c: number; r: number };
  rows: readonly string[];
  /**
   * Arena di un boss.
   *
   * Cambia una cosa sola, ma è una regola del gioco: qui il checkpoint non
   * c'è. Non è una dimenticanza — un boss si combatte dall'inizio ogni volta,
   * altrimenti la seconda metà dello scontro si vince consumandola invece che
   * imparandola. Il patto resta in piedi lo stesso perché l'arena è larga
   * quanto uno schermo: si rimuore *dentro* il combattimento, non trenta
   * secondi prima (vedi CLAUDE.md).
   */
  boss?: boolean;
}

const GROUND_ROWS = [LEVEL_ROWS - 2, LEVEL_ROWS - 1];
const FULL_ROW = '#'.repeat(SEGMENT_COLS);

const padRow = (row: string): string => (row + ' '.repeat(SEGMENT_COLS)).slice(0, SEGMENT_COLS);

/** Costruisce un segmento largo SEGMENT_COLS e alto LEVEL_ROWS. */
export function segment({ ground = false, rows = {} }: SegmentSpec): string[] {
  const out: string[] = [];
  for (let r = 0; r < LEVEL_ROWS; r++) {
    const explicit = rows[r];
    if (explicit !== undefined) {
      out.push(padRow(explicit));
    } else if (ground && GROUND_ROWS.includes(r)) {
      out.push(FULL_ROW);
    } else {
      out.push(padRow(''));
    }
  }
  return out;
}

export interface LevelSpec {
  id: string;
  name: string;
  title: string;
  sky: SkyName;
  spawn?: { c: number; r: number };
  segments: string[][];
  boss?: boolean;
}

/** Concatena i segmenti in un livello pronto da caricare. */
export function defineLevel({
  id,
  name,
  title,
  sky,
  spawn = { c: 2, r: 12 },
  segments,
  boss = false,
}: LevelSpec): LevelDef {
  const rows: string[] = [];
  for (let r = 0; r < LEVEL_ROWS; r++) {
    rows.push(segments.map((s) => s[r] ?? ' '.repeat(SEGMENT_COLS)).join(''));
  }
  return { id, name, title, sky, spawn, rows, boss };
}
