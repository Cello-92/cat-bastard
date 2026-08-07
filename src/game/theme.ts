import type { Stop } from '@engine/render/renderer';

/**
 * Direzione artistica: l'unico posto in cui esistono colori.
 *
 * Non è più una lista di tinte piatte ma un insieme di **materiali**. Ogni
 * superficie del gioco dichiara come reagisce alla luce — faccia illuminata,
 * colore proprio, faccia in ombra, fondo delle fessure, riflesso speculare —
 * e il codice di disegno si limita ad applicare sempre la stessa logica.
 * È questo che tiene insieme la resa: una pietra e un metallo sono diversi
 * perché hanno valori diversi, non perché sono disegnati con regole diverse.
 *
 * Regola (CLAUDE.md): mai colori hardcoded nel codice di disegno.
 * I valori UI sono duplicati in src/style.css — vanno tenuti allineati.
 */

/**
 * La luce del mondo arriva dall'alto a sinistra, sempre.
 * Ogni ombra, ogni riflesso e ogni bordo illuminato del gioco discende da qui:
 * cambiare questo vettore significa ridisegnare l'illuminazione di tutto.
 */
export const LIGHT = { x: -0.48, y: -0.88 } as const;

export interface Material {
  /** Colore proprio della superficie, in piena luce diffusa. */
  base: string;
  /** Faccia rivolta verso la luce. */
  light: string;
  /** Faccia in ombra, illuminata solo dal cielo. */
  dark: string;
  /** Fondo di fessure e incassi: occlusione quasi totale. */
  deep: string;
  /** Riflesso speculare: quanto più stretto e chiaro, tanto più lucido appare. */
  spec: string;
}

const material = (base: string, light: string, dark: string, deep: string, spec: string): Material => ({
  base,
  light,
  dark,
  deep,
  spec,
});

/**
 * I materiali del gioco.
 *
 * I valori non sono scelti a occhio: per ogni materiale la faccia illuminata è
 * più calda e desaturata, quella in ombra vira al blu del cielo. È la
 * differenza tra "colore più chiaro / colore più scuro" e una superficie che
 * sembra stare davvero sotto una luce.
 */
