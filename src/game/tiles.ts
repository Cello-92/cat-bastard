/**
 * Vocabolario dei tile: il singolo posto che dà significato ai caratteri
 * usati nelle mappe ASCII dei livelli.
 *
 * Aggiungere un tile significa: (1) una voce in TILE, (2) la sua semantica qui
 * sotto, (3) il suo disegno in game/render/tiles.ts. Nient'altro.
 */

export const TILE = {
  EMPTY: ' ',
  /** Terreno solido. */
  GROUND: '#',
  /** Roccia nuda: solida, senza manto erboso. */
  ROCK: 'R',
  /**
   * Terreno identico a quello vero che sparisce sotto le zampe.
   * Il tradimento più puro del genere: il pavimento.
   */
  FAKE_GROUND: 'V',
  /** Tubo: solido, decorativo. */
  PIPE: 'P',
  /** Blocco "?" che sembra un premio e sputa un fungo ostile. */
  PRIZE: 'B',
  /** Blocco "?" onesto: dà davvero una moneta. Esiste per creare il dubbio. */
  HONEST: 'Q',
  /** Blocco già usato. */
  USED: 'U',
  /** Blocco invisibile: compare solo quando ci sbatti contro. */
  INVISIBLE: 'I',
  /** Mattone che, quando gli passi sotto, fa cadere una stalattite. */
  TRAP_BRICK: 'T',
  /** Piattaforma che si sbriciola poco dopo che ci sali. */
  CRUMBLE: 'D',
  /** Spuntoni: morte al contatto. */
  SPIKES: 'X',
  /** Spuntoni appesi al soffitto: uccidono chi salta senza guardare in alto. */
  CEILING_SPIKES: 'Y',
  /** Spuntoni a scatto: escono dal pavimento quando ti avvicini. */
  POP_SPIKES: 'A',
  /** Molla: ti lancia molto più in alto di un salto. Di solito verso qualcosa. */
  SPRING: 'M',
  /** Moneta raccoglibile. */
  COIN: 'C',
  /**
   * Moneta identica a `C` che invece di darti un punto ti ammazza.
   * Nessun segno, nessun colore diverso: si scopre raccogliendola.
   */
  LURE_COIN: 'E',
  /** Bandiera finta: uccide. */
  FAKE_FLAG: 'F',
  /** Arrivo vero. */
  GOAL: 'W',
  /** Checkpoint. */
  CHECKPOINT: 'S',
  /** Checkpoint identico a `S`. Toccarlo uccide. La lanterna non si accende mai. */
  FAKE_CHECKPOINT: 'N',
  /**
   * Molla identica a `M`, con la stessa piastra e lo stesso piattello rosso.
   * Non lancia niente: si chiude di scatto. È una tagliola travestita da aiuto.
   */
  TRAP_SPRING: 'm',

  // --- Trappole senza preavviso: la prima volta ammazzano e basta.
  /** Masso indistinguibile dal soffitto che crolla nell'istante in cui passi sotto. */
  COLLAPSE: 'K',
  /** Piattaforma solida che sparisce appena la sfiori. Non trema, non avvisa. */
  GHOST: 'L',
  /** Spuntoni nascosti nel terreno: schizzano fuori istantaneamente, senza feritoia. */
  SNAP_SPIKES: 'O',
  /**
   * Spuntoni invisibili: non c'è niente da vedere finché non ti uccidono.
   * Dopo la prima morte restano visibili per tutto il tentativo, così la
   * seconda volta la trappola è evitabile — che è l'unica regola che resta.
   */
  HIDDEN_SPIKES: '!',
  /**
   * Corrente morta: stesse strisce di sabbia, stesso verso, stesso fischio.
   * Non spinge.
   *
   * È il getto spento del terzo mondo, e non è una ripetizione: là ci si
   * buttava dentro per essere sollevati, qui ci si butta *attraverso* contando
   * su una spinta laterale che non arriva — e in aria, quando ci si accorge che
   * manca, non c'è più niente da fare.
   */
  DEAD_WIND: 'w',
  /**
   * La stessa corrente morta, disegnata verso sinistra.
   *
   * Due caratteri per la stessa identica cosa (cioè per niente) perché il verso
   * *disegnato* è l'unica parte di questa trappola che conta: una corrente che
   * sembra contraria fa saltare più forte, una che sembra a favore fa saltare
   * più piano, e sono due morti diverse — si finisce corti nel primo caso e
   * lunghi nel secondo. Lasciare la scelta a un rumore per cella voleva dire
   * non poterla progettare.
   */
  DEAD_WIND_LEFT: 'q',

  // --- Mondo 2: il ghiaccio e la fabbrica. Vocabolario tutto suo.
  /**
   * Terreno innevato: si comporta esattamente come `#`, e infatti è il
   * pavimento onesto del secondo mondo. Cambia solo il manto — neve al posto
   * dell'erba — perché un mondo nuovo che riusa il terreno del vecchio non
   * sembra un mondo nuovo.
   */
  SNOW: '+',
  /**
   * Ghiaccio: solido come il terreno, ma non ti tiene.
   * Non è una trappola nascosta — si vede benissimo che è ghiaccio. È una
   * regola nuova: da qui in poi fermarsi costa più che partire.
   */
  ICE: '~',
  /**
   * Ghiaccio sottile: identico a `~` finché non ci sali. Poi si crepa e cede.
   * Ha il suo preavviso (le crepe), come l'asse marcia del primo mondo.
   */
  BRITTLE_ICE: ';',
  /** Piastra d'acciaio: il pavimento della fabbrica. Solida e onesta. */
  STEEL: '=',
  /** Nastro trasportatore verso destra: ti porta dove vuole lui. */
  BELT_RIGHT: '>',
  /** Nastro trasportatore verso sinistra. Di solito verso qualcosa di brutto. */
  BELT_LEFT: '<',
  /** Getto di vapore: non è solido, ti solleva finché ci resti dentro. */
  VENT: '^',
  /**
   * Getto identico al precedente, stesso vapore, stesso rumore: non spinge.
   * Nessun modo di distinguerlo prima. Dopo, sì: sei caduto dentro.
   */
  DEAD_VENT: ',',

  // --- Mondo 3: il deserto e il tempio. Qui a cambiare non è il pavimento: è
  //     l'aria. Il mondo 2 aveva superfici che rispondevano in modo diverso
  //     sotto le zampe; qui ci sono correnti che spostano il gatto mentre è a
  //     mezz'aria, cioè nell'unico momento in cui non poteva farci niente.
  /**
   * Sabbia compatta: il pavimento onesto del deserto.
   * Si comporta esattamente come `#` e come `+`. Cambia solo il manto — dune
   * increspate dal vento invece di erba o neve.
   */
  SAND: '.',
  /** Arenaria: la pietra del tempio, squadrata e incisa. Solida e onesta. */
  SANDSTONE: '-',
  /**
   * Corrente d'aria verso destra.
   *
   * È l'esatto contrario del nastro trasportatore: quello sposta chi ci
   * cammina sopra, questa sposta chi **non tocca terra**. A terra gli artigli
   * tengono e il vento non conta niente; in aria non c'è niente a cui
   * aggrapparsi, e il salto che avevi calcolato arriva da un'altra parte.
   */
  WIND_RIGHT: ')',
  /** Corrente d'aria verso sinistra. Di solito verso qualcosa. */
  WIND_LEFT: '(',
  /**
   * Risucchio: una colonna di sabbia che cade.
   *
   * Il gemello capovolto del getto di vapore del mondo 2. Quello ti solleva
   * finché ci resti dentro, questo ti schiaccia: il salto pieno dentro un
   * risucchio arriva a metà altezza, sempre alla stessa metà.
   */
  DOWNDRAFT: 'v',
  /**
   * Sabbie mobili.
   *
   * Non sono solide e non uccidono di per sé: rallentano. Dentro si affonda
   * piano, ci si muove piano, e si risale solo a bracciate — è l'unica cosa
   * del gioco che si nuota, ed è vocabolario di Mario tanto quanto la molla.
   * Quello che uccide è il fondo, e sotto le pozze di solito non c'è fondo.
   */
  QUICKSAND: 's',
  /**
   * Piastra a pressione del tempio.
   *
   * L'unica trappola del gioco che succede **da un'altra parte**: pestarla non
   * fa niente lì dove sei, fa venire giù il soffitto più avanti. Si vede
   * benissimo — è una lastra con la fuga tutt'intorno — e il tradimento non è
   * che sia nascosta: è che quando capisci a cosa serviva stai già correndo
   * sotto la parte di corridoio che hai appena sganciato.
   */
  PLATE: 'p',

  // --- Mondo 4: la torre e il Rovescio. Il mondo 2 ha cambiato il pavimento,
  //     il mondo 3 ha cambiato l'aria, e qui cambia **il basso**. È la cosa più
  //     radicale che il gioco faccia alla fisica e insieme la più semplice da
  //     dire: dentro un campo rovescio la gravità punta in su, e il gatto
  //     cammina sul soffitto. I comandi non cambiano di una virgola — destra
  //     resta destra, il salto resta il salto — cambia solo da che parte si
  //     cade, e si vede prima di entrarci.
  /**
   * Vetro temprato: il pavimento onesto della torre.
   *
   * Si comporta esattamente come `#`, `+` e `.`: solido e basta. Cambia solo
   * che è trasparente, e questo è deliberato — in un mondo dove si cammina
   * anche a testa in giù, un pavimento attraverso cui si vede quello che c'è
   * dall'altra parte è l'unico modo di far capire dove si finirà.
   */
  GLASS: 'o',
  /** Basalto: la pietra nera del Rovescio. Solida e onesta come il vetro. */
  BASALT: 'b',
  /**
   * Campo rovescio: finché lo tocchi, il basso è in su.
   *
   * Non è una spinta e non è un getto: è la gravità che cambia segno. Dentro,
   * il gatto cade verso il soffitto, ci atterra, ci cammina e ci salta —
   * all'ingiù. Fuori torna tutto come prima, e passare da dentro a fuori è
   * l'unica cosa che il quarto mondo chiede di imparare.
   *
   * Regola di composizione: il campo **inverte**, non impone. Se la stanza è
   * già capovolta (l'arena di 4-11), un campo rovescio la rimette diritta.
   */
  REVERSE: 'u',
  /**
   * Lo stesso campo, spento.
   *
   * Stesso luccichio, stesso ronzio, stessa polvere che sale: non inverte
   * niente. È il getto spento del mondo 2 e la corrente morta del mondo 3
   * portati alla loro conclusione — qui non ti manca una spinta, ti manca il
   * pavimento su cui contavi di atterrare, che era il soffitto.
   */
  DEAD_REVERSE: 'n',

  // --- Segreti: non uccidono, si nascondono.
  /** Parete d'acciaio attraversabile: dietro c'è sempre qualcosa. */
  FAKE_WALL: ':',
  /**
   * La stessa cosa, in arenaria: la parete finta del tempio.
   *
   * Esiste perché una lamiera d'acciaio in mezzo alla pietra sarebbe un
   * cartello luminoso con scritto "di qua": il muro finto funziona solo se è
   * fatto della stessa roba di tutti gli altri muri della stanza.
   */
  FAKE_STONE: '/',
  /**
   * E la stessa cosa in basalto: la parete finta del Rovescio.
   *
   * Vale la ragione di sempre — un muro finto funziona solo se è fatto della
   * stessa roba di tutti gli altri muri della stanza. Qui però c'è un motivo in
   * più: metà delle stanze del quarto mondo si attraversano a testa in giù, e
   * una parete che si nota è una parete che si nota anche capovolta.
   */
  FAKE_BASALT: '_',
  /** Gomitolo: uno per livello, ben nascosto. Sblocca i gatti. */
  YARN: '*',

  // --- Roba del boss: esiste solo dentro l'arena di 1-11.
  /**
   * Mattone del soffitto dell'arena.
   *
   * È l'unica arma che il gatto ha contro il Padrone, ed è anche l'unico posto
   * in cui il gioco chiede al giocatore di fidarsi di una piattaforma che sta
   * per cedere: ci sali sopra, quello trema, e poco dopo si stacca portandosi
   * dietro tutto il peso della muratura. Dove cade non lo decide lui.
   */
  BOSS_BRICK: '?',
  /**
   * Il portone in fondo all'arena: solido finché il boss è vivo, aperto
   * nell'istante in cui smette di esserlo. Non è una trappola, è una serratura.
   * Lo usano tutte e due le arene: una serratura è una serratura.
   */
  BOSS_GATE: '|',

  // --- La cappella di 2-11: l'attrezzatura dello scontro con Gothic Lucio.
  /**
   * Cero votivo.
   *
   * Non è solido, non uccide, non si raccoglie: è un'**incudine**. Gothic Lucio
   * vive appeso alla volta e si tuffa dritto verso il punto in cui eri; se il
   * tuffo finisce dentro un cero acceso, gli prende fuoco il mantello e si
   * spegne una gemma. Non c'è nessun altro modo di fargli male.
   *
   * È l'inverso esatto dell'arma del Padrone: là si portava *lui* sotto il
   * mattone, qui si porta *sé stessi* sopra la fiamma e lo si lascia arrivare.
   * Il cero su cui atterra si spegne — schiacciato — e si riaccende da solo
   * dopo un po', per la stessa ragione per cui il soffitto dell'arena si
   * ricompone: un'arena senza armi non è una partita persa, è una partita
   * finita.
   */
  CANDLE: '"',

  // --- Marcatori: rimossi dalla griglia al caricamento e sostituiti da entità.
  /** Nemico che cammina, schiacciabile. */
  WALKER: 'G',
  /** Nemico identico al precedente ma con le punte sotto. Buona fortuna. */
  EVIL_WALKER: 'J',
  /** Bestia appesa in alto che si tuffa quando le passi sotto. */
  DIVER: 'Z',
  /** Sentinella corazzata: cammina piano, poi ti carica. Non si schiaccia. */
  SENTRY: 'H',
  /** Drone: vola su una rotta fissa. Schiacciarlo funziona, e a volte serve. */
  DRONE: '%',
  /** Palla di ghiaccio: quando entri nel suo raggio, rotola verso di te. */
  SNOWBALL: '&',
  /**
   * Scarabeo: vola piano e si fa portare dalle correnti come il gatto.
   *
   * È il nemico del mondo 3 ed è anche il suo strumento di lettura: dove va
   * uno scarabeo, va il vento. Si schiaccia.
   */
  SCARAB: 'k',
  /** Il Padrone: il boss di 1-11. Ne esiste uno solo per livello. */
  BOSS: '@',
  /**
   * Gothic Lucio: il boss di 2-11.
   *
   * Il marcatore va messo **sotto la volta**, non sul pavimento: Lucio nasce
   * appeso a testa in giù e sul pavimento non ci mette piede se non per
   * sbaglio, che è tutto il combattimento.
   */
  GOTHIC_BOSS: '$',
  /**
   * La Sfinge: il boss di 3-11.
   *
   * Il marcatore va messo **sul pavimento**, come quello del Padrone: lei nasce
   * sepolta lì sotto e il pavimento su cui poggia il marcatore è il filo a cui
   * torna sempre — quello che romperà, e quello in cui resterà conficcata.
   */
  SPHINX: '0',
  /**
   * Il ragno di vetro: cammina sulle superfici, tutte quante.
   *
   * È il nemico del quarto mondo perché è l'unico che non si accorge di come
   * sia messa la gravità: sta attaccato con le zampe e basta. Nasce sulla
   * superficie che ha vicino — pavimento o soffitto — e la percorre avanti e
   * indietro, girandosi ai muri e sui bordi. Si schiaccia, ma per schiacciarlo
   * bisogna arrivarci **dalla sua parte**, e sul soffitto quello vuol dire
   * essere capovolti.
   */
  SPIDER: 'a',
  /**
   * La zavorra: un peso di ferro che obbedisce al campo, non a te.
   *
   * È il campo rovescio reso visibile, ed è il suo mestiere — come lo
   * scarabeo era il vento. Cade nel verso in cui il campo la manda e si ferma
   * dove arriva, quindi una zavorra appoggiata al soffitto dice "questo campo è
   * vero" e una zavorra rimasta a terra sotto un campo che luccica dice
   * "questo campo è spento". Chi le guarda prima di saltare non muore.
   * Toccarla uccide, schiacciarla no: pesa una tonnellata.
   */
  BALLAST: 'z',
  /**
   * Il pendolo: l'unico congegno del gioco che si muove da solo.
   *
   * Sta appeso al perno in cui è disegnato e oscilla sempre uguale, con lo
   * stesso periodo e la stessa ampiezza, ripartendo dallo stesso punto a ogni
   * rinascita: si impara a memoria come tutto il resto. Il verso in cui pende
   * è quello del campo sotto il perno — dentro un campo rovescio oscilla
   * **verso l'alto**, ed è la cosa che convince il giocatore che qui il basso
   * è davvero un'altra cosa.
   */
  PENDULUM: 't',
  /**
   * Il Rovescio: il boss di 4-11.
   *
   * Il marcatore va messo **sul pavimento**, come quello del Padrone e della
   * Sfinge: lui ci cammina sopra. Quello che fa non è muoversi — è ribaltare
   * la stanza, e con la stanza tutto quello che c'è dentro.
   */
  ROVESCIO: '1',
} as const;

