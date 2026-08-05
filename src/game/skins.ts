import type { Progress } from '@core/storage';
import { IRIS, MATERIAL, PALETTE, PELT, type Material } from './theme';

/**
 * I gatti.
 *
 * Una skin non cambia una virgola di come si gioca: stessa cassa, stessa
 * fisica, stessi comandi. È deliberato — in un gioco che ti frega di continuo,
 * l'unica cosa che si compra col sudore non può anche darti un vantaggio,
 * altrimenti diventa una tassa travestita da premio.
 *
 * Si sbloccano in cinque modi diversi, e ognuno racconta una cosa diversa del
 * giocatore:
 *
 *  - `free`    ce l'hai dal primo secondo;
 *  - `coins`   monete spese. Le monete si incassano *finendo* un livello: se
 *              muori prima dell'arrivo non entrano in tasca, ed è per questo
 *              che raccoglierle è una scelta e non un riflesso;
 *  - `secret`  hai trovato un cubo nascosto nel livello giusto. Nessuno te lo
 *              dice, e nessun cubo sta sulla strada per l'arrivo;
 *  - `clear`   hai finito un livello che quasi nessuno finisce;
 *  - `deaths`  sei morto un numero osceno di volte. È l'unico premio del gioco
 *              che si guadagna facendo schifo, e ci teniamo che esista.
 */

export type SkinUnlock =
  | { kind: 'free' }
  | { kind: 'coins'; price: number }
  | { kind: 'secret'; levelId: string }
  | { kind: 'clear'; levelId: string }
  | { kind: 'deaths'; count: number };

export interface SkinDef {
  id: string;
  name: string;
  /** Una riga di descrizione, nel tono del gioco. */
  hint: string;
  /** Il mantello. */
  fur: Material;
  /** L'iride. */
  eye: Material;
  /** Naso e padiglioni. */
  nose: Material;
  /** Estremità più scure — orecchie, zampe, coda. Il siamese, insomma. */
  points?: Material;
  /** Opacità del gatto: sotto 1 si vede attraverso. */
  opacity?: number;
  /** Alone luminoso attorno alla figura. */
  aura?: string;
  /** Corona in testa: ce l'ha solo chi ha battuto chi la portava. */
  crown?: boolean;
  unlock: SkinUnlock;
}

