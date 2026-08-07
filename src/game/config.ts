/**
 * Tutte le costanti di gioco in un posto solo.
 *
 * I valori sono PER TICK a 60Hz (vedi core/loop.ts). Toccarne uno cambia il
 * feeling di ogni livello già disegnato: ogni salto è stato tarato su questi
 * numeri, quindi si modificano solo con molta intenzione.
 */

export const TILE_SIZE = 32;
export const VIEW_WIDTH = 800;
export const VIEW_HEIGHT = 480;
export const LEVEL_ROWS = 15;
/** Larghezza in colonne di un singolo segmento di livello. */
export const SEGMENT_COLS = 20;

export const PHYSICS = {
  gravity: 0.55,
  terminalVelocity: 16,
  jumpImpulse: 11.6,
  /** Moltiplicatore applicato alla salita quando si rilascia il tasto. */
  jumpCut: 0.42,
  acceleration: 0.72,
  maxSpeed: 4.6,
  groundFriction: 0.8,
  airFriction: 0.94,
  /** Tick di tolleranza per saltare dopo essere usciti dalla piattaforma. */
  coyoteTicks: 5,
  /** Tick entro cui un salto premuto in aria viene ricordato all'atterraggio. */
  jumpBufferTicks: 6,
  /** Rimbalzo dopo aver schiacciato un nemico. */
  stompBounce: 7.4,
  /** Spinta della molla: molto più di un salto, e non si può dosare. */
  springImpulse: 17.2,
  /**
   * Quanto trascina un nastro trasportatore, in pixel per tick.
   *
   * Meno di un terzo della velocità massima: contro il nastro si avanza
   * comunque, ma piano; nel verso del nastro si arriva più lanciati di quanto
   * si sia chiesto. Il nastro non toglie mai il controllo — sposta il terreno,
   * non i comandi (vedi CLAUDE.md).
   */
  beltSpeed: 1.4,
} as const;

/**
 * Le superfici del secondo mondo.
 *
 * Sono l'unica cosa del gioco che cambia *come risponde il gatto*, e per questo
 * sono anche l'unica cosa che deve restare leggibile a vista: il ghiaccio si
 * vede che è ghiaccio, il nastro si vede che scorre, il getto si sente. Il
 * patto (CLAUDE.md, punto 5) vale sempre — i comandi non tradiscono, è il
 * pavimento che ha regole diverse, e si vedono prima di calpestarlo.
 */