export type TileChar = (typeof TILE)[keyof typeof TILE];

/** Tile contro cui si collide. */
const SOLID = new Set<string>([
  TILE.GROUND,
  TILE.SNOW,
  TILE.ROCK,
  TILE.FAKE_GROUND,
  TILE.GHOST,
  TILE.COLLAPSE,
  TILE.PIPE,
  TILE.PRIZE,
  TILE.HONEST,
  TILE.USED,
  TILE.INVISIBLE,
  TILE.TRAP_BRICK,
  TILE.CRUMBLE,
  TILE.ICE,
  TILE.BRITTLE_ICE,
  TILE.STEEL,
  TILE.BELT_RIGHT,
  TILE.BELT_LEFT,
  TILE.SAND,
  TILE.SANDSTONE,
  TILE.PLATE,
  TILE.GLASS,
  TILE.BASALT,
  TILE.BOSS_BRICK,
  TILE.BOSS_GATE,
]);

/** Tile che al contatto uccidono, sempre e comunque. */
const DEADLY = new Set<string>([
  TILE.SPIKES,
  TILE.CEILING_SPIKES,
  TILE.FAKE_FLAG,
  TILE.LURE_COIN,
  TILE.FAKE_CHECKPOINT,
  TILE.TRAP_SPRING,
]);

