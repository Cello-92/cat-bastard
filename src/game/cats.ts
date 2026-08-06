import { IRIS, MATERIAL, PELT, type Material } from './theme';

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
 * **Ce n'è esattamente uno per gomitolo**, e non è un dettaglio di bilanciamento:
 * è il patto della collezione. Un gomitolo è nascosto in una stanza murata che
 * non serve a finire il livello — l'unico motivo per andarci è quello che si
 * ottiene, e se il quinto e il sesto gomitolo dessero la stessa identica cosa
 * (cioè niente) cercarli diventerebbe una perdita di tempo *dimostrabile*. Chi
 * aggiunge un gomitolo aggiunge un gatto, sempre; `tests/smoke.ts` non fa
 * passare il contrario.
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
  | 'tux'
  /** Chiazze irregolari, groppa e fianco, più i calzini. */
  | 'patched'
  /** Rosette sparse in tre file. */
  | 'spotted';

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
  /** Materiale delle marcature: strisce, punte, pettorina, chiazze. */
  marks: Material;
  eye: Material;
  /** Naso e padiglione delle orecchie. */
  nose: Material;
  pattern: CatPattern;
}

/**
 * L'ordine è quello di sblocco, e i numeri dei primi cinque non si toccano.
 *
 * Quando i gomitoli erano cinque, questi cinque gatti stavano a 0, 1, 2, 4 e 5.
 * Rinumerarli per far tornare i conti vorrebbe dire togliere dalle mani di
 * qualcuno un gatto che si era già guadagnato: i progressi salvati contano
 * gomitoli, non gatti (vedi CLAUDE.md), quindi alzare una soglia richiude una
 * porta che era aperta. I gatti nuovi riempiono i buchi e la coda.
 */
export const CATS: readonly CatSkin[] = [
  {
    id: 'bastardo',
    name: 'BASTARDO',
    blurb: 'Quello di sempre. Non ha mai chiesto niente di tutto questo',
    yarn: 0,
    fur: PELT.cream,
    marks: PELT.cream,
    eye: IRIS.green,
    nose: MATERIAL.skin,
    pattern: 'plain',
  },
  {
    id: 'smoking',
    name: 'SMOKING',
    blurb: 'Nero con la pettorina bianca: vestito bene per morire',
    yarn: 1,
    fur: PELT.soot,
    marks: PELT.cream,
    eye: IRIS.amber,
    nose: MATERIAL.skin,
    pattern: 'tux',
  },
  {
    id: 'soriano',
    name: 'SORIANO',
    blurb: 'Strisce vere, non dipinte. Muore esattamente come gli altri',
    yarn: 2,
    fur: PELT.ginger,
    marks: MATERIAL.hide,
    eye: IRIS.amber,
    nose: MATERIAL.skin,
    pattern: 'tabby',
  },
  {
    id: 'pezzato',
    name: 'PEZZATO',
    blurb: 'Le chiazze sono sempre nelle stesse identiche posizioni, come tutto qui',
    yarn: 3,
    fur: PELT.cream,
    marks: PELT.soot,
    eye: IRIS.green,
    nose: MATERIAL.skin,
    pattern: 'patched',
  },
  {
    id: 'siamese',
    name: 'SIAMESE',
    blurb: 'Occhi blu, punte scure, zero pazienza',
    yarn: 4,
    fur: PELT.siamese,
    marks: PELT.siamesePoints,
    eye: IRIS.blue,
    nose: PELT.siamesePoints,
    pattern: 'points',
  },
  {
    id: 'spettro',
    name: 'SPETTRO',
    blurb: 'Sei morto così tante volte che uno di quei tentativi è rimasto qui',
    yarn: 5,
    needsEveryLevel: true,
    fur: PELT.spirit,
    marks: MATERIAL.ice,
    eye: MATERIAL.ghostEye,
    nose: MATERIAL.ice,
    pattern: 'plain',
  },
  {
    id: 'cenere',
    name: 'CENERE',
    blurb: 'Grigio fabbrica, righe di brina. Ha passato l\'inverno là dentro',
    yarn: 6,
    fur: PELT.soot,
    marks: PELT.spirit,
    eye: IRIS.blue,
    nose: PELT.siamesePoints,
    pattern: 'tabby',
  },
  {
    id: 'bengala',
    name: 'BENGALA',
    blurb: 'Rosette da bestia selvatica addosso a uno che muore su una molla',
    yarn: 7,
    fur: PELT.ginger,
    marks: PELT.soot,
    eye: IRIS.amber,
    nose: MATERIAL.skin,
    pattern: 'spotted',
  },
  {
    id: 'ombra',
    name: 'OMBRA',
    blurb: 'Sul fondo scuro non si vede quasi. Gli spuntoni lo vedono benissimo',
    yarn: 8,
    fur: PELT.shadow,
    marks: PELT.soot,
    eye: IRIS.ember,
    nose: PELT.siamesePoints,
    pattern: 'plain',
  },
  {
    id: 'reattore',
    name: 'REATTORE',
    blurb: 'Qualcosa, in quella fabbrica, era ancora acceso',
    yarn: 9,
    fur: PELT.neon,
    marks: PELT.shadow,
    eye: IRIS.ember,
    nose: PELT.shadow,
    pattern: 'spotted',
  },
  {
    id: 'placcato',
    name: 'PLACCATO',
    blurb: 'Lo stesso oro dei blocchi premio. Vale altrettanto: niente',
    yarn: 10,
    fur: PELT.gilded,
    marks: PELT.soot,
    eye: IRIS.ember,
    nose: MATERIAL.skin,
    pattern: 'tabby',
  },
  {
    id: 'padrone',
    name: 'PADRONE',
    blurb: 'Undici gomitoli e tutti i livelli, per vestirti da quello che ti ammazza',
    yarn: 11,
    needsEveryLevel: true,
    fur: PELT.master,
    marks: PELT.soot,
    eye: IRIS.gold,
    nose: PELT.soot,
    pattern: 'points',
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