export const SURFACE = {
  /** Attrito sul ghiaccio: quasi niente. Fermarsi diventa una manovra. */
  iceFriction: 0.985,
  /** E anche spingere serve a poco: gli artigli non fanno presa. */
  iceAcceleration: 0.2,
  /** Pixel al tick con cui il nastro trascina chi ci sta sopra. */
  beltSpeed: 1.25,
  /** Accelerazione verso l'alto dentro un getto di vapore. */
  ventLift: 1.6,
  /** Velocità massima di risalita dentro il getto. */
  ventMaxRise: 7,

  // --- Mondo 3: le correnti. Qui non cambia il pavimento, cambia l'aria — e
  //     l'aria agisce nell'unico momento in cui il gatto non può correggere.
  /**
   * Pixel al tick con cui una corrente sposta chi **non tocca terra**.
   *
   * È l'immagine speculare di `beltSpeed`: il nastro sposta chi cammina, il
   * vento sposta chi vola. Deve restare ben sotto `PHYSICS.maxSpeed`, o
   * controvento diventerebbe impossibile avanzare invece che faticoso — e
   * "impossibile" non è un sinonimo di "difficile" nemmeno qui.
   */
  windSpeed: 1.5,
  /** Accelerazione verso il basso dentro un risucchio di sabbia. */
  downdraftPull: 0.85,
  /** Velocità massima di caduta imposta dal risucchio: sotto la terminale. */
  downdraftMaxFall: 9,
  /**
   * Le sabbie mobili, in quattro numeri.
   *
   * Affondare è lento (`sandSink`) e risalire a bracciate è appena più veloce
   * (`sandRise`): la differenza fra i due è tutto il margine che il giocatore
   * ha, e va tenuta stretta. Se risalire fosse molto più rapido dell'affondare
   * la pozza sarebbe un fastidio; se fosse più lento sarebbe una condanna, cioè
   * una trappola travestita da superficie — e le superfici, per patto, si
   * vedono prima e si possono giocare.
   */
  sandSink: 1.05,
  sandRise: 2.3,
  /** Dentro la sabbia si spinge poco e ci si ferma subito: è melma, non aria. */
  sandAcceleration: 0.3,
  sandFriction: 0.8,
  /**
   * E soprattutto non si corre: dentro la pozza la velocità massima è meno
   * della metà di quella normale.
   *
   * Senza questo tetto la sabbia non sarebbe una superficie ma un piccolo
   * fastidio — l'attrito frena solo chi lascia i comandi, quindi bastava
   * tenere premuto per uscirne camminando come se niente fosse. Con il tetto,
   * l'unico modo di uscire da una pozza è quello giusto: risalire a bracciate
   * e scavalcare il bordo.
   */
  sandMaxSpeed: 1.9,
  /**
   * La bracciata.
   *
   * Vale come un salto dentro la sabbia — si può dare anche senza toccare
   * niente, ed è l'unico posto del gioco in cui succede — ma viene comunque
   * tagliata da `sandRise`: quello che conta è il ritmo con cui si martella il
   * tasto, non quanto forte si salta. È il nuoto di Mario, e si riconosce.
   */
  sandStroke: 7,
} as const;

