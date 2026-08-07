import { DEATH_CAUSE, type DeathCause } from './taunts';

/**
 * Le imprese: i modi strani di sbloccare un gatto.
 *
 * I gomitoli sono la collezione onesta — sono lì, si trovano sbattendo contro i
 * muri, e il menu dice quanti ne mancano. Le imprese sono l'altra metà: cose
 * che nessuno ti chiede di fare, che non stanno in nessuna mappa e che il gioco
 * non ti spiega prima. Restano dentro il patto (CLAUDE.md) perché sono
 * **deterministiche** — stessa cosa fatta, stesso gatto — e perché ognuna,
 * quando è chiusa, lascia il suo indovinello in `cats.ts`: non si scopre per
 * caso e non si scopre nemmeno per fortuna, si scopre facendo esattamente
 * quella cosa lì.
 *
 * Una marca è una stringa e basta: viene salvata nei progressi
 * (`core/storage.ts`) e sincronizzata come i gomitoli, cioè per unione — una
 * cosa fatta non si disfa. Il formato è minuscole e trattini perché `cb_sync`
 * accetta solo quello: qualunque altra forma verrebbe scartata in silenzio,
 * che è il modo più elegante di perdere un gatto.
 */

export const FEAT = {
  /** Il codice che tutti conoscono, digitato in un gioco che non ha trucchi. */
  code: 'codice',
  /** Restare immobili mezzo minuto mentre il gioco aspetta che tu ti muova. */
  still: 'statua',
  /** Finire un livello senza morire e senza toccare una sola moneta. */
  ascetic: 'digiuno',
  /** Ammazzare il Padrone con un masso che ha fatto cadere lui. */
  ownRock: 'contrappasso',
  /** Spegnere Gothic Lucio: quattro tuffi finiti sul cero sbagliato. */
  gothic: 'requiem',
  /** Seppellire la Sfinge nella sabbia che ha fatto lei. */
  sphinx: 'sabbia-sua',
  /** Schiacciare il Rovescio con le zavorre che ha fatto cadere lui. */
  rovescio: 'contrappeso',
  /**
   * Restare in aria quattro secondi filati, portati dalle correnti del terzo
   * mondo. È l'unica impresa che si scopre giocando bene invece che facendo
   * una cosa strana: chi capisce il vento ci arriva senza che nessuno glielo
   * dica, ed è esattamente il momento in cui ha capito il vento.
   */
  aloft: 'aliseo',

  // --- L'album delle imboscate: una marca per ciascuna delle sette trappole
  //     che non danno **nessun** preavviso. Si collezionano morendo, ed è
  //     l'unico posto del gioco in cui morire in modo nuovo serve a qualcosa.
  ambushLure: 'imboscata-esca',
  ambushLantern: 'imboscata-lanterna',
  ambushCollapse: 'imboscata-crollo',
  ambushGhost: 'imboscata-fantasma',
  ambushSnap: 'imboscata-scatto',
  ambushHidden: 'imboscata-invisibile',
  ambushVent: 'imboscata-getto',
} as const;

export type FeatId = (typeof FEAT)[keyof typeof FEAT];

/**
 * Le sette morti dell'album, nell'ordine della tabella di CLAUDE.md.
 *
 * Sono esattamente le trappole senza preavviso: la moneta esca, il checkpoint
 * finto, il masso che crolla, la piattaforma che svanisce, gli spuntoni a
 * scatto, quelli invisibili e il getto spento. Nessuna di queste è evitabile
 * la prima volta — quindi l'album si riempie da solo giocando, e a quel punto
 * il gioco ti fa un regalo per l'unica cosa che ti riesce benissimo.
 */
export const AMBUSH_FEATS: readonly FeatId[] = [
  FEAT.ambushLure,
  FEAT.ambushLantern,
  FEAT.ambushCollapse,
  FEAT.ambushGhost,
  FEAT.ambushSnap,
  FEAT.ambushHidden,
  FEAT.ambushVent,
];

/**
 * Da come sei morto alla marca corrispondente.
 *
 * Sta qui e non in `taunts.ts` perché lì c'è cosa il gioco ti *dice*, qui c'è
 * cosa il gioco si *ricorda*. Le cause che non compaiono non valgono niente:
 * morire di spuntoni normali è morire, non collezionare.
 */
const BY_DEATH: Partial<Record<DeathCause, FeatId>> = {
  [DEATH_CAUSE.lureCoin]: FEAT.ambushLure,
  [DEATH_CAUSE.fakeCheckpoint]: FEAT.ambushLantern,
  [DEATH_CAUSE.collapse]: FEAT.ambushCollapse,
  [DEATH_CAUSE.ghost]: FEAT.ambushGhost,
  [DEATH_CAUSE.snapSpikes]: FEAT.ambushSnap,
  [DEATH_CAUSE.hiddenSpikes]: FEAT.ambushHidden,
  [DEATH_CAUSE.deadVent]: FEAT.ambushVent,
};

export const featForDeath = (cause: DeathCause): FeatId | undefined => BY_DEATH[cause];

/**
 * Il codice. Quello lì, sì.
 *
 * È l'unico easter egg che non si scopre giocando: si scopre perché lo si sa
 * già da vent'anni e prima o poi lo si prova. Le frecce muovono la selezione
 * del menu mentre lo si digita, e va benissimo — non rompe niente e fa capire
 * che il gioco sta ascoltando.
 */
export const KONAMI: readonly string[] = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];
