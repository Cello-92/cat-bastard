import type { LevelDef } from './level';
import { WORLD_1_1 } from './world-1-1';
import { WORLD_1_2 } from './world-1-2';
import { WORLD_1_3 } from './world-1-3';
import { WORLD_1_4 } from './world-1-4';
import { WORLD_1_5 } from './world-1-5';

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
];

export const firstLevel = (): LevelDef => {
  const level = LEVELS[0];
  if (!level) throw new Error('Nessun livello registrato');
  return level;
};

export const levelAt = (index: number): LevelDef | undefined => LEVELS[index];

export const indexOfLevel = (id: string): number => LEVELS.findIndex((l) => l.id === id);

export type { LevelDef };
