import { AMBUSH_FEATS, FEAT, type FeatId } from './feats';
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
 * Ci si arriva in due modi. Coi **gomitoli**, che è la strada dichiarata: il
 * menu dice quanti ne mancano e i livelli li nascondono dietro i muri finti.
 * Oppure con le **imprese** (`game/feats.ts`), che è la strada di lato: cose
 * strane che nessuno chiede di fare e che il gioco non annuncia — ma di cui
 * resta sempre l'indovinello nella riga del gatto chiuso, perché qui dentro
 * niente è inspiegabile, è solo spiegato dopo.
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
  /**
   * Imprese richieste, tutte quante (vedi `game/feats.ts`).
   *
   * È l'altra strada per un gatto: non contare gomitoli, ma fare la cosa
   * strana. Un gatto con imprese ha sempre `yarn: 0` — chiedere le due cose
   * insieme vorrebbe dire nascondere un easter egg dietro una collezione, e a
   * quel punto non lo troverebbe più nessuno.
   */
  feats?: readonly FeatId[];
  /**
   * Cosa bisogna fare, detto senza dirlo.
   *
   * Sostituisce il conteggio dei gomitoli nella riga del menu, ed è l'unica
   * cosa che tiene un easter egg dentro il patto: la trappola si capisce dopo
   * essere morti, l'impresa si capisce dopo aver letto l'indovinello. In tutti
   * e due i casi il gioco non ti lascia mai davanti a una cosa inspiegabile.
   */
  riddle?: string;
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

  // ------------------------------------------------------------- le imprese
  // Da qui in giù i gomitoli non c'entrano niente: sono i gatti che si prendono
  // facendo qualcosa che nessuno ha chiesto. Restano estetici come gli altri —
  // un easter egg che desse un vantaggio smetterebbe di essere una battuta e
  // diventerebbe la strada giusta per giocare.
  {
    id: 'placcato',
    name: 'PLACCATO',
    blurb: 'Oro pieno, come i blocchi premio. E come loro non ti aiuta in niente',
    yarn: 0,
    feats: [FEAT.code],
    riddle: 'C\'è un codice che sai già a memoria da vent\'anni. Qui non sblocca vite infinite',
    fur: MATERIAL.gold,
    marks: MATERIAL.gold,
    eye: MATERIAL.sapphire,
    nose: MATERIAL.skin,
    pattern: 'plain',
  },
  {
    id: 'ombra',
    name: 'OMBRA',
    blurb: 'Sei stato fermo così a lungo che la tua ombra si è staccata e ha preso il tuo posto',
    yarn: 0,
    feats: [FEAT.still],
    riddle: 'Tutto qui dentro ti spinge a muoverti. Prova il contrario, e insisti per mezzo minuto',
    fur: MATERIAL.shadow,
    marks: MATERIAL.soot,
    eye: MATERIAL.ember,
    nose: MATERIAL.sable,
    pattern: 'plain',
  },
  {
    id: 'cavia',
    name: 'CAVIA',
    blurb: 'Sette imboscate, sette morti, zero preavvisi. Qualcosa ti è rimasto attaccato addosso',
    yarn: 0,
    feats: AMBUSH_FEATS,
    riddle: 'Sette trappole non ti avvisano mai. Falle scattare tutte, una per una, con la faccia',
    fur: MATERIAL.neon,
    marks: MATERIAL.soot,
    eye: MATERIAL.ghostEye,
    nose: MATERIAL.skin,
    pattern: 'tabby',
  },
  {
    id: 'monaco',
    name: 'MONACO',
    blurb: 'Niente monete, niente morti, niente da dire. Ti hanno offerto delle trappole e hai declinato',
    yarn: 0,
    feats: [FEAT.ascetic],
    riddle: 'Finisci un livello senza morire nemmeno una volta e senza toccare una sola moneta',
    fur: MATERIAL.ash,
    marks: MATERIAL.snow,
    eye: MATERIAL.amber,
    nose: MATERIAL.skin,
    pattern: 'tux',
  },
  {
    id: 'padrone',
    name: 'PADRONE',
    blurb: 'Il suo soffitto, il suo masso, la sua corona. Il manto adesso è tuo',
    yarn: 0,
    feats: [FEAT.ownRock],
    riddle: 'Il Padrone ha una sola arma e la usa per primo. Non serve rubargliela: basta stare nel posto giusto',
    fur: MATERIAL.hide,
    marks: MATERIAL.sable,
    eye: MATERIAL.ember,
    nose: MATERIAL.sable,
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
  /** Imprese compiute finora (vedi `game/feats.ts`). */
  feats: ReadonlySet<string>;
}

/** Quante delle imprese richieste sono già state fatte. */
export const catFeatsDone = (cat: CatSkin, state: UnlockState): number =>
  (cat.feats ?? []).filter((feat) => state.feats.has(feat)).length;

export const isCatUnlocked = (cat: CatSkin, state: UnlockState): boolean =>
  state.yarn >= cat.yarn &&
  (!cat.needsEveryLevel || state.everyLevelCleared) &&
  catFeatsDone(cat, state) === (cat.feats?.length ?? 0);

/** Cosa manca per sbloccarlo, già scritto per il menu. */
export function catRequirement(cat: CatSkin, state: UnlockState): string {
  // Le imprese vengono prima: un gatto che ne chiede non chiede altro, e la
  // sua riga è l'indovinello — l'unico indizio che il gioco concede.
  const wanted = cat.feats?.length ?? 0;
  if (wanted > 0) {
    const done = catFeatsDone(cat, state);
    // Con una sola impresa il conteggio direbbe "0 su 1", cioè niente.
    const counter = wanted > 1 ? ` (${done} su ${wanted})` : '';
    return `${cat.riddle ?? 'Fai la cosa giusta, che non è quella ovvia'}${counter}`;
  }

  const missing = Math.max(0, cat.yarn - state.yarn);
  if (missing > 0 && cat.needsEveryLevel) {
    return `${missing} gomitoli ancora, e tutti i livelli finiti`;
  }
  if (missing > 0) return missing === 1 ? 'Un altro gomitolo' : `Altri ${missing} gomitoli`;
  if (cat.needsEveryLevel && !state.everyLevelCleared) return 'Finisci tutti i livelli';
  return '';
}