export const MATERIAL = {
  /** Terra compatta: opaca, calda, quasi senza riflesso. */
  soil: material('#5a4130', '#836043', '#38271b', '#1e150e', '#9c7a58'),
  /** Roccia grigia da falesia. */
  rock: material('#71737b', '#a9adb8', '#474950', '#26272c', '#c9cfda'),
  /** Manto erboso. */
  grass: material('#4b7a37', '#8cc257', '#2c4a26', '#16260f', '#b6e07f'),
  /** Muschio sui bordi esposti. */
  moss: material('#5c7a3a', '#8aa855', '#33461f', '#1b2611', '#a8c473'),
  /** Oro lucido: riflesso stretto e caldo. */
  gold: material('#c2912a', '#ffe9a0', '#714c0e', '#3b2705', '#fffdf0'),
  /** Acciaio lucidato: riflesso quasi bianco. */
  steel: material('#8d96a2', '#e3ebf4', '#3d434c', '#1f2228', '#ffffff'),
  /** Ferro brunito: metallo sporco, riflesso spento. */
  iron: material('#5e5a58', '#918c85', '#332f2d', '#1a1817', '#b9b3a8'),
  /** Legno stagionato. */
  wood: material('#7a5636', '#a97f4d', '#4a3420', '#291b10', '#c69a63'),
  /** Laterizio cotto. */
  brick: material('#9d5236', '#c67c56', '#5b2b1b', '#321609', '#d69a76'),
  /** Metallo verniciato del tubo. */
  enamel: material('#2f7d52', '#6ed49c', '#12402a', '#082517', '#dfffee'),
  /** Pelo del gatto: crema caldo. */
  fur: material('#ded3c0', '#fffaf0', '#a2947e', '#5b5245', '#ffffff'),
  /** Pelo scuro della creatura. */
  hide: material('#6b4a33', '#9d7450', '#3a2517', '#1d130c', '#c19a70'),
  /** Cappello del fungo: lucido, quasi ceroso. */
  cap: material('#b03129', '#e97a63', '#661714', '#360b09', '#ffd8ce'),
  /** Pelle e naso. */
  skin: material('#e08a97', '#f8bcc2', '#a94f61', '#6b2c3c', '#ffe3e6'),
  /** Iride: l'unico materiale del gioco che emette un po' di luce sua. */
  eye: material('#4f9e5c', '#95dd8a', '#1f4a2a', '#0c1f12', '#f0fff0'),
  /** Membrana alare della bestia che si tuffa. */
  membrane: material('#6b3550', '#a35f7a', '#3a1a2c', '#1d0d16', '#d69ab0'),

  // --- Mondo 2: il gelo e la fabbrica.
  /**
   * Ghiaccio: l'unico materiale del gioco che si vede *attraverso*.
   * La faccia in ombra è più satura della base, non meno: è il colore che si
   * accumula nello spessore, ed è quello che lo distingue da un vetro.
   */
  ice: material('#93c9e0', '#e2f6ff', '#3d7fa2', '#1b4159', '#ffffff'),
  /** Neve compatta: quasi bianca, ma con l'ombra azzurra del cielo dentro. */
  snow: material('#dfe9f3', '#ffffff', '#9db3c9', '#67809a', '#ffffff'),
  /** Lamiera zincata della fabbrica: fredda, opaca, sporca di ruggine. */
  plate: material('#6f7a85', '#b3c0cc', '#3a4149', '#1c2026', '#dbe6f0'),
  /** Gomma del nastro trasportatore: nera, opaca, mangia la luce. */
  rubber: material('#2b2d33', '#53575f', '#141519', '#08090b', '#858b95'),
  /** Rame degli impianti: caldo, l'unica cosa tiepida quaggiù. */
  copper: material('#a4653a', '#e2a071', '#5c3319', '#2e180b', '#ffd7ae'),

  // --- Mondo 3: il deserto e il tempio.
  /**
   * Sabbia asciutta: quasi senza riflesso, perché è fatta di grani e ogni
   * grano rimanda la luce da un'altra parte. È il materiale più chiaro del
   * gioco dopo la neve, e a differenza della neve non è freddo.
   */
  sand: material('#c9a367', '#f2dda9', '#8a6738', '#4d381b', '#fff3d2'),
  /** Arenaria squadrata del tempio: più rosa della sabbia, e più compatta. */
  sandstone: material('#b0865c', '#dcb98e', '#6b4a2e', '#3a2617', '#f0d6b4'),
  /**
   * Faïence: lo smalto turchese delle incisioni. L'unico colore freddo di
   * tutto il mondo 3, e serve esattamente a questo — è il colore delle cose
   * fatte da qualcuno, in un posto dove tutto il resto è stato fatto dal vento.
   */
  faience: material('#2e8f8a', '#7fd7cf', '#14504f', '#082a2a', '#dffffb'),

  // --- Mondo 4: la torre e il Rovescio.
  /**
   * Vetro temprato: l'unico materiale del gioco che è quasi solo riflesso.
   *
   * La faccia in ombra è **più chiara** della base, non più scura, perché in
   * un vetro l'ombra è quello che si vede attraverso: è la stessa idea del
   * ghiaccio, portata fino in fondo. Serve a far leggere un pavimento che non
   * nasconde cosa c'è dall'altra parte, che nel quarto mondo è un'informazione
   * di gioco e non un effetto.
   */
  glass: material('#8fb6c4', '#e8fbff', '#a9cfdb', '#3f6472', '#ffffff'),
  /** Basalto: la pietra del Rovescio. Nera, ruvida, senza un riflesso. */
  basalt: material('#3a3742', '#645f70', '#201e26', '#100f14', '#8e879c'),
  /** Ottone dei congegni della torre: caldo, lucido, un po' ossidato. */
  brass: material('#b08b3c', '#f0d382', '#6a4f16', '#372809', '#fff3cd'),
  /** Piombo delle zavorre: pesante da guardare, e non è un modo di dire. */
  lead: material('#565a63', '#8b909b', '#2e3136', '#17181c', '#a8adb8'),
  /**
   * Etere: il colore del campo rovescio.
   *
   * È l'unico materiale del gioco che non è fatto di niente — è una regola
   * resa visibile — quindi ha una base quasi trasparente e uno speculare che
   * emette. Il campo spento usa esattamente lo stesso materiale, ed è tutta
   * la trappola.
   */
  ether: material('#7f6fd6', '#cfc4ff', '#3b3080', '#1b1543', '#f2ecff'),

  // --- Manti e occhi dei gatti sbloccabili (vedi game/cats.ts).
  /** Nero fuliggine: mai davvero nero, altrimenti sparisce sul fondo scuro. */
  soot: material('#2f3038', '#5c5f6b', '#17171c', '#0b0b0e', '#9aa0ad'),
  /** Rosso soriano. */
  ginger: material('#c47a3c', '#f0b071', '#84491b', '#4a2609', '#ffd9a8'),
  /** Crema chiarissimo del siamese. */
  mist: material('#e6dbc6', '#fffaf0', '#b0a08a', '#6f6455', '#ffffff'),
  /** Punte scure del siamese: muso, orecchie, zampe, coda. */
  sable: material('#5a4436', '#876951', '#33251c', '#1a120d', '#a98a6c'),
  /** Bianco del gatto spettro: quasi ghiaccio, quasi niente. */
  spectre: material('#d8e6ef', '#ffffff', '#93a8ba', '#5b6c7d', '#ffffff'),
  /** Iride ambra. */
  amber: material('#c98b1f', '#f5c85e', '#7a4d08', '#3c2603', '#fff2c8'),
  /** Iride blu ghiaccio. */
  sapphire: material('#3d7fc4', '#8dc4f2', '#1a3f70', '#0b1e39', '#e8f6ff'),
  /** Iride del gatto spettro: rosa acceso, l'unica cosa viva che gli resta. */
  ghostEye: material('#d63f7d', '#ff8fb8', '#7c1741', '#3d0a21', '#ffe0ec'),

  // --- Manti delle imprese (vedi game/feats.ts): i gatti che non si comprano
  //     coi gomitoli, ma facendo la cosa strana giusta.
  /** Ombra: quasi nero, con un riflesso viola. Non è nero pieno: sparirebbe. */
  shadow: material('#27232f', '#4b4359', '#151119', '#09070d', '#9079b2'),
  /** Verde acido da laboratorio: l'unico manto che sembra illuminarsi da solo. */
  neon: material('#7ee04a', '#caff9c', '#3e7b23', '#1c3e0f', '#ebffd1'),
  /** Grigio cenere del gatto sobrio: lana, non pelliccia da esposizione. */
  ash: material('#7c8794', '#b6c2cf', '#454d57', '#232830', '#dbe4ee'),
  /** Iride di brace: il rosso caldo di chi è stato dall'altra parte. */
  ember: material('#e0503a', '#ff9d7c', '#7d1f13', '#3d0d07', '#ffd9cc'),

  // --- La cappella di 2-11: Gothic Lucio, i ceri e chi si veste come lui.
  /**
   * Onice: il nero di Lucio. Non è il nero dell'ombra — quello mangia la luce,
   * questo la restituisce viola, perché è velluto e il velluto si vede.
   */
  onyx: material('#231a2c', '#463456', '#120c18', '#08050c', '#8f6dab'),
  /** Osso: il bianco delle marcature gotiche, freddo e un po' sporco. */
  bone: material('#ddd6c4', '#fffaf0', '#9a927f', '#5d564a', '#ffffff'),
  /** Iride viola: l'unica cosa accesa addosso a un gatto tutto spento. */
  violet: material('#8b4fd0', '#c79bff', '#43206e', '#1f0c36', '#f3e6ff'),
  /** Cera del cero: opaca da spenta, e traslucida vicino alla fiamma. */
  wax: material('#d9cdb4', '#f6efdd', '#948a75', '#544e42', '#fffaf0'),
} as const satisfies Record<string, Material>;