export const RULES = {
  /** Durata del fermo immagine dopo la morte, prima del respawn. */
  deathFreezeTicks: 52,
  /** Quanto resta a schermo la battuta. */
  tauntDurationMs: 1200,
  /** Tick prima che una piattaforma toccata si sbricioli. */
  crumbleDelayTicks: 16,
  /** Tick prima che il finto terreno sparisca sotto le zampe. */
  fakeGroundDelayTicks: 6,
  /** Tick prima che il ghiaccio sottile ceda: il tempo di sentirlo crepitare. */
  brittleIceDelayTicks: 10,
  /**
   * Tick entro cui una caduta viene attribuita al getto spento invece che al
   * vuoto. Serve solo a scegliere la battuta giusta: se sei morto perché un
   * getto non ti ha sollevato, il gioco te lo deve dire.
   */
  deadVentBlameTicks: 40,
  /**
   * Tick prima che una piattaforma fantasma svanisca: quasi zero.
   * Non è reattivo — è memorizzabile. Chi sa che sta arrivando salta prima.
   */
  ghostDelayTicks: 3,
  /** Tick che gli spuntoni a scatto impiegano a uscire: è il loro preavviso. */
  popSpikeChargeTicks: 11,
  /** Distanza orizzontale a cui gli spuntoni a scatto si attivano. */
  popSpikeRange: 46,
  /** Gli spuntoni nascosti scattano in tre tick: un venteesimo di secondo. */
  snapSpikeChargeTicks: 3,
  /** E si attivano solo quando ci sei già praticamente sopra. */
  snapSpikeRange: 20,
  /**
   * Per quanti tick dopo un nastro una caduta è ancora colpa sua.
   * Serve solo a scegliere la battuta giusta: è il tempo di arrivare in fondo
   * al buco in cui il nastro ti ha spinto.
   */
  beltBlameTicks: 48,
  /**
   * Per quanti tick dopo che il pavimento è sparito una caduta è colpa sua.
   *
   * Stessa idea del nastro e del getto spento: chi cade perché la piattaforma
   * fantasma è svanita non è "caduto nel vuoto", e la battuta deve dirlo (vedi
   * CLAUDE.md, punto 7). Senza, le battute di `ghost`, `fakeGround` e
   * `brittleIce` erano scritte e non le leggeva nessuno.
   *
   * Un secondo pieno perché tanto ci mette una caduta dal punto più alto dello
   * schermo fino sotto al livello: la piattaforma che sparisce sta spesso in
   * cima, e la colpa deve arrivare fino in fondo al buco.
   */
  vanishBlameTicks: 60,
  /**
   * Per quanti tick dopo una corrente morta una caduta è ancora colpa sua.
   * Stessa idea del nastro e del getto spento: chi si è buttato contando su una
   * spinta che non c'era non è "caduto nel vuoto" (CLAUDE.md, punto 7).
   */
  deadWindBlameTicks: 44,
  /**
   * Per quanti tick dopo un campo rovescio spento una caduta è ancora colpa
   * sua — e vale in tutte e due le direzioni, perché è l'unica trappola del
   * gioco che può uccidere sia verso il basso sia verso l'alto.
   *
   * È più lungo degli altri di proposito: nel quarto mondo ci si butta dentro
   * un campo *dall'alto di una torre*, e la caduta che ne segue è la più
   * lunga che il gioco abbia.
   */
  deadFieldBlameTicks: 58,
  /**
   * Quante colonne avanti e indietro sente una piastra a pressione.
   *
   * È larga poco più di uno schermo apposta: quello che viene giù dev'essere
   * roba che il giocatore ha *appena visto* o che sta per attraversare. Una
   * piastra che facesse crollare un soffitto a mezzo livello di distanza
   * sarebbe indistinguibile da un bug.
   */
  plateRange: 11,
  /**
   * Tick consecutivi senza toccare niente che valgono l'impresa del vento.
   *
   * Quattro secondi. In tutto il resto del gioco un salto dura mezzo secondo:
   * per arrivare qui bisogna farsi portare da una corrente e non poggiare mai,
   * che è esattamente la cosa che il terzo mondo insegna a fare per sbaglio.
   */
  aloftTicks: 240,
  /**
   * Quanto bisogna restare immobili perché il gioco se ne accorga: mezzo
   * minuto. Un platform si aspetta che tu ti muova — non fare niente, e farlo
   * a lungo, è l'unica cosa che nessuna mappa può prevedere.
   */
  stillTicks: 1800,
  /** Quanto sotto il livello si muore. */
  fallDeathMargin: 160,
  /** Distanza verticale massima per considerare valido uno stomp. */
  stompTolerance: 16,
  /**
   * Tick tra il momento in cui sali sul mattone del boss e quello in cui si
   * stacca. È lungo apposta: dev'esserci il tempo di scendere, farsi vedere e
   * mettere il Padrone sotto la verticale giusta. Tremare per mezzo secondo
   * non sarebbe un'arma, sarebbe un incidente.
   */
  bossBrickDelayTicks: 50,
  /**
   * Dopo quanti tick la muratura del soffitto si ricompone.
   *
   * Serve a non poter perdere: se i mattoni finissero, l'arena diventerebbe
   * una stanza senza soluzione e il giocatore resterebbe lì dentro a girare a
   * vuoto. Il Padrone si ricostruisce il soffitto perché bara — e barando ti
   * ridà l'unica cosa che può ucciderlo.
   */
  bossBrickRespawnTicks: 210,
} as const;

/**
 * Il Padrone.
 *
 * Tutti i tempi sono in tick e tutte le velocità in pixel per tick, come il
 * resto del gioco. Due numeri contano più di ogni altro: la carica è più
 * veloce del gatto (quindi non si scappa in linea retta, si schiva), ma la
 * camminata è molto più lenta (quindi il gatto decide sempre dove si combatte).
 * Se un giorno la camminata superasse `PHYSICS.maxSpeed`, il boss smetterebbe
 * di essere difficile e diventerebbe ingiusto.
 */
