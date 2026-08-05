import { MATERIAL, type Material } from './theme';

/**
 * I gatti.
 *
 * Sono l'unica ricompensa del gioco, e sono deliberatamente **solo estetici**:
 * un gatto che saltasse più in alto romperebbe ogni livello già disegnato (le
 * mappe sono tarate sulle costanti di `config.ts`, non su chi le gioca) e
 * soprattutto trasformerebbe una collezione in una scorciatoia. Qui non ci sono
 * scorciatoie: c'è solo il fatto che, dopo aver trovato i gomitoli nascosti, si
 * muore vestiti meglio.
 *
 * Il manto è descritto con i materiali di `theme.ts`, mai con colori scritti a
 * mano, e il disegno del giocatore applica sempre la stessa logica di luce:
 * cambiare gatto non cambia una riga del codice di rendering.
 */

/** Come sono distribuite le marcature sul manto. */
export type CatPattern =
  /** Tinta unita. */
  | 'plain'
  /** Strisce da soriano: schiena, coda, fronte. */
  | 'tabby'
  /** Punte scure: muso, orecchie, zampe, coda. */
  | 'points'
  /** Pettorina e zampe bianche. */
  | 'tux';

export interface CatSkin {
  id: string;
  /** Nome mostrato nel menu. */
  name: string;
  /** Una riga di presentazione, nel tono del gioco. */
  blurb: string;
  /** Gomitoli necessari per sbloccarlo. 0 = c'è da sempre. */
  yarn: number;
  /** Se true serve anche aver finito tutti i livelli. */
  needsEveryLevel?: boolean;
  fur: Material;
  /** Materiale delle marcature: strisce, punte, pettorina. */
  marks: Material;
  eye: Material;
  /** Naso e padiglione delle orecchie. */
  nose: Material;
  pattern: CatPattern;
}

export const CATS: readonly CatSkin[] = [
  {
    id: 'bastardo',
    name: 'BASTARDO',
    blurb: 'Quello di sempre. Non ha mai chiesto niente di tutto questo',
    yarn: 0,
    fur: MATERIAL.fur,
    marks: MATERIAL.fur,
    eye: MATERIAL.eye,
    nose: MATERIAL.skin,
    pattern: 'plain',
  },
  {
    id: 'smoking',
    name: 'SMOKING',
    blurb: 'Nero con la pettorina bianca: vestito bene per morire',
    yarn: 1,
    fur: MATERIAL.soot,
    marks: MATERIAL.fur,
    eye: MATERIAL.amber,
    nose: MATERIAL.skin,
    pattern: 'tux',
  },
  {
    id: 'soriano',
    name: 'SORIANO',
    blurb: 'Strisce vere, non dipinte. Muore esattamente come gli altri',
    yarn: 2,
    fur: MATERIAL.ginger,
    marks: MATERIAL.hide,
    eye: MATERIAL.amber,
    nose: MATERIAL.skin,
    pattern: 'tabby',
  },
  {
    id: 'siamese',
    name: 'SIAMESE',
    blurb: 'Occhi blu, punte scure, zero pazienza',
    yarn: 4,
    fur: MATERIAL.mist,
    marks: MATERIAL.sable,
    eye: MATERIAL.sapphire,
    nose: MATERIAL.sable,
    pattern: 'points',
  },
  {
    id: 'spettro',
    name: 'SPETTRO',
    blurb: 'Sei morto così tante volte che uno di quei tentativi è rimasto qui',
    yarn: 5,
    needsEveryLevel: true,
    fur: MATERIAL.spectre,
    marks: MATERIAL.ice,
    eye: MATERIAL.ghostEye,
    nose: MATERIAL.ice,
    pattern: 'plain',
  },
];

const DEFAULT_CAT = CATS[0] as CatSkin;

export const catById = (id: string | undefined): CatSkin =>
  CATS.find((cat) => cat.id === id) ?? DEFAULT_CAT;

export interface UnlockState {
  /** Gomitoli trovati finora. */
  yarn: number;
  /** Tutti i livelli superati almeno una volta. */
  everyLevelCleared: boolean;
}

export const isCatUnlocked = (cat: CatSkin, state: UnlockState): boolean =>
  state.yarn >= cat.yarn && (!cat.needsEveryLevel || state.everyLevelCleared);

/** Cosa manca per sbloccarlo, già scritto per il menu. */
export function catRequirement(cat: CatSkin, state: UnlockState): string {
  const missing = Math.max(0, cat.yarn - state.yarn);
  if (missing > 0 && cat.needsEveryLevel) {
    return `${missing} gomitoli ancora, e tutti i livelli finiti`;
  }
  if (missing > 0) return missing === 1 ? 'Un altro gomitolo' : `Altri ${missing} gomitoli`;
  if (cat.needsEveryLevel && !state.everyLevelCleared) return 'Finisci tutti i livelli';
  return '';
}