export type MaterialName = keyof typeof MATERIAL;

/**
 * I manti dei gatti giocabili.
 *
 * Stanno qui e non in `game/cats.ts` per la stessa ragione di tutto il resto:
 * nel progetto i colori esistono in un posto solo. `cats.ts` decide *quale*
 * mantello ha un gatto e come si sblocca; qui c'è solo di che pasta è fatto.
 *
 * Valgono le stesse regole degli altri materiali — faccia illuminata più calda,
 * ombra virata al cielo — perché il gatto è illuminato dalla stessa luce di
 * tutto il mondo, e un mantello che se ne dimenticasse sembrerebbe incollato
 * sopra l'immagine invece che dentro.
 */
export const PELT = {
  /** Il gatto di sempre: crema caldo. */
  cream: MATERIAL.fur,
  /** Nerofumo: grigio di cenere, non nero pieno — il nero pieno sparisce. */
  soot: material('#3c3c46', '#70727f', '#1f1f27', '#0e0e13', '#a9adbb'),
  /** Rosso: il gatto arancione da tetto. */
  ginger: material('#c9762f', '#f2ab5f', '#8a4715', '#4d2609', '#ffd9a0'),
  /** Siamese: corpo chiarissimo... */
  siamese: material('#e8dfc8', '#fff9ea', '#b2a68a', '#6f6652', '#fffdf5'),
  /** ...e le estremità scure, che è tutto il punto del siamese. */
  siamesePoints: material('#4b392f', '#705745', '#2b1f19', '#150e0a', '#907459'),
  /** Placcato: lo stesso oro dei blocchi premio, addosso. */
  gilded: MATERIAL.gold,
  /** Spirito: azzurro di ghiaccio, trasparente. */
  spirit: material('#bed9e9', '#f2fcff', '#7ea0b9', '#4b6375', '#ffffff'),
  /** Radioattivo: verde acido che si illumina da solo. */
  neon: material('#7ee04a', '#caff9c', '#3e7b23', '#1c3e0f', '#ebffd1'),
  /** Ombra: quasi nero, con un riflesso viola sul pelo. */
  shadow: material('#27232f', '#4b4359', '#151119', '#09070d', '#9079b2'),
  /** Il mantello del Padrone, in taglia gatto. */
  master: MATERIAL.hide,
} as const satisfies Record<string, Material>;

/** Le iridi. Sono l'unica cosa che cambia davvero l'espressione di un gatto. */
export const IRIS = {
  green: MATERIAL.eye,
  amber: material('#d19a2c', '#ffdf8e', '#7d5410', '#3a2606', '#fff7dd'),
  blue: material('#4f8fd0', '#a8d6ff', '#1f4a7d', '#0c2340', '#eaf6ff'),
  ember: material('#e0503a', '#ff9d7c', '#7d1f13', '#3d0d07', '#ffd9cc'),
  gold: MATERIAL.gold,
} as const satisfies Record<string, Material>;