export const BOSS = {
  width: 58,
  height: 52,
  /** Colpi da incassare in ciascuna delle due fasi. */
  hitsPerPhase: 2,
  /** Passeggiata di avvicinamento: sempre verso il gatto, sempre più lenta di lui. */
  stalkSpeed: 1.9,
  stalkSpeedFurious: 2.4,
  /** Carica: veloce, dritta, e con una lunghezza fissa che si può memorizzare. */
  chargeSpeed: 5.4,
  chargeSpeedFurious: 6.2,
  chargeDistance: 290,
  /** Tick di ruggito prima di partire: l'unico preavviso, e basta appena. */
  windTicks: 22,
  windTicksFurious: 15,
  /** Quanto resta intontito contro il muro: è la finestra buona per colpirlo. */
  stunTicks: 82,
  stunTicksFurious: 58,
  /** Tick di cammino tra un'azione e l'altra. */
  stalkTicks: 96,
  stalkTicksFurious: 62,
  /**
   * Scarto: quando vede un mattone che gli sta cadendo addosso si sposta.
   * È il suo modo di barare, e funziona solo mentre cammina — appena si
   * impegna in qualcosa (carica, botta a terra, capogiro) non può più.
   */
  dodgeSpeed: 3.4,
  dodgeTicks: 26,
  /** Raggio orizzontale entro cui considera un masso "roba che cade su di me". */
  dodgeRange: 46,
  /**
   * Fase 2: la botta a terra. Fa crollare il mattone sopra al gatto — solo che
   * per un secondo abbondante lui resta lì fermo a godersi lo spettacolo, e i
   * mattoni cadono dove il gatto ha deciso di stare. È l'unica trappola del
   * gioco che si può girare contro chi l'ha messa.
   */
  slamWindTicks: 20,
  slamRecoveryTicks: 54,
  /** Tick di rinculo dopo un colpo incassato: fermo, e quindi colpibile ancora. */
  hurtTicks: 46,
  /** Cambio di fase: sta fermo, urla, e si rifà il soffitto. */
  ragTicks: 70,
} as const;

/**
 * Gothic Lucio, il boss di 2-11.
 *
 * Il Padrone si combatte in orizzontale: cammina verso di te, e tu scegli sotto
 * quale mattone farlo arrivare. Lucio si combatte **in verticale**, e le sue
 * costanti dicono esattamente questo — non c'è una velocità di carica, c'è una
 * velocità di scorrimento lungo la volta e una velocità di caduta.
 *
 * Due numeri reggono tutto lo scontro, e sono in tensione fra loro. Lo
 * scorrimento (`slideSpeed`) è più lento del gatto, quindi è il gatto a
 * decidere sopra quale cero avviene il tuffo: se un giorno superasse
 * `PHYSICS.maxSpeed`, Lucio smetterebbe di farsi guidare e comincerebbe a
 * inseguire, che è il combattimento di qualcun altro. Il preavviso del tuffo
 * (`aimTicks`) è il tempo che il giocatore ha per togliersi: accorciarlo sotto
 * una decina di tick vuol dire chiedere riflessi invece che memoria, e il patto
 * dice memoria.
 */
