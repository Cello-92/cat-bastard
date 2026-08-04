import type { Box } from './types';

/**
 * Griglia di tile mutabile.
 *
 * La mappa NON sa cosa significhino i caratteri: la semantica (cosa è solido,
 * cosa uccide) vive in `game/tiles.ts`. Così l'engine resta riutilizzabile.
 */

export const EMPTY_TILE = ' ';
/** Fuori dai bordi laterali il mondo è muro: si esce solo dal fondo. */
export const OUT_OF_BOUNDS_TILE = '#';

export interface CellRange {
  c0: number;
  c1: number;
  r0: number;
  r1: number;
}

export class TileMap {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;

  private readonly cells: string[];

  constructor(rows: readonly string[], tileSize: number) {
    this.rows = rows.length;
    this.cols = rows.reduce((max, row) => Math.max(max, row.length), 0);
    this.tileSize = tileSize;
    this.cells = new Array<string>(this.cols * this.rows).fill(EMPTY_TILE);

    for (let r = 0; r < this.rows; r++) {
      const row = rows[r] ?? '';
      for (let c = 0; c < this.cols; c++) {
        this.cells[r * this.cols + c] = row[c] ?? EMPTY_TILE;
      }
    }
  }

  get widthPx(): number {
    return this.cols * this.tileSize;
  }

  get heightPx(): number {
    return this.rows * this.tileSize;
  }

  get(c: number, r: number): string {
    if (c < 0 || c >= this.cols) return OUT_OF_BOUNDS_TILE;
    if (r < 0 || r >= this.rows) return EMPTY_TILE;
    return this.cells[r * this.cols + c] ?? EMPTY_TILE;
  }

  set(c: number, r: number, tile: string): void {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    this.cells[r * this.cols + c] = tile;
  }

  clear(c: number, r: number): void {
    this.set(c, r, EMPTY_TILE);
  }

  /** Celle toccate da un box, già limitate ai bordi della mappa. */
  cellsOf(box: Box): CellRange {
    const size = this.tileSize;
    return {
      c0: Math.floor(box.x / size),
      c1: Math.floor((box.x + box.w - 1) / size),
      r0: Math.floor(box.y / size),
      r1: Math.floor((box.y + box.h - 1) / size),
    };
  }

  /** Itera le celle non vuote toccate da un box. */
  *touching(box: Box): Generator<{ c: number; r: number; tile: string }> {
    const { c0, c1, r0, r1 } = this.cellsOf(box);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const tile = this.get(c, r);
        if (tile !== EMPTY_TILE) yield { c, r, tile };
      }
    }
  }

  /** Scansione completa: usata al caricamento per estrarre le entità. */
  *entries(): Generator<{ c: number; r: number; tile: string }> {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.get(c, r);
        if (tile !== EMPTY_TILE) yield { c, r, tile };
      }
    }
  }

  static key(c: number, r: number): string {
    return `${c},${r}`;
  }
}