/**
 * Accenti dell'interfaccia e colori "non fisici".
 * Sono l'unica cosa nel gioco che non finge di essere un materiale: servono a
 * segnalare (il rosa) e a raccogliere (l'oro delle particelle).
 */
export const PALETTE = {
  ink: '#0b0d14',
  inkSoft: '#161a26',
  paper: '#f4f1ea',
  hot: '#ff2e88',
  hotDeep: '#7a0d3f',
  gold: '#f2c94c',
  goldDeep: '#8a5f14',
  /** Polvere sollevata dai passi e dagli atterraggi. */
  dust: '#c8b79c',
  wood: MATERIAL.wood.base,
  brick: MATERIAL.brick.base,
  shroom: MATERIAL.cap.base,
  fur: MATERIAL.hide.base,
  stone: MATERIAL.rock.light,
  /** Schegge di ghiaccio e neve alzata dai passi nel secondo mondo. */
  ice: MATERIAL.ice.light,
  /** Vapore dei getti: quello che si vede quando il gioco ti solleva. */
  steam: '#e7f1f8',
  /** Lana del gomitolo: l'unico oggetto del gioco che non è una trappola. */
  yarn: '#e2607f',
  /** Sabbia sollevata: dai passi, dalle correnti, da quello che ti sta ingoiando. */
  sand: '#dcc08a',
  /** Il luccichio del campo rovescio: la regola del quarto mondo, in un colore. */
  field: '#b3a4ff',
  /** Schegge di vetro e polvere di basalto della torre. */
  shard: '#dff2f8',
} as const;

// ---------------------------------------------------------------- atmosfera
export interface SkyTheme {
  /** Gradiente del cielo, dallo zenit all'orizzonte. */
  stops: readonly Stop[];
  /** Posizione del corpo celeste, in frazione di schermo. */
  sunX: number;
  sunY: number;
  sunRadius: number;
  sunCore: string;
  sunGlow: string;
  /**
   * Foschia atmosferica: colore verso cui sbiadisce tutto ciò che è lontano.
   * È l'unico trucco che dà davvero la profondità — la prospettiva aerea.
   */
  fog: string;
  /** Roccia delle creste lontane, prima che la foschia la mangi. */
  ridge: string;
  /** Vegetazione dei piani intermedi. */
  canopy: string;
  cloudLight: string;
  cloudShade: string;
  /** Tinta della luce diretta sul mondo giocabile. */
  sunTint: string;
  /** Quanto la luce diretta colora il mondo, in [0,1]. */
  sunTintAmount: number;
  /** Tinta del cielo dentro le ombre. */
  ambient: string;
  /** Quanto è densa la nebbia a terra. */
  haze: number;
  stars: boolean;
  /** Raggi crepuscolari dal sole. */
  rays: boolean;
  /**
   * C'è un paesaggio all'orizzonte, o siamo dentro qualcosa?
   * Sottoterra montagne, boschi e filari non hanno senso: al loro posto va
   * disegnata la profondità della grotta.
   */
  landscape: boolean;
  /** Cosa disegnare al posto del paesaggio quando `landscape` è false. */
  interior?: 'cave' | 'factory' | 'temple' | 'void';
  /** Nevica. La neve è deterministica come tutto il resto: non è rumore. */
  snow?: boolean;
  /**
   * Sabbia sospesa nell'aria: veli orizzontali che corrono col vento.
   *
   * È il gemello della neve e fa il lavoro opposto: la neve cade e riempie il
   * vuoto verticale, questa scorre e dice da che parte tira il vento — che nel
   * terzo mondo è un'informazione di gioco, non un effetto.
   */
  sand?: boolean;
  /** Da che parte corre la sabbia sospesa: è il vento dominante del livello. */
  sandDrift?: number;
  /** Aurora boreale: tende di luce lente sopra l'orizzonte. */
  aurora?: boolean;
}