export const SKINS: readonly SkinDef[] = [
  {
    id: 'classic',
    name: 'BASTARDO',
    hint: 'Il gatto di sempre. Non ha fatto niente di male, ma è finito qui lo stesso',
    fur: PELT.cream,
    eye: IRIS.green,
    nose: MATERIAL.skin,
    unlock: { kind: 'free' },
  },
  {
    id: 'soot',
    name: 'NEROFUMO',
    hint: 'Grigio cenere e occhi ambra. Si vede peggio nelle grotte, ed è un tuo problema',
    fur: PELT.soot,
    eye: IRIS.amber,
    nose: MATERIAL.skin,
    unlock: { kind: 'coins', price: 20 },
  },
  {
    id: 'ginger',
    name: 'ZENZERO',
    hint: 'Rosso da tetto. Statisticamente il più convinto di sapere dove sta andando',
    fur: PELT.ginger,
    eye: IRIS.green,
    nose: MATERIAL.skin,
    unlock: { kind: 'coins', price: 45 },
  },
  {
    id: 'siamese',
    name: 'SIAMESE',
    hint: 'Occhi blu, estremità scure, giudizio permanente sulle tue scelte',
    fur: PELT.siamese,
    eye: IRIS.blue,
    nose: MATERIAL.skin,
    points: PELT.siamesePoints,
    unlock: { kind: 'coins', price: 70 },
  },
  {
    id: 'gilded',
    name: 'PLACCATO',
    hint: 'Oro massiccio. Non serve a niente, costa una cifra e si vede da lontano',
    fur: PELT.gilded,
    eye: IRIS.ember,
    nose: MATERIAL.skin,
    aura: PALETTE.gold,
    unlock: { kind: 'coins', price: 150 },
  },
  {
    id: 'spirit',
    name: 'FANTASMA',
    hint: 'Trasparente. Sei morto talmente tante volte che era ora di ammetterlo',
    fur: PELT.spirit,
    eye: IRIS.blue,
    nose: PELT.spirit,
    opacity: 0.5,
    aura: '#bfe4ff',
    unlock: { kind: 'secret', levelId: 'w1-3' },
  },
  {
    id: 'neon',
    name: 'RADIOATTIVO',
    hint: 'Ha bevuto qualcosa in fabbrica. Adesso illumina la stanza',
    fur: PELT.neon,
    eye: IRIS.green,
    nose: MATERIAL.skin,
    aura: '#8dff5a',
    unlock: { kind: 'secret', levelId: 'w1-7' },
  },
  {
    id: 'shadow',
    name: 'OMBRA',
    hint: 'Nero su nero. In grotta sparisce del tutto, ed è esattamente quello che volevi',
    fur: PELT.shadow,
    eye: IRIS.ember,
    nose: PELT.shadow,
    aura: '#7a4fd0',
    unlock: { kind: 'secret', levelId: 'w1-9' },
  },
  {
    id: 'frost',
    name: 'BRINA',
    hint: 'Manto di neve compatta. Nel primo mondo daresti nell\'occhio; qui sei mimetizzato',
    fur: MATERIAL.snow,
    eye: IRIS.blue,
    nose: MATERIAL.skin,
    unlock: { kind: 'secret', levelId: 'w2-1' },
  },
  {
    id: 'steelcat',
    name: 'ACCIAIO',
    hint: 'Lamiera lucidata. Freddo al tatto e a guardarsi, esattamente come il posto',
    fur: MATERIAL.steel,
    eye: IRIS.gold,
    nose: MATERIAL.skin,
    unlock: { kind: 'secret', levelId: 'w2-2' },
  },
  {
    id: 'copper',
    name: 'RAME',
    hint: 'L\'unica cosa tiepida di tutta la fabbrica. Ci scaldi le zampe e basta',
    fur: MATERIAL.copper,
    eye: IRIS.ember,
    nose: MATERIAL.skin,
    unlock: { kind: 'secret', levelId: 'w2-3' },
  },
  {
    id: 'glacier',
    name: 'GHIACCIOLO',
    hint: 'Trasparente come il ghiaccio vero, e come quello non ti tiene su niente',
    fur: MATERIAL.ice,
    eye: IRIS.blue,
    nose: MATERIAL.ice,
    opacity: 0.7,
    aura: '#bfe4ff',
    unlock: { kind: 'secret', levelId: 'w2-4' },
  },
  {
    id: 'rubber',
    name: 'CATRAME',
    hint: 'Nero gomma da nastro trasportatore. Mangia la luce e non restituisce niente',
    fur: MATERIAL.rubber,
    eye: IRIS.amber,
    nose: MATERIAL.skin,
    unlock: { kind: 'secret', levelId: 'w2-5' },
  },
  {
    id: 'master',
    name: 'IL PADRONE',
    hint: 'Gli hai fatto cadere il soffitto in testa quattro volte. La corona adesso è tua',
    fur: PELT.master,
    eye: IRIS.gold,
    nose: MATERIAL.skin,
    crown: true,
    unlock: { kind: 'clear', levelId: 'w1-11' },
  },
  {
    id: 'nulla',
    name: 'INVISIBILE',
    hint: 'Trecento morti. Non è un premio, è una diagnosi. E no, non si vede proprio',
    fur: PELT.spirit,
    eye: IRIS.blue,
    nose: PELT.spirit,
    opacity: 0.12,
    unlock: { kind: 'deaths', count: 300 },
  },
];

export const DEFAULT_SKIN = 'classic';

export const skinById = (id: string): SkinDef =>
  SKINS.find((skin) => skin.id === id) ?? SKINS[0]!;

/** La skin che il cubo nascosto di questo livello sblocca, se ce n'è una. */
export const secretSkinOf = (levelId: string): SkinDef | undefined =>
  SKINS.find((skin) => skin.unlock.kind === 'secret' && skin.unlock.levelId === levelId);

/**
 * Il gatto è disponibile?
 *
 * Le monete e i cubi si "consumano" una volta sola e finiscono in `progress`;
 * morti e livelli finiti invece si rileggono ogni volta dallo stato, così non
 * esiste il caso in cui il premio è dovuto ma non è mai scattato.
 */
export function isSkinUnlocked(skin: SkinDef, progress: Progress): boolean {
  if (progress.skins.includes(skin.id)) return true;

  switch (skin.unlock.kind) {
    case 'free':
      return true;
    case 'clear':
      return progress.levels[skin.unlock.levelId]?.cleared ?? false;
    case 'deaths':
      return progress.totalDeaths >= skin.unlock.count;
    case 'coins':
    case 'secret':
      return false;
  }
}

/** Cosa manca per averlo, detto al giocatore. */
export function skinRequirement(skin: SkinDef, progress: Progress): string {
  switch (skin.unlock.kind) {
    case 'free':
      return 'sempre disponibile';
    case 'coins':
      return `${skin.unlock.price} monete`;
    case 'secret':
      return 'c\'è un cubo, da qualche parte';
    case 'clear':
      return 'si sblocca finendo un certo livello';
    case 'deaths':
      return `${skin.unlock.count} morti (ne hai ${progress.totalDeaths})`;
  }
}