/** Tile che vengono convertiti in entità al caricamento del livello. */
const SPAWNERS = new Set<string>([
  TILE.WALKER,
  TILE.EVIL_WALKER,
  TILE.DIVER,
  TILE.SENTRY,
  TILE.DRONE,
  TILE.SNOWBALL,
  TILE.SCARAB,
  TILE.SPIDER,
  TILE.BALLAST,
  TILE.PENDULUM,
  TILE.BOSS,
  TILE.GOTHIC_BOSS,
  TILE.SPHINX,
  TILE.ROVESCIO,
]);

/**
 * Tile disegnati come massa di terreno.
 * Serve al disegno per sapere dove il suolo continua e dove invece è esposto
 * al cielo: l'erba e i bordi illuminati nascono da qui.
 */
const EARTH = new Set<string>([
  TILE.GROUND,
  TILE.SNOW,
  TILE.ROCK,
  TILE.FAKE_GROUND,
  TILE.GHOST,
  TILE.COLLAPSE,
]);

/** Ghiaccio: una superficie, non una trappola. Si distingue a vista. */
const ICY = new Set<string>([TILE.ICE, TILE.BRITTLE_ICE]);

/**
 * Lamiera della fabbrica. Ci sta dentro anche la parete finta, ed è il punto:
 * deve saldarsi alle altre esattamente come farebbe una parete vera.
 */
