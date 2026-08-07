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
 * Sulla strada dei gomitoli vale una regola in più: **ce n'è esattamente uno
 * per gomitolo**, senza buchi. Un gomitolo sta in una stanza murata che non
 * serve a finire il livello, quindi l'unico motivo per andarci è quello che dà;
 * se il sesto e il settimo dessero la stessa identica cosa (cioè niente),
 * cercare il settimo sarebbe una perdita di tempo *dimostrabile* e la
 * collezione diventerebbe un contatore. Chi aggiunge un livello col suo `*`
 * aggiunge anche il manto, e `tests/smoke.ts` non fa passare il contrario.
 * Le imprese non hanno questo vincolo: quelle si contano da sole.
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

/**
 * Prima i gatti dei gomitoli, in ordine di soglia; poi quelli delle imprese.
 *
 * **Le soglie che ci sono già non si toccano.** Quando i gomitoli erano cinque,
 * i primi cinque manti stavano a 0, 1, 2, 4 e 5, e sono rimasti lì anche dopo
 * che i gomitoli sono diventati undici: i progressi salvano gomitoli, non gatti
 * (vedi CLAUDE.md), quindi alzare una soglia per far tornare i conti
 * richiuderebbe in faccia a qualcuno una porta che aveva già aperto. I manti
 * nuovi riempiono il buco a 3 e la coda da 6 in su.
 */
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
    id: 'pezzato',
    name: 'PEZZATO',
    blurb: 'Le chiazze sono sempre nelle stesse identiche posizioni, come tutto qui',
    yarn: 3,
    fur: MATERIAL.fur,
    marks: MATERIAL.soot,
    eye: MATERIAL.eye,
    nose: MATERIAL.skin,
    pattern: 'patched',
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
  {
    id: 'rame',
    name: 'RAME',
    blurb: 'Il colore delle tubature della fabbrica, che è l\'unica cosa tiepida là dentro',
    yarn: 6,
    fur: MATERIAL.copper,
    marks: MATERIAL.soot,
    eye: MATERIAL.amber,
    nose: MATERIAL.skin,
    pattern: 'tabby',
  },
  {
    id: 'bengala',
    name: 'BENGALA',
    blurb: 'Rosette da bestia selvatica addosso a uno che muore su una molla',
    yarn: 7,
    fur: MATERIAL.ginger,
    marks: MATERIAL.soot,
    eye: MATERIAL.amber,
    nose: MATERIAL.skin,
    pattern: 'spotted',
  },
  {
    id: 'ruggine',
    name: 'RUGGINE',
    blurb: 'Chiazzato come una lamiera lasciata fuori. Quella fabbrica è chiusa da un pezzo',
    yarn: 8,
    fur: MATERIAL.brick,
    marks: MATERIAL.iron,
    eye: MATERIAL.ember,
    nose: MATERIAL.skin,
    pattern: 'patched',
  },
  {
    id: 'catrame',
    name: 'CATRAME',
    blurb: 'Nero gomma da nastro trasportatore, con gli occhi di qualcosa che è rimasto acceso',
    yarn: 9,
    fur: MATERIAL.rubber,
    marks: MATERIAL.copper,
    eye: MATERIAL.neon,
    nose: MATERIAL.sable,
    pattern: 'spotted',
  },
  {
    id: 'acciaio',
    name: 'ACCIAIO',
    blurb: 'Lucidato a specchio. Si vede benissimo da lontano, il che qui è un difetto',
    yarn: 10,
    fur: MATERIAL.steel,
    marks: MATERIAL.iron,
    eye: MATERIAL.sapphire,
    nose: MATERIAL.iron,
    pattern: 'points',
  },
  {
    id: 'trofeo',
    // La soglia resta undici anche adesso che i gomitoli sono dodici, e resterà
    // undici per sempre: alzarla richiuderebbe una porta a chi l'aveva già
    // aperta. Il blurb invece è stato riscritto, perché quello sì che mentiva.
    name: 'TROFEO',
    blurb: 'Undici gomitoli e tutti i livelli. Non sei più un gatto, sei un soprammobile',
    yarn: 11,
    needsEveryLevel: true,
    fur: MATERIAL.membrane,
    marks: MATERIAL.gold,
    eye: MATERIAL.amber,
    nose: MATERIAL.membrane,
    pattern: 'points',
  },
  {
    id: 'miraggio',
    name: 'MIRAGGIO',
    blurb: 'Color sabbia su fondo sabbia. Nel deserto non ti vede nessuno, nemmeno tu',
    yarn: 12,
    fur: MATERIAL.sand,
    marks: MATERIAL.sandstone,
    eye: MATERIAL.faience,
    nose: MATERIAL.skin,
    pattern: 'spotted',
  },

  {
    id: 'faraone',
    name: 'FARAONE',
    blurb: 'Oro sull\'arenaria, come le incisioni del tempio. Ti hanno disegnato sui muri e poi lasciato lì',
    yarn: 13,
    fur: MATERIAL.sandstone,
    marks: MATERIAL.gold,
    eye: MATERIAL.faience,
    nose: MATERIAL.skin,
    pattern: 'tabby',
  },

  {
    id: 'sepolto',
    name: 'SEPOLTO',
    blurb: 'Colore di terra bagnata e zampe di sabbia. Sotto una pozza c\'era una stanza, e adesso c\'è un gatto',
    yarn: 14,
    fur: MATERIAL.soil,
    marks: MATERIAL.sand,
    eye: MATERIAL.faience,
    nose: MATERIAL.skin,
    pattern: 'points',
  },

  {
    id: 'volta',
    name: 'VOLTA',
    blurb: 'Bianco d\'osso e turchese, come le stanze sopra il soffitto. Ci sei arrivato guardando in su',
    yarn: 15,
    fur: MATERIAL.bone,
    marks: MATERIAL.faience,
    eye: MATERIAL.amber,
    nose: MATERIAL.skin,
    pattern: 'patched',
  },

  {
    id: 'duna',
    name: 'DUNA',
    blurb: 'Sabbia sopra e ombra sotto, come una duna vista di taglio. Sedici gomitoli per un gatto che si mimetizza col pavimento che lo uccide',
    yarn: 16,
    fur: MATERIAL.sand,
    marks: MATERIAL.soil,
    eye: MATERIAL.ember,
    nose: MATERIAL.skin,
    pattern: 'tabby',
  },

  {
    id: 'vetro',
    name: 'VETRO',
    blurb: 'Si vede attraverso, come il pavimento della torre. Sotto c\'è sempre qualcosa, ed è sempre molto lontano',
    yarn: 17,
    fur: MATERIAL.glass,
    marks: MATERIAL.ice,
    eye: MATERIAL.sapphire,
    nose: MATERIAL.skin,
    pattern: 'plain',
  },

  {
    id: 'ottone',
    name: 'OTTONE',
    blurb: 'Il colore dei congegni della torre: perni, catene, contrappesi. Roba che si muove sempre uguale, come te',
    yarn: 18,
    fur: MATERIAL.brass,
    marks: MATERIAL.iron,
    eye: MATERIAL.amber,
    nose: MATERIAL.skin,
    pattern: 'tabby',
  },

  {
    id: 'piombo',
    name: 'PIOMBO',
    blurb: 'Pesante da guardare. Cade sempre dalla parte giusta, che qui non vuol dire in giù',
    yarn: 19,
    fur: MATERIAL.lead,
    marks: MATERIAL.iron,
    eye: MATERIAL.ember,
    nose: MATERIAL.iron,
    pattern: 'patched',
  },

  {
    id: 'basalto',
    name: 'BASALTO',
    blurb: 'Pietra nera con le vetrificazioni dentro. Il manto di quello che c\'è sotto la torre, cioè altra torre',
    yarn: 20,
    fur: MATERIAL.basalt,
    marks: MATERIAL.brass,
    eye: MATERIAL.ember,
    nose: MATERIAL.sable,
    pattern: 'spotted',
  },

  {
    id: 'etere',
    name: 'ETERE',
    blurb: 'Il viola dei campi rovesci addosso a un gatto. Non capovolge niente: è solo il colore di una regola',
    yarn: 21,
    fur: MATERIAL.ether,
    marks: MATERIAL.spectre,
    eye: MATERIAL.violet,
    nose: MATERIAL.skin,
    pattern: 'points',
  },

  {
    id: 'capovolto',
    name: 'CAPOVOLTO',
    blurb: 'Ventidue gomitoli e tutti i livelli. Metà li hai presi camminando sul soffitto, e adesso non sai più qual era il verso giusto',
    yarn: 22,
    needsEveryLevel: true,
    fur: MATERIAL.spectre,
    marks: MATERIAL.shadow,
    eye: MATERIAL.violet,
    nose: MATERIAL.skin,
    pattern: 'tux',
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
  {
    id: 'aliseo',
    name: 'ALISEO',
    blurb: 'Pelo lungo e leggero: sta in aria perché non ha mai deciso di scendere',
    yarn: 0,
    feats: [FEAT.aloft],
    riddle: 'Nel deserto l\'aria porta. Fatti portare, e per quattro secondi non toccare niente',
    fur: MATERIAL.faience,
    marks: MATERIAL.sand,
    eye: MATERIAL.amber,
    nose: MATERIAL.skin,
    pattern: 'tux',
  },
  {
    id: 'sfinge',
    name: 'SFINGE',
    blurb: 'Arenaria e oro, con gli occhi di smalto. Il manto di chi ha costruito il tempio, addosso a chi lo ha attraversato',
    yarn: 0,
    feats: [FEAT.sphinx],
    riddle: 'In fondo al tempio c\'è una statua che vive sotto il pavimento. Non le puoi tirare niente: puoi solo lasciare che rompa la stanza, e aspettarla lì',
    fur: MATERIAL.sandstone,
    marks: MATERIAL.gold,
    eye: MATERIAL.faience,
    nose: MATERIAL.sandstone,
    pattern: 'points',
  },
  {
    id: 'contrappeso',
    name: 'CONTRAPPESO',
    blurb: 'Ferro e piombo, con gli anelli spenti lungo la schiena. Ne aveva quattro, e li hai spenti stando fermo nel posto giusto',
    yarn: 0,
    feats: [FEAT.rovescio],
    // Come per Lucio e per la Sfinge, non è un easter egg: sta in fondo
    // all'ultimo livello e ci arriva chiunque giochi fino in fondo.
    // L'indovinello quindi non nasconde cosa fare, dice **come**: e come, qui,
    // è l'unica cosa che non viene in mente da sola.
    riddle: 'In fondo alla torre c\'è chi ribalta la stanza. Non provare a colpirlo: togligli i posti in cui scansarsi, e lascia che sia lui a farsi cadere addosso il pavimento',
    fur: MATERIAL.iron,
    marks: MATERIAL.lead,
    eye: MATERIAL.violet,
    nose: MATERIAL.iron,
    pattern: 'tabby',
  },
  {
    id: 'contrappeso',
    name: 'CONTRAPPESO',
    blurb: 'Ferro e piombo, con gli anelli spenti lungo la schiena. Ne aveva quattro, e li hai spenti stando fermo nel posto giusto',
    yarn: 0,
    feats: [FEAT.rovescio],
    // Come per Lucio e per la Sfinge non e un easter egg: sta in fondo
    // all'ultimo livello e ci arriva chiunque giochi fino in fondo.
    // L'indovinello quindi non nasconde cosa fare, dice **come** — e come, qui,
    // e l'unica cosa che non viene in mente da sola.
    riddle: 'In fondo alla torre c\'e chi ribalta la stanza. Non provare a colpirlo: togligli i posti in cui scansarsi, e lascia che sia lui a farsi cadere addosso il pavimento',
    fur: MATERIAL.iron,
    marks: MATERIAL.lead,
    eye: MATERIAL.violet,
    nose: MATERIAL.iron,
    pattern: 'tabby',
  },
  {
    id: 'gothic',
    name: 'GOTHIC',
    blurb: 'Le righe sembrano un costato e non è un caso. Lucio le portava meglio',
    yarn: 0,
    feats: [FEAT.gothic],
    // È l'unica impresa che non è un easter egg: sta in fondo all'ultimo
    // livello e ci arriva chiunque giochi fino in fondo. L'indovinello quindi
    // non nasconde niente — dice il nome, e a quel punto il nome è già una
    // minaccia.
    riddle: 'In fondo alla cappella c\'è un gatto appeso al soffitto. Spegnigli il candelabro',
    fur: MATERIAL.onyx,
    marks: MATERIAL.bone,
    eye: MATERIAL.violet,
    nose: MATERIAL.onyx,
    pattern: 'tabby',
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