export const LUCIO = {
  width: 40,
  height: 44,
  /** Colpi da incassare in ciascuna delle due fasi. */
  hitsPerPhase: 2,
  /** Scorrimento lungo la volta, appeso. Sempre più lento del gatto. */
  slideSpeed: 2.6,
  slideSpeedFurious: 3.4,
  /**
   * Tick appeso, **al massimo**, fra un tuffo e l'altro.
   *
   * Non è il tempo che passa sempre: è la valvola di sicurezza. Normalmente
   * Lucio si stacca quando arriva *sopra* il gatto (vedi `alignRange`), che è
   * l'unica versione della cosa che si possa imparare a memoria — un boss che
   * si tuffasse allo scadere di un cronometro, da dove capita, non sarebbe
   * difficile: sarebbe rumore. Il tetto esiste perché scorre più lento del
   * gatto e senza di lui bastarebbe correre per sempre.
   */
  hangTicks: 150,
  hangTicksFurious: 110,
  /**
   * Quanto vicino alla colonna del gatto deve arrivare prima di staccarsi.
   *
   * È la ragione per cui il combattimento funziona: piazzarsi su un cero e
   * aspettare lo porta lì sopra ogni volta, sempre allo stesso modo. Allargarlo
   * vorrebbe dire tuffi che cadono di fianco al cero, cioè un'arma che a volte
   * c'è e a volte no.
   */
  alignRange: 14,
  /**
   * Mira: allunga gli artigli e sceglie la colonna. Da qui in poi il bersaglio
   * è **congelato** — Lucio si tuffa dove eri quando ha cominciato a mirare, non
   * dove sei. È la stessa idea del ruggito del Padrone: il preavviso serve a
   * qualcosa solo se quello che annuncia non cambia più.
   */
  aimTicks: 26,
  aimTicksFurious: 20,
  /** Caduta del tuffo: molto più veloce della gravità normale. */
  diveSpeed: 12,
  diveSpeedFurious: 14.5,
  /**
   * Tick conficcato nel pavimento dopo un tuffo a vuoto.
   *
   * È la finestra, ed è lunga apposta: non serve a colpirlo (colpirlo non si
   * può) ma a fargli capire, e a far capire a chi guarda, che il tuffo sbagliato
   * costa. Su un cero acceso questo tempo non passa mai: brucia e basta.
   */
  stuckTicks: 74,
  stuckTicksFurious: 54,
  /** Risalita verso la volta dopo essersi sfilato dal pavimento. */
  climbSpeed: 5.5,
  /** Rinculo dopo un colpo incassato: appeso, fermo, e furioso. */
  hurtTicks: 52,
  /** Cambio di fase: sta appeso e spegne tutto quello che vede. */
  rageTicks: 76,
  /**
   * Fase 2: l'onda dell'atterraggio.
   *
   * Il tuffo smette di essere un problema puntuale e diventa un problema di
   * spazio: schivare per un pelo non basta più, bisogna proprio non essere lì.
   * In fase 1 vale zero — l'onda non esiste — perché la prima metà dello
   * scontro serve a insegnare il tuffo, non a punirlo due volte.
   */
  waveRadius: 44,
  waveTicks: 10,
  /**
   * Tick prima che un cero spento si riaccenda da solo.
   *
   * Stessa ragione di `bossBrickRespawnTicks`: se i ceri finissero, la cappella
   * diventerebbe una stanza con dentro un boss e niente con cui spegnerlo.
   */
  candleRelightTicks: 150,
  /**
   * Fase 2: l'onda dell'atterraggio spegne i ceri lì intorno.
   *
   * È il suo modo di barare, ed è l'equivalente dello scarto del Padrone:
   * impedisce di vincere quattro volte nello stesso posto. Ogni tuffo lascia
   * un pezzo di cappella al buio, quindi il combattimento si sposta di continuo
   * e va portato dove le fiamme ci sono ancora.
   *
   * **Non è così che era stato scritto la prima volta, e la differenza conta.**
   * Prima spegneva quello che sorvolava mentre scorreva — e siccome per
   * tuffarsi deve arrivare *sopra* il gatto, e il gatto per farsi esca deve
   * stare *sopra il cero*, spegneva sempre il bersaglio qualche tick prima di
   * poterci finire dentro: la seconda fase era matematicamente invincibile e
   * nessuno dei controlli sul contratto se ne accorgeva. L'ha trovata un
   * giocatore finto che ha provato a vincere davvero.
   */
  //
  // Il raggio è tarato sulla distanza fra due ceri vicini della cappella: ogni
  // tuffo si porta via il bersaglio *e* il suo vicino, mai tutta la stanza.
  // Tenuto stretto non spegnerebbe mai niente e la fase due non esisterebbe.
  snuffRadius: 170,
} as const;

