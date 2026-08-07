import type { LevelDef } from './level';
import { WORLD_1_1 } from './world-1-1';
import { WORLD_1_2 } from './world-1-2';
import { WORLD_1_3 } from './world-1-3';
import { WORLD_1_4 } from './world-1-4';
import { WORLD_1_5 } from './world-1-5';
import { WORLD_1_6 } from './world-1-6';
import { WORLD_1_7 } from './world-1-7';
import { WORLD_1_8 } from './world-1-8';
import { WORLD_1_9 } from './world-1-9';
import { WORLD_1_10 } from './world-1-10';
import { WORLD_1_11 } from './world-1-11';
import { WORLD_2_1 } from './world-2-1';
import { WORLD_2_2 } from './world-2-2';
import { WORLD_2_3 } from './world-2-3';
import { WORLD_2_4 } from './world-2-4';
import { WORLD_2_5 } from './world-2-5';
import { WORLD_2_6 } from './world-2-6';
import { WORLD_2_7 } from './world-2-7';
import { WORLD_2_8 } from './world-2-8';
import { WORLD_2_9 } from './world-2-9';
import { WORLD_2_10 } from './world-2-10';
import { WORLD_2_11 } from './world-2-11';
import { WORLD_3_1 } from './world-3-1';
import { WORLD_3_2 } from './world-3-2';
import { WORLD_3_3 } from './world-3-3';
import { WORLD_3_4 } from './world-3-4';
import { WORLD_3_5 } from './world-3-5';
import { WORLD_3_6 } from './world-3-6';
import { WORLD_3_7 } from './world-3-7';
import { WORLD_3_8 } from './world-3-8';
import { WORLD_3_9 } from './world-3-9';
import { WORLD_3_10 } from './world-3-10';
import { WORLD_3_11 } from './world-3-11';
import { WORLD_4_1 } from './world-4-1';
import { WORLD_4_2 } from './world-4-2';
import { WORLD_4_3 } from './world-4-3';
import { WORLD_4_4 } from './world-4-4';
import { WORLD_4_5 } from './world-4-5';
import { WORLD_4_6 } from './world-4-6';
import { WORLD_4_7 } from './world-4-7';

/**
 * Registro dei livelli, in ordine di gioco.
 * Aggiungere un livello = creare il file e appenderlo qui. Nient'altro.
 */
export const LEVELS: readonly LevelDef[] = [
  WORLD_1_1,
  WORLD_1_2,
  WORLD_1_3,
  WORLD_1_4,
  WORLD_1_5,
  WORLD_1_6,
  WORLD_1_7,
  WORLD_1_8,
  WORLD_1_9,
  WORLD_1_10,
  WORLD_1_11,
  WORLD_2_1,
  WORLD_2_2,
  WORLD_2_3,
  WORLD_2_4,
  WORLD_2_5,
  WORLD_2_6,
  WORLD_2_7,
  WORLD_2_8,
  WORLD_2_9,
  WORLD_2_10,
  WORLD_2_11,
  WORLD_3_1,
  WORLD_3_2,
  WORLD_3_3,
  WORLD_3_4,
  WORLD_3_5,
  WORLD_3_6,
  WORLD_3_7,
  WORLD_3_8,
  WORLD_3_9,
  WORLD_3_10,
  WORLD_3_11,
  WORLD_4_1,
  WORLD_4_2,
  WORLD_4_3,
  WORLD_4_4,
  WORLD_4_5,
  WORLD_4_6,
  WORLD_4_7,
];

/**
 * I mondi, ricavati dagli id dei livelli.
 *
 * Il numero del mondo non è un campo da compilare: sta già nell'id (`w2-3` è il
 * terzo livello del mondo 2), quindi si legge da lì. Vale la stessa regola di
 * `SECRET_COUNT` — aggiungere un livello resta "un file e una riga nel registro",
 * e un mondo nuovo nasce da solo il giorno in cui compare un `w3-1`.
 *
 * L'unica cosa scritta a mano è il sottotitolo, perché quello non si deduce.
 */
const WORLD_SUBTITLES: Record<number, string> = {
  1: 'Prati, grotte, e un Padrone in fondo',
  2: 'Gelo, fabbrica, e una cappella in fondo',
  3: 'Sabbia, correnti, e in fondo quello che ha costruito il tempio',
  4: 'Una torre, il vuoto sotto, e da che parte si cade',
};

export interface WorldDef {
  /** 1, 2, … Ricavato dall'id dei livelli che contiene. */
  number: number;
  subtitle: string;
  levels: readonly LevelDef[];
  /** Indice del primo livello del mondo dentro `LEVELS`: serve per giocarlo. */
  firstIndex: number;
}

export const WORLDS: readonly WorldDef[] = (() => {
  const byNumber = new Map<number, { levels: LevelDef[]; firstIndex: number }>();

  LEVELS.forEach((level, index) => {
    // `w2-3` → 2. Un id che non ha questa forma finisce nel mondo 1: è la
    // risposta meno sorprendente, e comunque `tests/smoke.ts` non gliela fa
    // passare (il formato è anche un contratto col database).
    const number = Number(/^w(\d+)-/.exec(level.id)?.[1] ?? 1);
    const entry = byNumber.get(number);
    if (entry) entry.levels.push(level);
    else byNumber.set(number, { levels: [level], firstIndex: index });
  });

  return [...byNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, { levels, firstIndex }]) => ({
      number,
      subtitle: WORLD_SUBTITLES[number] ?? '',
      levels,
      firstIndex,
    }));
})();

/**
 * Quanti gomitoli esistono in tutto il gioco.
 *
 * Si conta dalle mappe invece di scriverlo a mano: aggiungere un livello col
 * suo segreto non deve richiedere di ricordarsi di aggiornare un numero da
 * un'altra parte, altrimenti prima o poi il menu mente.
 */
export const SECRET_COUNT = LEVELS.filter((level) =>
  level.rows.some((row) => row.includes('*')),
).length;

export const firstLevel = (): LevelDef => {
  const level = LEVELS[0];
  if (!level) throw new Error('Nessun livello registrato');
  return level;
};

export const levelAt = (index: number): LevelDef | undefined => LEVELS[index];

export const indexOfLevel = (id: string): number => LEVELS.findIndex((l) => l.id === id);

export type { LevelDef };