/** Ogni mondo ha la sua ora del giorno: cielo, luce, foschia, creste. */
export const SKIES = {
  /** Mattino limpido: cielo profondo in alto, caldo verso l'orizzonte. */
  day: {
    stops: [
      { at: 0, color: '#1c5ea8' },
      { at: 0.3, color: '#4e94cd' },
      { at: 0.56, color: '#8fbfdd' },
      { at: 0.78, color: '#c8dae0' },
      { at: 1, color: '#eadfc4' },
    ],
    sunX: 0.76,
    sunY: 0.15,
    sunRadius: 34,
    sunCore: '#fffdf2',
    sunGlow: '#ffe9a8',
    fog: '#c3d4dc',
    ridge: '#5d6b80',
    canopy: '#3f6b46',
    cloudLight: '#fdfbf6',
    cloudShade: '#9fb0c4',
    sunTint: '#ffe6b8',
    sunTintAmount: 0.1,
    ambient: '#7fa6cc',
    haze: 0.32,
    stars: false,
    rays: true,
    landscape: true,
  },
  /** Tramonto: sole basso, ombre lunghe, tutto vira all'arancio. */
  sunset: {
    stops: [
      { at: 0, color: '#221a4a' },
      { at: 0.22, color: '#63356f' },
      { at: 0.45, color: '#b8506a' },
      { at: 0.66, color: '#e8825a' },
      { at: 0.85, color: '#f9b271' },
      { at: 1, color: '#ffd9a0' },
    ],
    sunX: 0.7,
    sunY: 0.56,
    sunRadius: 46,
    sunCore: '#fff3d2',
    sunGlow: '#ff9d52',
    fog: '#d98f68',
    ridge: '#6b4a63',
    canopy: '#4a3a52',
    cloudLight: '#ffd9ab',
    cloudShade: '#8e5670',
    sunTint: '#ffb070',
    sunTintAmount: 0.2,
    ambient: '#6a4a86',
    haze: 0.45,
    stars: false,
    rays: true,
    landscape: true,
  },
  /** Notte serena: luna alta, cielo che si schiarisce appena all'orizzonte. */
  night: {
    stops: [
      { at: 0, color: '#04060e' },
      { at: 0.35, color: '#0b1330' },
      { at: 0.68, color: '#182146' },
      { at: 0.9, color: '#2b3260' },
      { at: 1, color: '#3d4270' },
    ],
    sunX: 0.78,
    sunY: 0.17,
    sunRadius: 26,
    sunCore: '#f2f6ff',
    sunGlow: '#9fb6ee',
    fog: '#2b3660',
    ridge: '#2c3557',
    canopy: '#1b2440',
    cloudLight: '#7d8cbc',
    cloudShade: '#242c4e',
    sunTint: '#9db6f0',
    sunTintAmount: 0.16,
    ambient: '#31406e',
    haze: 0.38,
    stars: true,
    rays: false,
    landscape: true,
  },
  /**
   * Prima alba: luce bassa e fredda, il sole non ha ancora scaldato niente.
   * Il contrario del tramonto — stessi colori bassi, ma virati al verde e al
   * grigio invece che all'arancio.
   */
  dawn: {
    stops: [
      { at: 0, color: '#12294f' },
      { at: 0.28, color: '#2c5678' },
      { at: 0.52, color: '#5d8590' },
      { at: 0.76, color: '#a9b39a' },
      { at: 1, color: '#e6cfa6' },
    ],
    sunX: 0.24,
    sunY: 0.62,
    sunRadius: 30,
    sunCore: '#fff6e0',
    sunGlow: '#ffcf8e',
    fog: '#b9c2b4',
    ridge: '#4e6272',
    canopy: '#3c5a52',
    cloudLight: '#f2e3cd',
    cloudShade: '#6f7f8a',
    sunTint: '#ffd9a6',
    sunTintAmount: 0.13,
    ambient: '#4d6a86',
    haze: 0.5,
    stars: false,
    rays: true,
    landscape: true,
  },
  /**
   * Temporale: cielo di piombo, nessun sole, orizzonte mangiato dall'acqua.
   * È il cielo più scuro che il gioco abbia sopra la terra, e serve a rendere
   * i piani lontani inutili: qui il paesaggio non aiuta a orientarsi.
   */
  storm: {
    stops: [
      { at: 0, color: '#141826' },
      { at: 0.34, color: '#252c3d' },
      { at: 0.62, color: '#3a4252' },
      { at: 0.85, color: '#525a66' },
      { at: 1, color: '#6d7079' },
    ],
    sunX: 0.42,
    sunY: 0.22,
    sunRadius: 18,
    sunCore: '#c9d2e0',
    sunGlow: '#7d8798',
    fog: '#5b626e',
    ridge: '#3a4252',
    canopy: '#2b3440',
    cloudLight: '#8b93a2',
    cloudShade: '#1c2130',
    sunTint: '#9aa6bc',
    sunTintAmount: 0.08,
    ambient: '#3d4756',
    haze: 0.62,
    stars: false,
    rays: false,
    landscape: true,
  },
  /** Grotta: nessun cielo, solo umidità e una luce che non si sa da dove venga. */
  cave: {
    stops: [
      { at: 0, color: '#05060a' },
      { at: 0.45, color: '#100f18' },
      { at: 0.8, color: '#1d1722' },
      { at: 1, color: '#2a1f2e' },
    ],
    sunX: 0.5,
    sunY: 0.1,
    sunRadius: 14,
    sunCore: '#ffd9a8',
    sunGlow: '#ff8a3c',
    fog: '#221a2c',
    ridge: '#241e30',
    canopy: '#181322',
    cloudLight: '#3a2e44',
    cloudShade: '#150f1c',
    sunTint: '#ff9d52',
    sunTintAmount: 0.14,
    ambient: '#2a2038',
    haze: 0.55,
    stars: false,
    rays: false,
    landscape: false,
    interior: 'cave',
  },

  // ---------------------------------------------------------------- mondo 2
  /**
   * Gelo diurno: sole basso e bianco che non scalda niente, cielo lattiginoso,
   * neve che cade piano. Il contrario esatto del mattino di 1-1 — stessa ora
   * del giorno, nessun calore.
   */
  frost: {
    stops: [
      { at: 0, color: '#4d7fa8' },
      { at: 0.32, color: '#83aec9' },
      { at: 0.6, color: '#b9d2e0' },
      { at: 0.82, color: '#dee9ef' },
      { at: 1, color: '#f2f5f5' },
    ],
    sunX: 0.28,
    sunY: 0.2,
    sunRadius: 30,
    sunCore: '#ffffff',
    sunGlow: '#dbeaf6',
    fog: '#dfe9f0',
    ridge: '#6f8296',
    canopy: '#41586a',
    cloudLight: '#ffffff',
    cloudShade: '#a8bccd',
    sunTint: '#e8f3ff',
    sunTintAmount: 0.12,
    ambient: '#8fb0cc',
    haze: 0.42,
    stars: false,
    rays: true,
    landscape: true,
    snow: true,
  },
  /**
   * Notte polare: l'aurora fa più luce della luna, e la fa del colore
   * sbagliato. È il cielo più bello del gioco, e serve a distrarre.
   */
  aurora: {
    stops: [
      { at: 0, color: '#03060f' },
      { at: 0.34, color: '#08182e' },
      { at: 0.66, color: '#0e2c45' },
      { at: 0.88, color: '#1b4258' },
      { at: 1, color: '#2c5a66' },
    ],
    sunX: 0.2,
    sunY: 0.14,
    sunRadius: 22,
    sunCore: '#eef7ff',
    sunGlow: '#8fd4d0',
    fog: '#1d4356',
    ridge: '#22415a',
    canopy: '#14293c',
    cloudLight: '#6fa7b4',
    cloudShade: '#152c40',
    sunTint: '#93e0d2',
    sunTintAmount: 0.18,
    ambient: '#1f4a63',
    haze: 0.4,
    stars: true,
    rays: false,
    landscape: true,
    snow: true,
    aurora: true,
  },
  /**
   * Dentro la fabbrica: niente cielo, niente foschia, solo lamiera e la luce
   * arancione dei forni che filtra da qualche parte in fondo.
   */
  foundry: {
    stops: [
      { at: 0, color: '#0a0c12' },
      { at: 0.42, color: '#141821' },
      { at: 0.76, color: '#1e242e' },
      { at: 1, color: '#2b2822' },
    ],
    sunX: 0.5,
    sunY: 0.12,
    sunRadius: 16,
    sunCore: '#ffd7a0',
    sunGlow: '#ff7a2f',
    fog: '#232a35',
    ridge: '#2a323e',
    canopy: '#1a1f28',
    cloudLight: '#3d4653',
    cloudShade: '#13171e',
    sunTint: '#ffa657',
    sunTintAmount: 0.16,
    ambient: '#2b3340',
    haze: 0.5,
    stars: false,
    rays: false,
    landscape: false,
    interior: 'factory',
  },

  // ---------------------------------------------------------------- mondo 3
  /**
   * Mezzogiorno nel deserto: il cielo più chiaro del gioco.
   *
   * È l'opposto esatto della grotta di 1-2 e della fabbrica di 2-8 — lì non si
   * vedeva niente perché era buio, qui non si vede niente perché c'è troppa
   * luce e troppa sabbia in sospensione. Il sole sta quasi allo zenit, quindi
   * le ombre sono corte e non aiutano a leggere le distanze: un buco a otto
   * metri e un buco a due si assomigliano parecchio.
   */
  desert: {
    stops: [
      { at: 0, color: '#2f6fa8' },
      { at: 0.3, color: '#79aac4' },
      { at: 0.58, color: '#c3ccb8' },
      { at: 0.8, color: '#e8d3a0' },
      { at: 1, color: '#f6dfae' },
    ],
    sunX: 0.6,
    sunY: 0.08,
    sunRadius: 38,
    sunCore: '#fffdf0',
    sunGlow: '#ffe08a',
    fog: '#e3cfa4',
    ridge: '#a58256',
    canopy: '#c9a367',
    cloudLight: '#fdf3dd',
    cloudShade: '#c2a887',
    sunTint: '#ffe3a8',
    sunTintAmount: 0.16,
    ambient: '#b79a72',
    haze: 0.58,
    stars: false,
    rays: true,
    landscape: true,
    sand: true,
    sandDrift: 1,
  },
  /**
   * La tempesta di sabbia: lo stesso deserto, con l'aria piena.
   *
   * Il sole c'è ancora ma è un disco senza raggi, i piani lontani spariscono
   * quasi del tutto nella foschia (`haze` è il valore più alto del gioco) e la
   * sabbia sospesa corre veloce e verso sinistra — cioè controvento rispetto a
   * dove sta andando il gatto, che è un'informazione e non un effetto: in
   * questo livello le correnti contrarie sono la regola e quelle a favore
   * l'eccezione, e si vede prima di saltare.
   */
  sandstorm: {
    stops: [
      { at: 0, color: '#7a5f3c' },
      { at: 0.3, color: '#a8804f' },
      { at: 0.6, color: '#c79a63' },
      { at: 0.82, color: '#d9b07c' },
      { at: 1, color: '#e6c495' },
    ],
    sunX: 0.34,
    sunY: 0.22,
    sunRadius: 30,
    sunCore: '#ffe9b0',
    sunGlow: '#e0a25a',
    fog: '#cfa976',
    ridge: '#8d6b45',
    canopy: '#b08a5c',
    cloudLight: '#e8d0a6',
    cloudShade: '#8a6743',
    sunTint: '#ffcf90',
    sunTintAmount: 0.2,
    ambient: '#8f6f4c',
    haze: 0.78,
    stars: false,
    rays: false,
    landscape: true,
    sand: true,
    sandDrift: -1,
  },
  /**
   * Dentro il tempio: nessun cielo, nessuna foschia, solo pietra e la luce che
   * scende dai lucernari insabbiati.
   *
   * La grotta era nera e la fabbrica era grigia; qui il buio è **caldo**, e
   * quello che si intravede in fondo non è roccia né macchine ma colonne
   * allineate — cioè qualcosa che qualcuno ha costruito e poi lasciato.
   */
  tomb: {
    stops: [
      { at: 0, color: '#0d0a08' },
      { at: 0.42, color: '#1c1510' },
      { at: 0.76, color: '#2b2018' },
      { at: 1, color: '#392a1d' },
    ],
    sunX: 0.5,
    sunY: 0.1,
    sunRadius: 18,
    sunCore: '#ffeec4',
    sunGlow: '#ffc266',
    fog: '#2c2118',
    ridge: '#403020',
    canopy: '#241a13',
    cloudLight: '#5a4531',
    cloudShade: '#161009',
    sunTint: '#ffcc80',
    sunTintAmount: 0.15,
    ambient: '#33271c',
    haze: 0.52,
    stars: false,
    rays: false,
    landscape: false,
    interior: 'temple',
  },

  // ---------------------------------------------------------------- mondo 4
  /**
   * In cima alla torre, sopra il livello delle nuvole.
   *
   * È il cielo più alto del gioco e l'unico in cui l'orizzonte è **sotto**: le
   * creste lontane sono le stesse montagne di 1-1 viste da mille metri più su,
   * e la foschia se le mangia quasi del tutto. Serve a una cosa sola, ed è la
   * più importante del quarto mondo: far capire quanto è lunga la caduta prima
   * ancora che cominci.
   */
  spire: {
    stops: [
      { at: 0, color: '#0a1030' },
      { at: 0.26, color: '#1c3a72' },
      { at: 0.52, color: '#4f7fb8' },
      { at: 0.78, color: '#9fc0d8' },
      { at: 1, color: '#dfe6ee' },
    ],
    sunX: 0.72,
    sunY: 0.72,
    sunRadius: 34,
    sunCore: '#fffbef',
    sunGlow: '#ffd39a',
    fog: '#c6d6e4',
    ridge: '#516a86',
    canopy: '#3e556d',
    cloudLight: '#ffffff',
    cloudShade: '#8ba2bb',
    sunTint: '#ffe4c0',
    sunTintAmount: 0.12,
    ambient: '#5d80ac',
    haze: 0.66,
    stars: true,
    rays: true,
    landscape: true,
  },
  /**
   * Il Rovescio: quello che c'è sotto la torre, che è di nuovo cielo.
   *
   * Non è una grotta, non è una fabbrica e non è un tempio — è un **vuoto**, e
   * dentro ci galleggia altra torre, capovolta. La profondità qui non la dà né
   * la foschia né il buio ma il fatto che tutto quello che si intravede
   * lontano pende dalla parte sbagliata: è l'unico fondale del gioco che dice
   * una regola invece di raccontare un posto.
   */
  reverse: {
    stops: [
      { at: 0, color: '#241c3e' },
      { at: 0.36, color: '#191434' },
      { at: 0.7, color: '#100e26' },
      { at: 1, color: '#080814' },
    ],
    sunX: 0.5,
    sunY: 0.86,
    sunRadius: 24,
    sunCore: '#e6dcff',
    sunGlow: '#8f6fe0',
    fog: '#241d40',
    ridge: '#2b2450',
    canopy: '#1a1636',
    cloudLight: '#4a3d76',
    cloudShade: '#120f26',
    sunTint: '#a68cf0',
    sunTintAmount: 0.17,
    ambient: '#2a2350',
    haze: 0.48,
    stars: true,
    rays: false,
    landscape: false,
    interior: 'void',
  },
} as const satisfies Record<string, SkyTheme>;