/**
 * La Sfinge, il boss di 3-11.
 *
 * Gli altri due si combattono contro: il Padrone cammina verso di te e lo si
 * porta sotto un mattone, Lucio si tuffa e lo si attira sopra un cero. La
 * Sfinge non si combatte contro — si combatte **dentro**: non c'è niente da
 * farle cadere addosso e niente su cui farla atterrare, perché l'unica cosa
 * che le fa male è il pavimento che ha rotto lei.
 *
 * Il ciclo è: scava sotto la sabbia verso di te (più lenta di te, sempre, come
 * gli altri due: sei tu a scegliere dove si combatte), si ferma quando ti
 * arriva sotto, rimbomba — e quello è tutto il preavviso — poi erutta. Se sotto
 * il suo corpo il pavimento è sano, l'eruzione lo **sbriciola in sabbia**: la
 * stanza si consuma, e ogni colpo che sbagli te ne toglie un pezzo. Se invece
 * lì sotto c'è già sabbia sua, non trova presa: viene su a metà e resta
 * conficcata. Quello è il colpo.
 *
 * Quindi il combattimento è un problema di **spazio** e non di tempo: la si
 * chiama vicino alle proprie macerie stando sul bordo, non sopra — il suo corpo
 * è largo due celle e le basta toccarne una guasta — e ci si toglie prima che
 * esca. Il pavimento si ricompatta da solo (`floorHealTicks`) per la stessa
 * ragione per cui i mattoni del Padrone tornano e i ceri di Lucio si
 * riaccendono: un'arena senza soluzione non è una partita persa, è una partita
 * finita. Ma qui la ragione è doppia — senza, dopo otto eruzioni non ci sarebbe
 * più pavimento su cui stare in piedi.
 */
export const SPHINX = {
  width: 62,
  height: 46,
  /** Colpi da incassare in ciascuna delle due fasi. */
  hitsPerPhase: 2,
  /**
   * Velocità di scavo. Più lenta del gatto, sempre: se un giorno superasse
   * `PHYSICS.maxSpeed` smetterebbe di farsi portare e comincerebbe a inseguire,
   * che è il combattimento di qualcun altro (vedi `BOSS.stalkSpeed`).
   */
  burrowSpeed: 2.2,
  burrowSpeedFurious: 2.9,
  /**
   * Tick sotto terra **al massimo**. Come per Lucio è una valvola: normalmente
   * emerge quando ti arriva sotto, e quello è ciò che si può provocare; il
   * tetto serve solo perché scava più piano di quanto tu corra.
   */
  burrowTicks: 190,
  burrowTicksFurious: 140,
  /** Quanto vicino alla colonna del gatto deve arrivare per fermarsi. */
  alignRange: 16,
  /**
   * Il rimbombo: il pavimento trema e da qui in poi il punto è **congelato**.
   * Stessa idea del ruggito del Padrone e della mira di Lucio — un preavviso
   * che continua a inseguirti non è un preavviso.
   */
  rumbleTicks: 32,
  rumbleTicksFurious: 24,
  /** Uscita: veloce e dritta. Chi è ancora lì sopra non ha sbagliato i tempi
   *  di un pelo, ha sbagliato posto. */
  eruptSpeed: 10,
  /** Quanto esce dal pavimento, in pixel. */
  eruptHeight: 132,
  /** Tick in cui resta fuori a guardarsi intorno prima di rituffarsi. */
  crestTicks: 44,
  crestTicksFurious: 32,
  /** Rientro sotto la sabbia. */
  diveSpeed: 6.5,
  /**
   * Tick conficcata quando erutta dentro la propria sabbia: è la finestra, ed è
   * lunga apposta. Non serve a colpirla — colpirla non si può — ma a far vedere
   * che il colpo è arrivato e a dare il tempo di rimettersi al sicuro.
   */
  sinkTicks: 96,
  sinkTicksFurious: 74,
  /**
   * Quante celle di pavimento sbriciola per lato a ogni eruzione a vuoto.
   *
   * In fase 2 il raggio raddoppia, ed è insieme il suo modo di barare e il modo
   * in cui si suicida: più stanza distrugge, più posti ci sono in cui può
   * restare conficcata — e meno posti ci sono in cui puoi stare tu.
   */
  ruinRadius: 1,
  ruinRadiusFurious: 2,
  /** Tick prima che il vento ricompatti una cella sbriciolata. */
  floorHealTicks: 340,
  /** Rinculo dopo un colpo incassato. */
  hurtTicks: 54,
  /** Cambio di fase: esce tutta, urla, e si riprende la stanza. */
  rageTicks: 72,
} as const;