const METAL = new Set<string>([
  TILE.STEEL,
  TILE.BELT_RIGHT,
  TILE.BELT_LEFT,
  TILE.FAKE_WALL,
]);

/**
 * Muratura del tempio. Ci sta dentro la parete finta, per lo stesso motivo per
 * cui la lamiera finta sta nel metallo: deve saldarsi alle vere esattamente
 * come farebbero fra loro, o il segreto si vede da mezzo schermo.
 */
const MASONRY = new Set<string>([TILE.SANDSTONE, TILE.FAKE_STONE, TILE.PLATE]);

/**
 * Basalto del Rovescio. Ci sta dentro la parete finta, per la stessa ragione
 * per cui ci sta nella lamiera e nella muratura: deve saldarsi alle vere.
 */
const VOLCANIC = new Set<string>([TILE.BASALT, TILE.FAKE_BASALT]);

export const isSolid = (tile: string): boolean => SOLID.has(tile);
export const isDeadly = (tile: string): boolean => DEADLY.has(tile);
export const isSpawner = (tile: string): boolean => SPAWNERS.has(tile);
export const isEarth = (tile: string): boolean => EARTH.has(tile);
export const isIcy = (tile: string): boolean => ICY.has(tile);
export const isMetal = (tile: string): boolean => METAL.has(tile);
export const isMasonry = (tile: string): boolean => MASONRY.has(tile);
export const isVolcanic = (tile: string): boolean => VOLCANIC.has(tile);
/** Una parete che non è una parete: acciaio, arenaria o basalto finti. */
export const isFakeWall = (tile: string): boolean =>
  tile === TILE.FAKE_WALL || tile === TILE.FAKE_STONE || tile === TILE.FAKE_BASALT;