export type SkyName = keyof typeof SKIES;

// ---------------------------------------------------------------- colore
/** Nero semitrasparente riutilizzabile per ombre e incassi. */
export const shade = (alpha: number): string => `rgba(0,0,0,${alpha})`;

/** Bianco semitrasparente: luci speculari e velature. */
export const glare = (alpha: number): string => `rgba(255,255,255,${alpha})`;

/** Tetto delle cache di colore: oltre, si riparte da zero. */
const MAX_CACHE = 2048;

const hexCache = new Map<string, readonly [number, number, number]>();

/**
 * Scompone un colore nei tre canali.
 *
 * Accetta sia `#rgb`/`#rrggbb` sia la forma `rgb(...)`/`rgba(...)`, e questo
 * non è un vezzo: `mix` restituisce `rgb(...)`, quindi senza saperlo rileggere
 * ogni colore ottenuto da una miscela precedente collasserebbe a nero non
 * appena lo si miscela di nuovo — ed è esattamente il caso della prospettiva
 * aerea, che impila una miscela sull'altra.
 *
 * Memoizzata: si chiama a raffica.
 */
const channels = (color: string): readonly [number, number, number] => {
  const cached = hexCache.get(color);
  if (cached) return cached;

  let r = 0;
  let g = 0;
  let b = 0;

  if (color.startsWith('#')) {
    if (color.length === 7) {
      r = parseInt(color.slice(1, 3), 16);
      g = parseInt(color.slice(3, 5), 16);
      b = parseInt(color.slice(5, 7), 16);
    } else if (color.length === 4) {
      r = parseInt((color[1] ?? '0').repeat(2), 16);
      g = parseInt((color[2] ?? '0').repeat(2), 16);
      b = parseInt((color[3] ?? '0').repeat(2), 16);
    }
  } else {
    const parts = color.slice(color.indexOf('(') + 1, color.lastIndexOf(')')).split(',');
    r = Number(parts[0]);
    g = Number(parts[1]);
    b = Number(parts[2]);
  }

  const rgb = [
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
  ] as const;
  // Le miscele producono colori sempre nuovi, quindi questa cache non ha un
  // limite naturale: in una partita lunga crescerebbe per sempre. Oltre il
  // tetto si riparte, e le combinazioni calde si riscaldano in due frame.
  if (hexCache.size >= MAX_CACHE) hexCache.clear();
  hexCache.set(color, rgb);
  return rgb;
};