/**
 * Il Rovescio, il boss di 4-11.
 *
 * Gli altri tre si combattono contro qualcosa che sta nella stanza: il
 * soffitto del Padrone, i ceri di Lucio, la sabbia che fabbrica la Sfinge. Lui
 * si combatte contro **la stanza**, e l'arma la spara da solo: ogni volta che
 * ribalta, tutte le zavorre cadono dall'altra parte, tutte insieme, comprese
 * quelle che gli stanno sopra la testa.
 *
 * Quindi non c'è niente da portargli addosso e niente su cui attirarlo. Il
 * problema è l'opposto: lui **si toglie** dai posti pericolosi prima di
 * ribaltare (`shuffle`), e il gatto deve piazzarsi dove non ha più posti dove
 * togliersi. È l'unico dei quattro in cui si vince chiudendogli le uscite
 * invece che aprendogli una trappola.
 *
 * Vale il numero non negoziabile di tutti e quattro: cammina più lento del
 * gatto. Se un giorno superasse `PHYSICS.maxSpeed` smetterebbe di farsi
 * guidare e comincerebbe a inseguire, che è il combattimento di qualcun altro.
 */
export const ROVESCIO = {
  width: 60,
  height: 50,
  /** Colpi da incassare in ciascuna delle due fasi. */
  hitsPerPhase: 2,
  /** Passeggiata verso il gatto, sulla superficie che in questo momento è il basso. */
  stalkSpeed: 2.1,
  stalkSpeedFurious: 2.7,
  /** Tick di cammino tra un ribaltamento e l'altro: la valvola di sicurezza. */
  stalkTicks: 130,
  stalkTicksFurious: 95,
  /** Quanto vicino alla colonna del gatto deve arrivare per fermarsi. */
  alignRange: 20,
  /**
   * Lo scarto prima di ribaltare.
   *
   * Guarda cosa gli sta per cadere addosso e si sposta, come il Padrone —
   * solo che qui non schiva un masso alla volta, sceglie **la colonna** in cui
   * piantarsi. È il suo unico modo di barare, ed è anche tutto il gioco: il
   * gatto vince quando gli toglie le colonne libere.
   */
  shuffleSpeed: 3.6,
  shuffleTicks: 34,
  /** Quanto larga considera "sopra di me" una zavorra. */
  dangerRange: 40,
  /**
   * Il rimbombo prima del ribaltamento: l'unico preavviso, e da lì in poi il
   * punto è congelato. Vale la regola del ruggito del Padrone e della mira di
   * Lucio — un preavviso che continua a inseguirti non è un preavviso.
   */
  windTicks: 34,
  windTicksFurious: 24,
  /** Tick in cui resta scoperto dopo aver ribaltato: cade anche lui. */
  recoverTicks: 66,
  recoverTicksFurious: 48,
  /** Rinculo dopo un colpo incassato: fermo, e quindi ancora colpibile. */
  hurtTicks: 50,
  /** Cambio di fase: ribalta due volte di fila e riparte. */
  rageTicks: 74,
} as const;

export const FEEL = {
  screenShakeOnDeath: 9,
  screenShakeOnStomp: 3,
  screenShakeOnTrap: 5,
  vignetteStrength: 0.34,
} as const;
