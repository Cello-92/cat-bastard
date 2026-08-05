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
import { WORLD_2_1 } from './world-2-1';
import { WORLD_2_2 } from './world-2-2';
import { WORLD_2_3 } from './world-2-3';
import { WORLD_2_4 } from './world-2-4';
import { WORLD_2_5 } from './world-2-5';

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
  WORLD_2_1,
  WORLD_2_2,
  WORLD_2_3,
  WORLD_2_4,
  WORLD_2_5,
];

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