const mixCache = new Map<string, string>();

/**
 * Fonde due colori. È il motore della prospettiva aerea: ogni piano dello
 * sfondo è il suo colore proprio miscelato con la foschia in proporzione alla
 * distanza. Memoizzata perché le combinazioni utili sono poche decine.
 */
export const mix = (from: string, to: string, t: number): string => {
  const amount = t < 0 ? 0 : t > 1 ? 1 : t;
  const key = `${from}|${to}|${amount.toFixed(3)}`;
  const cached = mixCache.get(key);
  if (cached) return cached;

  const [r1, g1, b1] = channels(from);
  const [r2, g2, b2] = channels(to);
  const r = Math.round(r1 + (r2 - r1) * amount);
  const g = Math.round(g1 + (g2 - g1) * amount);
  const b = Math.round(b1 + (b2 - b1) * amount);
  const value = `rgb(${r},${g},${b})`;
  if (mixCache.size >= MAX_CACHE) mixCache.clear();
  mixCache.set(key, value);
  return value;
};

/**
 * Stesso colore, con trasparenza.
 *
 * È la funzione più chiamata di tutto il gioco: un migliaio di volte per
 * frame, cioè sessantamila stringhe al secondo buttate via appena create. Non
 * è un costo di calcolo — è carburante per il garbage collector, e ogni tanto
 * il garbage collector si prende il suo millisecondo proprio mentre il gatto è
 * a mezz'aria.
 *
 * La cache è annidata (colore -> opacità -> stringa) e non concatenata,
 * perché una chiave del tipo `${hex}|${a}` sarebbe una stringa nuova a ogni
 * chiamata: si risparmierebbe il risultato e si butterebbe via la chiave, cioè
 * niente. Così invece un colore già visto non alloca proprio niente.
 */
const alphaCache = new Map<string, Map<number, string>>();

export const alpha = (hex: string, a: number): string => {
  let shades = alphaCache.get(hex);
  if (!shades) {
    if (alphaCache.size >= MAX_CACHE) alphaCache.clear();
    shades = new Map();
    alphaCache.set(hex, shades);
  }

  const cached = shades.get(a);
  if (cached !== undefined) return cached;

  const [r, g, b] = channels(hex);
  const value = `rgba(${r},${g},${b},${a})`;
  if (shades.size >= MAX_CACHE) shades.clear();
  shades.set(a, value);
  return value;
};

/** Schiarisce (t > 0) o scurisce (t < 0) un colore. */
export const shift = (hex: string, t: number): string =>
  t >= 0 ? mix(hex, '#ffffff', t) : mix(hex, '#000000', -t);