/**
 * Due celle si "saldano" (niente bordo, niente ombra tra loro)?
 *
 * La terra fa massa con la terra, il ghiaccio col ghiaccio, la lamiera con la
 * lamiera; tutto il resto si limita a poggiare sul solido. Senza questa regola
 * una parete d'acciaio incastrata nella roccia sembrerebbe un unico blocco, e
 * il mondo nuovo non si distinguerebbe da quello vecchio.
 */
export const joins = (tile: string, other: string): boolean => {
  if (isEarth(tile)) return isEarth(other);
  if (isIcy(tile)) return isIcy(other);
  if (isMetal(tile)) return isMetal(other);
  if (isMasonry(tile)) return isMasonry(other);
  if (isVolcanic(tile)) return isVolcanic(other);
  if (tile === TILE.SAND) return other === TILE.SAND;
  if (tile === TILE.GLASS) return other === TILE.GLASS;
  return isSolid(other);
};

/** Il blocco invisibile è solido ma va disegnato solo dopo essere stato scoperto. */
export const isHiddenUntilTouched = (tile: string): boolean => tile === TILE.INVISIBLE;

/** Verso in cui il nastro trascina: -1, 0 o +1. */
export const beltDirection = (tile: string): number =>
  tile === TILE.BELT_RIGHT ? 1 : tile === TILE.BELT_LEFT ? -1 : 0;

/**
 * Verso in cui la corrente d'aria spinge: -1, 0 o +1.
 *
 * La corrente morta non compare qui, e non è una svista: è tutta la trappola.
 * Si disegna come le altre due, fischia come le altre due, e vale zero.
 */
export const windDirection = (tile: string): number =>
  tile === TILE.WIND_RIGHT ? 1 : tile === TILE.WIND_LEFT ? -1 : 0;

/**
 * Questa cella capovolge la gravità?
 *
 * Il campo spento non compare qui, e non è una svista: è tutta la trappola.
 * Si disegna identico, ronza identico, e vale zero — esattamente come la
 * corrente morta non compare in `windDirection` e il getto spento non compare
 * in `Player.sampleSurface`.
 */
export const isReverseField = (tile: string): boolean => tile === TILE.REVERSE;
