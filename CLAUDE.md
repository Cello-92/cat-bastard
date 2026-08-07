# Cat Bastard

## Cos'è

Un **rage game** platform 2D nello stile di *Super Mario Bros.* / *Syobon Action (Cat Mario)*:
sembra un platform classico e onesto, ma ogni elemento familiare è una trappola. Si gioca nel
browser aprendo un link pubblico — niente installazione, niente account.

Il gioco è strutturato **a livelli** su quattro mondi, con un menu di avvio navigabile (gioca,
mondi e livelli con i record, la collezione dei gatti, classifica, account, opzioni) e la pausa
su `ESC`. Il protagonista è un gatto — anzi, cinque, ma cambia solo il manto. Il tono è
ironico e cattivo: il gioco ti prende in giro mentre muori. I testi in-game sono **in italiano**.

Link pubblico: <https://diamond26.github.io/cat-bastard/>
Repo: <https://github.com/Diamond26/cat-bastard> (pubblica)

## Regole di lavoro

1. **Dopo ogni modifica: commit e push.** Sempre, senza aspettare che lo si chieda. Il messaggio
   dev'essere **dettagliato**: cosa è cambiato, in quali file, e *perché*. Niente "fix",
   "update", "wip". Una riga di sommario + un corpo che spiega la sostanza.
2. **`main` è il sito in produzione.** Ogni push viene pubblicato automaticamente: non si committa
   un gioco rotto. Prima di committare: `npm test && npm run build`.
3. **Prima di committare, provare davvero.** I test dicono che non esplode, non che è giocabile.
   Le trappole si rompono facilmente quando si tocca la fisica o una mappa.

## Il patto col giocatore (design non negoziabile)

Un rage game funziona solo se è *ingiusto ma leale*. Ogni trappola deve rispettare queste regole:

1. **Deterministico.** Nessuna trappola casuale. Stesso input = stessa morte. Il giocatore deve
   poter imparare a memoria il livello: è quello il gameplay.
2. **Il tradimento usa il vocabolario del genere.** Le trappole sfruttano ciò che il giocatore
   *dà per scontato* da Mario: il blocco premio, il fungo, la bandiera, la piattaforma, il tubo.
   Una trappola generica (un buco a caso) non è divertente.
3. **Morte istantanea, ripartenza istantanea.** Nessuna vita, nessun game over, nessun menu tra un
   tentativo e l'altro.
4. **Checkpoint frequenti.** Rifare 30 secondi già risolti per arrivare alla trappola nuova è
   punizione stupida. Ogni livello ne ha almeno uno (tile `S`).
5. **I controlli non tradiscono mai.** La fisica è pulita e prevedibile; ci sono coyote time e
   jump buffer apposta. Input lag, comandi invertiti o hitbox sbagliate sono **bug**, non design.
   Il gioco è bastardo nei *contenuti*, mai nella *risposta ai comandi*.
6. **Ogni trappola ha il suo taunt**, specifico, in `game/taunts.ts`. Aggiungere una trappola
   significa aggiungere anche la sua battuta.
7. **La trappola deve essere leggibile a posteriori.** Dopo la morte il giocatore deve capire
   *esattamente* cosa l'ha fregato. Se non lo capisce è frustrazione morta, non rage game.
   Attenzione: leggibile *dopo*, non necessariamente *prima*. Metà delle trappole non dà alcun
   preavviso — è il cuore del genere — ma ognuna lascia una spiegazione: la moneta era avvelenata,
   la lanterna era finta, il pavimento non c'era. Gli spuntoni invisibili, dopo averti preso una
   volta, restano visibili per tutto il tentativo: la prima morte è gratis, la seconda è colpa tua.
8. **Difficile non vuol dire impossibile.** Nessun salto richiesto supera le cinque colonne, e il
   test headless rifiuta un livello che lo violi. Le piattaforme che spariscono non contano come
   appoggio in quel calcolo: il livello deve restare attraversabile anche senza di loro.

## Stack e vincoli tecnici

- **TypeScript + Vite**, `strict` con tutti i flag di rigore attivi (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, ...). Il typecheck fa parte della build.
- **Zero dipendenze a runtime.** Niente framework, niente librerie, niente CDN. Solo devDependencies
  (Vite, TypeScript, @types/node). Se serve una libreria, prima chiedersi perché.
- **Rendering su Canvas 2D dietro l'interfaccia `Renderer`** (`engine/render/renderer.ts`).
  Il gioco non tocca **mai** il contesto canvas direttamente: disegna solo via `Renderer`.
  È il punto di sostituzione per un futuro backend WebGL. Le primitive comprendono gradienti
  lineari e radiali, curve chiuse raccordate, tratti, ritaglio, ombre morbide e fusione
  additiva/moltiplicativa: sono quelle che rendono possibile disegnare materiali e luce.
- **La risoluzione logica resta 800×480** — fisica e mappe sono tarate su quella — ma il canvas
  rasterizza fino a 2× e nasconde la scala in una trasformazione di base.
- **Nessun asset binario.** Grafica disegnata via codice, audio sintetizzato con WebAudio.
- **Path relativi** (`base: './'` in vite.config): il sito vive in una sottocartella.
- **60fps su hardware modesto**, e deve funzionare su mobile (pad touch già presente).
  Un frame costa circa 2000-3000 chiamate di disegno: prima di aggiungerne, guardare
  `alpha()` e `mix()` in `theme.ts` — sono le funzioni più chiamate del gioco e sono
  memoizzate apposta, perché il vero nemico degli scatti non è il calcolo, è la
  spazzatura che si crea a ogni frame e che qualcuno prima o poi deve raccogliere.
- Codice e nomi in **inglese**, commenti e testi di gioco in **italiano**.

## Architettura

Tre strati, con dipendenze a senso unico: `game` → `engine` → `core`. Mai il contrario.
`net` sta di lato: dipende solo da `core`, e nessuno dipende da lui tranne `game.ts`.

```
src/
  core/       loop (timestep fisso 60Hz), input, audio, storage, math
              Non sanno niente di Cat Bastard: sono riutilizzabili ovunque.
  engine/     tilemap, physics (AABB su griglia), camera
    render/   renderer.ts (interfaccia) + canvas2d.ts (backend)
              Motore 2D generico: non conosce il significato dei tile.
  game/       config (costanti), theme (palette), tiles (vocabolario),
              taunts, cats (manti sbloccabili), feats (le imprese: gli
              easter egg che sbloccano gli altri manti),
              effects (particelle/juice),
              world.ts (orchestratore), game.ts (composition root)
    entities/ player, walker, shroom, falling-spike, diver,
              sentry, drone, snowball, scarab, spider, ballast, pendulum,
              boss + rubble (solo 1-11), gothic-boss (solo 2-11),
              sphinx (solo 3-11), rovescio (solo 4-11)
    levels/   level.ts (helper) + un file per livello + index.ts (registro)
    render/   background.ts (parallasse), tiles.ts (disegno dei tile)
  net/        supabase.ts (fetch e basta), account.ts (sessione e sincronia),
              payload.ts (traduzione locale<->server), config.ts
              Il backend. Opzionale per costruzione: se non è configurato,
              il gioco è esattamente quello di prima.
  ui/         hud.ts, menu.ts, preview.ts, screens.ts, account-dialog.ts, format.ts
              L'unico codice che tocca il DOM
tests/        smoke test headless, gira in CI
legacy/       prototipo originale single-file, solo come riferimento
```

Punti fermi:

- **`world.ts` è l'unico che conosce sia la mappa sia le entità**, quindi l'unico che fa succedere
  le cose. Le entità chiedono a lui (`world.kill(...)`), non si coordinano tra loro.
- **`world.ts` non tocca il DOM**: comunica verso l'esterno solo tramite callback.
- **`game.ts` è il composition root**: l'unico file che conosce tutti i pezzi.
- **La simulazione gira a timestep fisso** (60 update/s). Le costanti in `config.ts` sono *per tick*.
  Il rendering gira a frame liberi. Su un monitor a 144Hz il gatto non salta più in alto.
  Il tempo trascorso viene **agganciato al refresh** (`core/loop.ts`): il browser non
  consegna 16.6667ms ma 16.6 o 16.7, perché arrotonda i timestamp, e senza aggancio
  l'accumulatore va in deriva finché un frame non fa nessun update e quello dopo ne fa
  due. Non è un calo di frame rate — non si vede in nessun contatore — ma si sente, su
  qualunque computer. E un frame senza update non viene ridisegnato: il disegno dipende
  solo dallo stato e dal numero di tick, quindi sarebbe la stessa immagine identica.
- **Colori solo in `theme.ts`**, mai hardcoded nel codice di disegno (i valori UI sono duplicati in
  `src/style.css`: vanno tenuti allineati a mano).

### Le trappole

Ogni trappola sfrutta un'abitudine del giocatore, e ognuna ha il suo taunt in `taunts.ts`:

| Tile | Cosa sembra | Cosa fa |
|---|---|---|
| `B` | blocco premio | sputa un fungo che ti insegue |
| `Q` | blocco premio | dà davvero una moneta — esiste per rendere credibile `B` |
| `I` | niente | compare quando ci sbatti la testa, di solito a mezzo salto sul vuoto |
| `T` | mattone | fa cadere una stalattite quando ci passi sotto |
| `D` | piattaforma | si sbriciola poco dopo che ci sali (trema prima) |
| `V` | terreno normalissimo | sparisce sotto le zampe |
| `A` | pavimento con una feritoia | spuntoni che escono quando ti avvicini |
| `Y` | soffitto | spuntoni: puniscono il salto pieno |
| `M` | molla | ti lancia in alto, dove di solito c'è `Y` |
| `F` | l'arrivo | uccide |
| `J` | il nemico normale (identico) | ha le punte sotto: schiacciarlo uccide |
| `Z` | ombra sul soffitto | si tuffa quando le passi sotto |
| `;` | ghiaccio | è sottile: si crepa e cede, come l'asse marcia |
| `>` `<` | pavimento | nastro: ti trascina, spesso dove non vuoi |
| `H` | nemico corazzato | ti vede, si pianta un attimo e ti carica. Non si schiaccia |
| `&` | palla di ghiaccio ferma | rotola verso di te e non frena |

Queste invece non danno **nessun preavviso**: la prima volta uccidono e basta.
Sono deterministiche come tutte le altre — stesso punto, stessa morte — quindi
si imparano morendo, che è il gameplay. Non sono casuali: casuale sarebbe
ingiocabile.

| Tile | Cosa sembra | Cosa fa |
|---|---|---|
| `E` | una moneta, identica a `C` | ucciderti quando la raccogli |
| `N` | un checkpoint, identico a `S` | ucciderti quando lo tocchi. La lanterna non si accende mai |
| `K` | roccia del soffitto | crolla nell'istante in cui gli passi sotto |
| `L` | una piattaforma solida | sparisce dopo tre tick, senza tremare |
| `O` | terreno normale, senza feritoia | spuntoni che scattano quando ci sei già sopra |
| `!` | niente. Proprio niente | spuntoni invisibili. Dopo la prima morte restano visibili per tutto il tentativo |
| `,` | un getto di vapore identico a `^` | non spinge. Ci si butta dentro contando su una spinta che non arriva |
| `w` `q` | una corrente d'aria identica a `)` e `(` | non spinge. Due caratteri perché il *verso disegnato* è la bugia: `w` fa saltare corti, `q` fa saltare lunghi |
| `n` | un campo rovescio identico a `u` | non capovolge niente. È la peggiore delle otto, perché nel mondo 4 si trova **in mezzo alla strada che stai già percorrendo**: la pietra sopra la testa continua, il luccichio continua, e a metà passo il soffitto smette di tenerti |

**`w` non entra nell'album di CAVIA, e non è una dimenticanza.** Le imprese
richieste da un gatto non si toccano più: chi aveva già chiuso l'album se lo
vedrebbe riaprire da una trappola che non esisteva quando l'ha finito, e una
cosa fatta non si disfa (vedi `game/feats.ts`). L'album resta a sette.

### Il secondo mondo: superfici, non trappole

Il mondo 2 (gelo + fabbrica) aggiunge le uniche cose del gioco che cambiano **come
risponde il pavimento**. Non violano il patto: si vedono prima di calpestarle, fanno
sempre la stessa cosa, e i comandi continuano a rispondere immediatamente.

| Tile | Cosa fa |
|---|---|
| `+` | terreno innevato: identico a `#`, cambia solo il manto |
| `~` | ghiaccio: attrito quasi nullo, poca presa in accelerazione |
| `=` | piastra d'acciaio: il pavimento onesto della fabbrica |
| `>` `<` | nastro: trascina di `SURFACE.beltSpeed` px/tick, senza toccare la velocità del gatto |
| `^` | getto di vapore: solleva finché ci resti dentro, e non si può dosare |

Le costanti stanno in `SURFACE` (`game/config.ts`). Chi le tocca deve toccare anche
`tests/solver.ts`: il risolutore simula ghiaccio, nastri e getti con lo stesso codice
e lo stesso ordine di operazioni di `Player.update` — se i due si scostano, il
risolutore mente e un livello impossibile passa i test.

### Il terzo mondo: l'aria, non il pavimento

Il mondo 3 (deserto + tempio) fa al volo quello che il mondo 2 aveva fatto al
terreno. E la differenza non è di grado: il nastro ti sposta **mentre cammini**,
e camminando si corregge sempre; la corrente ti sposta **mentre sei a
mezz'aria**, cioè nell'unico momento in cui la traiettoria è già decisa. È la
cosa più invasiva che il gioco faccia alla fisica, e regge il patto per gli
stessi tre motivi di sempre: si vede prima, fa sempre la stessa cosa, e i
comandi rispondono immediati (il vento sposta il *corpo*, non tocca `vx`).

| Tile | Cosa fa |
|---|---|
| `.` | sabbia compatta: il pavimento onesto del deserto, come `#` e `+` |
| `-` | arenaria: la pietra squadrata del tempio, solida e onesta |
| `(` `)` | corrente d'aria: trascina di `SURFACE.windSpeed` px/tick, **solo chi non tocca terra** |
| `v` | risucchio: il getto `^` capovolto. Schiaccia il salto, non lo annulla |
| `s` | sabbie mobili: non solide. Dentro si affonda piano e si risale a bracciate |
| `p` | piastra a pressione: pestarla sgancia i mattoni `T` entro `RULES.plateRange` colonne |
| `k` | scarabeo: vola piano e si fa portare dalle correnti, con lo stesso numero del gatto |

Quattro cose che è meglio sapere prima di toccare qualcosa qui:

- **Il vento e il nastro sono la stessa funzione, letta da due lati.** Il
  nastro agisce a terra, il vento in aria, e non possono mai agire insieme: è
  quello che li rende leggibili entrambi. Se un giorno il vento agisse anche a
  terra, smetterebbe di essere una regola e diventerebbe un comando alterato.
- **Le sabbie mobili si nuotano, e devono.** Dentro la pozza il salto è sempre
  disponibile (`SURFACE.sandStroke`) anche senza appoggio, la salita e la
  discesa sono due tetti di velocità (`sandRise`, `sandSink`) e la corsa è
  dimezzata (`sandMaxSpeed`). Senza il tetto sulla corsa bastava tenere premuto
  per uscirne camminando, e la pozza diventava un fastidio invece che una
  superficie. Non è una trappola: una superficie deve avere una risposta
  giusta, e qui la risposta è martellare il salto tenendo una direzione.
- **La piastra è l'unico congegno del gioco in cui causa ed effetto stanno in
  due posti diversi.** I mattoni non cadono tutti insieme: il ritardo cresce
  con la distanza, quindi il soffitto viene giù *a partire da dove sei* e
  prosegue in avanti — la stessa informazione, data in un ordine che si può
  correre. Il congegno vive in `World.handlePlates`, e i massi che crollano
  (`K`) restano fuori apposta: una piastra che ne sganciasse dieci senza
  preavviso sarebbe una fucilata, non una trappola.
- **Lo scarabeo è il vento reso visibile, ed è il suo mestiere.** Vola sempre
  alla stessa velocità (molto meno del vento) e le correnti se lo portano con lo
  stesso `SURFACE.windSpeed` del gatto: dove va uno scarabeo va l'aria, e
  guardarlo dice dove finirà il salto *prima* di farlo. Campiona la corrente su
  una sagoma allargata di mezza cella per lato, perché il marcatore `k` viene
  tolto dalla griglia al caricamento e con la sagoma esatta la bestia
  nascerebbe dentro un buco d'aria ferma largo quanto lei — impigliata sul
  bordo invece che portata, cioè l'unica cosa che non deve fare. Si schiaccia, e
  non è mai un appoggio necessario: il risolutore non conosce le entità.

Le costanti stanno in `SURFACE` e in `RULES`, e vale la stessa regola del mondo
2, solo più stretta: **chi le tocca deve toccare anche `tests/solver.ts`**, che
simula vento, risucchio e sabbia con lo stesso codice e lo stesso ordine di
operazioni di `Player.update`. La corrente morta `w` non compare nel
risolutore, e non deve: nel gioco non spinge, quindi lì non esiste proprio.

### Il quarto mondo: il basso, non il pavimento e non l'aria

Il mondo 2 ha cambiato **come risponde il pavimento**, il mondo 3 ha cambiato
**cosa fa l'aria**. Il mondo 4 (la torre + il Rovescio) cambia la cosa che
c'era sotto tutte e due: **da che parte si cade**. È la modifica più radicale
che la fisica del gioco abbia subito, ed è anche la più semplice da enunciare —
dentro un campo rovescio la gravità punta in su, il gatto atterra sul soffitto,
ci cammina e ci salta all'ingiù.

| Tile | Cosa fa |
|---|---|
| `o` | vetro temprato: il pavimento onesto della torre, come `#`, `+` e `.`. È l'unica superficie del gioco attraverso cui si vede, e serve: qui sapere cosa c'è dall'altra parte di una lastra è informazione di gioco |
| `b` | basalto: la pietra del Rovescio, solida e onesta |
| `u` | campo rovescio: finché il gatto lo tocca, il basso è in su |
| `_` | parete di basalto finta: il muro segreto del mondo 4 (vedi `isFakeWall`) |
| `a` | ragno di vetro: cammina sulle superfici, soffitti compresi |
| `z` | zavorra: un peso di piombo che obbedisce **al campo**, non a te |
| `t` | pendolo: oscilla sempre uguale, nel verso del campo sotto il perno |

Il patto regge per gli stessi tre motivi di sempre: il campo si vede prima di
entrarci, fa sempre la stessa cosa, e **i comandi non cambiano di una virgola**
— destra resta destra, il salto va sempre via dal pavimento, coyote time e jump
buffer sono quelli di 1-1. Cambia solo dove si atterra.

Cinque cose da sapere prima di toccare qualcosa qui:

- **Il segno del peso è un parametro, non una proprietà dei corpi.**
  `engine/physics.ts` esporta `Down` e lo accettano `applyGravity`,
  `isGrounded`, `updateGrounded` e `groundTiles`, con default `1`. Chi non lo
  passa continua a cadere in giù: tutte le entità che avevano già il loro peso
  non sanno e non devono sapere niente di tutto questo.
- **`World.gravityAt` è l'unico posto che decide**, e compone per **XOR**: un
  campo rovescio inverte, la mossa del Rovescio (`gravityFlipped`, solo in
  4-11) inverte, e due inversioni si annullano. Non è "l'ultimo vince", perché
  una regola che dipende dall'ordine in cui si leggono le celle è un dado.
- **Schiacciare è la stessa regola di sempre, misurata rispetto al proprio
  peso** (`World.handleEntities`). A testa in giù si schiaccia arrivando da
  sotto, e non è una concessione: è come il ragno sul soffitto smette di essere
  una cosa che uccide e diventa una cosa che si toglie di mezzo.
- **Il campo deve arrivare fino al solido su cui deve depositarti.** Il gatto è
  alto 28 pixel su celle da 32: appoggiato occupa una riga sola. Se la colonna
  di campo si ferma una cella prima del soffitto, il gatto sale, esce dal campo
  proprio nell'istante in cui ci arriva, ricade, rientra — e resta lì a
  rimbalzare per sempre. Geometria ineccepibile, risolutore contento, livello
  rotto. C'è un controllo d'igiene apposta.
- **La zavorra e il pendolo sono cartelli, ed è il loro mestiere.** Il campo
  spento è indistinguibile da quello vero, quindi il mondo ha bisogno di un
  modo *onesto* di dire la verità: il ferro obbedisce alla gravità vera e non a
  quella che speri. Una zavorra appoggiata al soffitto dice "questo campo è
  vero", una rimasta a terra sotto una colonna che luccica dice "è spento", un
  pendolo che oscilla in su dice la stessa cosa dall'altra parte. Chi li guarda
  prima di saltare non muore. Se un giorno smettessero di obbedire non
  lancerebbero niente: renderebbero il mondo bugiardo in silenzio.

Zavorra e pendolo campionano il campo su una **sagoma allargata**, per la
stessa ragione dello scarabeo del mondo 3: il marcatore viene tolto dalla
griglia al caricamento, quindi con la sagoma esatta nascerebbero dentro un buco
di campo spento largo quanto loro — e direbbero la bugia che esistono apposta
per non dire.

Il risolutore (`tests/solver.ts`) simula il campo con lo stesso codice e lo
stesso ordine di operazioni del gioco, e non gli costa **nessuno stato in più**:
il campo è una funzione della posizione. Quello che è costato è il budget — il
gatto dentro un campo è in aria per interi segmenti, e uno stato in aria si
dirama sei volte a tick mentre uno a terra ne butta via quasi tutti.

### I quattro boss: le arene di 1-11, 2-11, 3-11 e 4-11

Il gioco ha quattro scontri e sono costruiti per **non somigliarsi**. Il Padrone è
un problema orizzontale: cammina verso di te, e tu scegli sotto quale mattone
farlo arrivare. Gothic Lucio è verticale: vive appeso alla volta e si tuffa, e
tu scegli sopra quale cero farti trovare. La Sfinge è un problema di spazio:
vive sotto il pavimento, e ogni volta che sbaglia colpo rompe un pezzo di sala
— finché non le si fa sbagliare il colpo *sopra i pezzi rotti prima*. Il
Rovescio è un problema di **spazio negato**: l'arma è già carica e la spara lui,
sempre, e l'unico modo di vincere è metterlo dove non ha più un posto in cui
scansarsi.

In tutti e quattro il boss non si tocca mai e l'arma è un pezzo di mappa — la
muratura, la fiamma, il pavimento, il piombo — ma la mano che la usa cambia: il
Padrone si *guida*, Lucio si *attira*, la Sfinge si *aspetta nel posto giusto*,
il Rovescio si *chiude in un angolo*. E la differenza che li ordina è di chi sia
l'arma: nelle prime due arene sta nella mappa da prima che entri, nella terza
non esiste finché non è lei a fabbricarla, nella quarta c'è da sempre ed è
**sua** — è lui a farla partire, ogni volta, senza che nessuno glielo chieda.

Vale per tutti e quattro: niente checkpoint (un boss si impara, non si consuma),
si rinasce dentro l'arena, e il portone `|` si apre quando il boss cade.

#### Il Padrone: l'arena di 1-11

Tre tile esistono solo dentro l'arena del boss, e non compaiono in nessun altro
livello. Non sono trappole: sono l'attrezzatura di uno scontro.

| Tile | Cosa sembra | Cosa fa |
|---|---|---|
| `@` | niente, sparisce al caricamento | marcatore: qui nasce il Padrone |
| `?` | mattone del soffitto | ci sali, trema, si stacca. È l'unica arma contro di lui |
| `|` | portone chiuso | solido finché il Padrone è vivo, aperto quando cade |

Il combattimento sta in `world.ts` (`handleBossFight`, `bossSlam`, `onBossRage`;
per Lucio `lucioPlanted`, `handleLucioFight`, `onLucioRage`)
e non dentro l'entità, per la regola di sempre: serve sapere insieme dove sta il
masso e dove sta il boss, e quel posto è uno solo. Il risolutore non sa niente di
tutto questo — tratta il mattone come un appoggio che sparisce e il portone come
già aperto — quindi il contratto dello scontro si verifica in `smoke.ts`.

**Attenzione ai caratteri.** `?` e `|` sono quello che sono perché `H` e `=`
erano già presi da `SENTRY` e `STEEL`: due tile diversi con lo stesso carattere
non danno nessun errore, danno un livello che si carica sbagliato. Prima di
battezzare un tile nuovo, guardare tutto `TILE`. Tutte e ventisei le lettere
maiuscole sono occupate: per un tile nuovo restano i simboli.

#### Gothic Lucio: la cappella di 2-11

Sotto la fabbrica c'è una cappella, e nella cappella c'è un gatto gotico appeso
alla volta a testa in giù. Due tile suoi, e nessuno dei due è una trappola.

| Tile | Cosa sembra | Cosa fa |
|---|---|---|
| `$` | niente, sparisce al caricamento | marcatore: qui nasce Lucio, **appeso** — va messo sotto la volta, non sul pavimento |
| `"` | un cero votivo acceso | è l'incudine. Lucio che ci finisce dentro col mantello perde una candela |

**Il ciclo.** Lucio scorre lungo la volta verso il gatto — più lento di lui,
sempre, come il Padrone — e si stacca quando gli arriva **sopra**
(`LUCIO.alignRange`), non allo scadere di un cronometro: è quello che rende il
tuffo una cosa che si può *provocare*. Poi mira (`aimTicks`) congelando la
colonna, e piomba dritto. Se il gatto si è tolto e sotto c'è un cero acceso,
brucia. Se sotto ci sono pietre nude, resta conficcato e basta — e il tuffo
sprecato è l'unica risorsa che il giocatore abbia.

**Come bara.** Il cero su cui atterra se lo porta via, e in fase 2 l'onda
dell'atterraggio spegne anche quelli entro `snuffRadius`: i quattro colpi non si
possono dare tutti dallo stesso angolo. I ceri si riaccendono da soli
(`candleRelightTicks`) per la stessa ragione per cui il soffitto del Padrone si
ricompone. Sempre in fase 2 l'atterraggio manda un'onda che uccide a terra entro
`waveRadius`: togliersi per un pelo smette di bastare, e la risposta è saltare.

**La cosa da sapere prima di toccare i numeri.** La cattiveria di fase 2, scritta
la prima volta, spegneva i ceri che Lucio *sorvolava*. Ma per tuffarsi deve
arrivare sopra il gatto, e il gatto per farsi esca deve stare sopra il cero:
quindi spegneva sempre il bersaglio qualche tick prima di poterci finire dentro.
**Seconda fase matematicamente invincibile, e tutti i controlli sul contratto
verdi.** L'ha trovata il giocatore finto di `tests/smoke.ts`, che gioca lo
scontro e pretende di vincerlo — è il risolutore applicato a un boss, e c'è per
questo.

#### La Sfinge: la sala di 3-11

Nella sala grande in fondo al tempio non c'è niente. È la prima cosa da capire:
la tana del Padrone aveva un soffitto di mattoni, la cappella di Lucio aveva i
ceri, e qui il pavimento è pietra sana da parete a parete. **Non c'è nessuna
arma.**

| Tile | Cosa sembra | Cosa fa |
|---|---|---|
| `0` | niente, sparisce al caricamento | marcatore: qui nasce la Sfinge, **sepolta** — va messo sul pavimento, come quello del Padrone |
| `\|` | portone chiuso | lo stesso di sempre: una serratura è una serratura |

**L'arma la fabbrica lei, ed è la novità dello scontro.** La Sfinge vive sotto
il pavimento e ci scava dentro verso di te — più lenta di te, sempre, come gli
altri due, quindi è ancora il gatto a scegliere dove si combatte. Quando ti
arriva sotto si ferma, il pavimento rimbomba (`rumbleTicks`, e da lì il punto è
congelato: vale la regola del ruggito e della mira), e poi erutta. Uscendo
**sbriciola la pietra in sabbie mobili**: la sala si consuma, e al giro dopo
quella sabbia è lì. Se il suo corpo — largo due celle — ne tocca anche una
sola, non trova presa: viene su a metà e resta conficcata. Quello è il colpo.

Quindi il combattimento non è schivare (il Padrone) e non è farsi esca (Lucio):
è **scegliere il terreno**. Ci si mette sul bordo delle proprie macerie — sul
bordo, non sopra, o si affonda mentre si aspetta — e ci si toglie prima che
esca. È l'unico dei tre in cui l'arena a fine scontro non somiglia più a quella
dell'inizio.

**Perché la cella non deve essere esatta.** `sphinxSurfaces` guarda tutte le
celle sotto il corpo e sbaglia presa se **una** è guasta. Se pretendesse quella
sotto il centro, il giocatore dovrebbe piazzarsi *dentro* le sabbie mobili per
chiamarla, cioè affondare mentre aspetta: non sarebbe difficile, sarebbe una
barzelletta.

**Il pavimento si ricompatta** (`floorHealTicks`) per la stessa ragione per cui
i mattoni del Padrone tornano e i ceri di Lucio si riaccendono, più una che qui
è vitale: senza, dopo otto eruzioni non ci sarebbe più un pezzo di sala su cui
stare in piedi. In fase 2 il raggio dell'eruzione raddoppia, ed è insieme il
suo modo di barare e il modo in cui si condanna — più stanza rompe, più posti
ci sono in cui può restare conficcata, e meno posti ci sono per te.

Il combattimento sta in `world.ts` (`sphinxSurfaces`, `ruinFloor`,
`handleRuinedFloor`, `onSphinxRage`) e non nell'entità, per la regola di
sempre: qui serve sapere insieme dov'è lei e **com'è il pavimento**, e quel
posto è uno solo. L'entità chiede al mondo di uscire e il mondo le risponde
chiamando `erupt()` o `sink()`.

#### Il Rovescio: la sala di 4-11

In fondo al vuoto sotto la torre c'è una sala con un pavimento, un soffitto e
diciassette blocchi di piombo appoggiati per terra. Quei pesi sono l'unica cosa
che possa fargli male, e **non li tira nessuno**: cadono da soli, tutti insieme,
ogni volta che lui ribalta la stanza. Cioè ogni volta che fa l'unica cosa che sa
fare.

| Tile | Cosa sembra | Cosa fa |
|---|---|---|
| `1` | niente, sparisce al caricamento | marcatore: qui nasce il Rovescio, **sul pavimento**, come il Padrone e la Sfinge |
| `z` | una zavorra come tutte le altre | è l'arma: cade quando lui ribalta, e chi si trova sotto è schiacciato — lui compreso |
| `\|` | portone chiuso | lo stesso di sempre |

**Il ciclo.** Cammina verso il gatto (più lento di lui, come tutti e quattro),
si ferma quando gli arriva accanto — `alignRange` è largo 56 pixel apposta,
perché il suo corpo è largo due celle e toccarlo uccide: senza quel margine non
esisterebbe nessun posto in cui aspettarlo, e lo scontro diventerebbe una
rincorsa. Poi **decide**: chiede al mondo (`World.rovescioEscape`) il posto
libero più vicino, e se esiste ci si sposta — il minimo indispensabile, una
volta sola per ciclo, tre metri e mezzo al massimo. Poi rimbomba (`windTicks`,
e da lì il punto è congelato: vale la regola del ruggito e della mira) e
ribalta.

**Come si vince.** Non portandolo da nessuna parte: **togliendogli le uscite**.
La sala è divisa in tre — a sinistra non c'è un peso, in mezzo stanno ogni due
colonne, a destra sono radi — e in mezzo non esiste né un punto libero né uno
scarto abbastanza lungo per uscirne. Siccome cammina verso il gatto, quel posto
lo sceglie il gatto: e sceglierlo vuol dire mettersi in mezzo ai pesi, che è
anche il posto in cui i pesi passano. Le colonne libere sono le dispari, larghe
una cella — e **non sono le stesse nei due versi**, perché gli spuntoni del
pavimento e quelli del soffitto stanno su colonne diverse. Appena la stanza si
ribalta, il posto in cui stavi in piedi diventa un posto in cui si muore.

**Due cose che il giocatore finto di `tests/smoke.ts` ha trovato, e che non
avrebbero lanciato niente.** La prima: la zavorra spariva dopo aver colpito, e
dopo due colpi il Rovescio aveva due buchi nella fascia fitta — buchi fatti da
lui, esattamente dove gli servivano. Boss immortale, tutti i controlli sul
contratto verdi. Adesso il peso prosegue e si riappoggia dall'altra parte, per
la stessa ragione per cui i mattoni del Padrone si ricompongono e i ceri di
Lucio si riaccendono. La seconda: una zavorra nasce qualche pixel sopra il suo
appoggio (la cella è alta 32, lei ne occupa 26), e quei due tick di assestamento
contavano come una caduta — si uccideva da solo al primo tick. "Sta cadendo"
adesso vuol dire che si è mossa abbastanza da avere addosso l'energia di una
tonnellata.

Il combattimento sta in `world.ts` (`flipRoom`, `rovescioEscape`,
`handleRovescioFight`) e non nell'entità, per la regola di sempre: serve sapere
insieme dov'è lui e dove sono i pesi, e quel posto è uno solo.

### Il menu

Il menu è un menu da console che vive nel DOM: frecce, Invio, Esc — e le stesse
voci restano cliccabili e toccabili, perché il gioco gira in un browser e
nessuno dei tre modi va penalizzato. `ui/menu.ts` non sa niente di Cat Bastard:
riceve pagine (titolo, corpo, righe, voci) e le disegna. Chi decide *cosa* c'è
in una pagina è `game.ts`, che è il composition root.

Tre cose da sapere prima di toccarlo:

- **La gerarchia è a due livelli, non piatta.** Radice → mondi → livelli. Con
  trentadue livelli una lista sola non è una lista, è uno scorrimento; e i mondi
  esistono già nel gioco (cambiano cielo, tileset e regole del pavimento).
  `WORLDS` in `levels/index.ts` si ricava dagli id (`w2-3` → mondo 2): un mondo
  nuovo nasce da solo il giorno in cui compare un `w3-1`.
- **`locked` vuol dire "non confermabile", non "non selezionabile".** La
  selezione attraversa anche le voci chiuse, perché il motivo per cui sono
  chiuse sta nel loro `hint` e un gatto da sbloccare ha una sagoma da mostrare:
  saltandole, quella roba non la vedeva nessuno se non col mouse.
- **Il menu vive dentro `#frame`, non nella finestra.** Su un telefono in
  verticale il riquadro è alto un terzo dello schermo: le altezze si misurano
  in `%` del contenitore, mai in `vh`, o la lista finisce sopra le altre righe
  e ne intercetta i tap.

La collezione dei gatti disegna il ritratto **col codice del gioco**
(`game/render/cat-portrait.ts` riusa `Player.draw` su un canvas suo, via
`Renderer` come tutto il resto). Costa poco e toglie all'unica schermata-premio
del gioco l'unico modo che avrebbe di mentire: mostrare un gatto più bello di
quello che poi ti ritrovi. Non è un negozio e non deve diventarlo — le monete
sono un punteggio, non una valuta.

### I segreti e i gatti

| Tile | Cosa sembra | Cosa fa |
|---|---|---|
| `:` | parete d'acciaio | non è solida: ci si passa attraverso. Dopo, resta marcata |
| `/` | parete d'arenaria | la stessa cosa, in pietra: è il muro finto del tempio |
| `_` | parete di basalto | la stessa cosa, sotto la torre: metà delle stanze del mondo 4 si attraversano capovolte, e una parete che si nota si nota anche a testa in giù |
| `*` | un gomitolo | l'unica cosa del gioco che non uccide: sblocca i gatti |

`/` esiste perché una lamiera d'acciaio in mezzo ai conci del mondo 3 sarebbe
un cartello luminoso con scritto "di qua": un muro finto funziona solo se è
fatto della stessa roba di tutti gli altri muri della stanza. Le due si
comportano identiche (`isFakeWall` in `tiles.ts`), cambia solo di che materiale
sono — e i tile che si saldano fra loro stanno in `MASONRY`, come `METAL`.

**I segreti del mondo 4 non stanno tutti dietro un muro.** Uno sta in fondo a
una colonna che sembra un vicolo cieco (4-5), uno su una mensola sospesa nel
vuoto che si prende staccandosi dal soffitto *prima* del punto giusto (4-8), e
due dentro una cassa in fondo a un buco (4-7 e 4-10) — dove in quel mondo un
buco ha sempre voluto dire il vuoto. È la stessa idea del muro finto, spostata:
il segreto non è un posto che non si vede, è un posto in cui non verrebbe in
mente di andare.

**Non tutti i livelli ne hanno uno, ed è il punto.** Da 2-1 a 2-6 ce n'era uno
ovunque, e cercarlo aveva smesso di essere cercare: era diventato raccogliere. 2-7,
2-9, 3-1, 3-4, 3-6, 3-7 e 3-10 non ne hanno nessuno, quindi da lì in poi una parete che sembra
finta a volte è solo una parete, e l'unico modo di saperlo è perderci tempo. Chi aggiunge un
livello non è tenuto a metterci un gomitolo: `SECRET_COUNT` si conta dalle mappe.

**Ma chi ce lo mette deve mettere anche il gatto.** Sulla strada dei gomitoli
c'è un manto per ogni quota, senza buchi — ventidue gomitoli, ventitré manti
contando quello che c'è da sempre — e `tests/smoke.ts` rifiuta un buco nella
scala. Non è pignoleria: un gomitolo sta in una stanza murata che non serve a
finire il livello, quindi l'unica ragione per andarci è quello che dà. Se il
sesto e il settimo dessero la stessa identica cosa (cioè niente), cercare il
settimo sarebbe una perdita di tempo *dimostrabile*. I gatti delle imprese
(qui sotto) non entrano in questo conto: hanno tutti `yarn: 0` perché la loro
strada è un'altra, e il test li esclude apposta.

**Le soglie che ci sono già non si toccano mai.** I progressi salvano gomitoli,
non gatti: alzare la soglia di un manto per far tornare i conti richiude in
faccia a qualcuno una porta che aveva già aperto. I manti nuovi riempiono i
buchi e la coda.

I manti stanno in `game/cats.ts` e sono
**solo estetici**, per due motivi: un gatto che salta più in alto romperebbe ogni
mappa già tarata su `config.ts`, e una collezione che dà vantaggi smette di essere
una ricompensa e diventa una scorciatoia. I gomitoli trovati stanno nei progressi
(`core/storage.ts`) e non si perdono più.

I colori dei manti non stanno lì: stanno in `MATERIAL` (`game/theme.ts`), come
tutti gli altri colori del gioco. `cats.ts` decide *quale* manto ha un gatto e
come si sblocca; `theme.ts` di che pasta è fatto. L'unica cosa che richiede di
toccare il disegno è il **motivo** del manto (`CatPattern`: tinta unita,
soriano, punte, pettorina, chiazze, rosette) — sta in `drawMarkings`
(`entities/player.ts`), che il ritratto del menu riusa tale e quale.

### Le imprese: i gatti che non si trovano, si fanno

L'altra metà della collezione sta in `game/feats.ts`. Sono sei easter egg:
cose che nessuno chiede di fare, che non compaiono in nessuna mappa e che il
gioco non annuncia prima. Valgono un gatto ciascuno, sempre **solo estetico**:
un easter egg che desse un vantaggio smetterebbe di essere una battuta e
diventerebbe la strada giusta per giocare.

| Gatto | Impresa | Dove sta il codice |
|---|---|---|
| PLACCATO | digitare *quel* codice (↑↑↓↓←→←→BA), in qualunque schermata | `core/input.ts` (`bindKeySequence`) + `game.ts` |
| OMBRA | restare immobili `RULES.stillTicks` (mezzo minuto) in un livello | `World.handleStillness` |
| CAVIA | morire per tutte e sette le trappole senza preavviso | `World.kill` + `featForDeath` |
| MONACO | finire un livello senza morire e senza raccogliere una moneta | `World.win` |
| PADRONE | ammazzare il Padrone con un masso che ha staccato lui | `World.handleBossFight` (`Rubble.slam`) |
| ALISEO | restare in aria `RULES.aloftTicks` (quattro secondi) senza toccare niente | `World.handleAloft` |
| SFINGE | seppellire la Sfinge nella sabbia che ha fatto lei | `World.sphinxSurfaces` |
| CONTRAPPESO | spegnere il Rovescio con le zavorre che ha fatto cadere lui | `World.handleRovescioFight` |

Le regole che le tengono dentro al patto sono tre, e non sono negoziabili:

- **Deterministiche come le trappole.** Stessa cosa fatta, stesso gatto. Nessuna
  è a tempo, nessuna dipende da quante volte ci provi.
- **Ogni gatto chiuso ha il suo indovinello** (`riddle` in `cats.ts`), che è la
  riga che si legge nel menu al posto del conteggio dei gomitoli. Vale qui la
  regola 7 del patto: si può nascondere *cosa fare*, non si può lasciare il
  giocatore davanti a una cosa inspiegabile. L'album dice anche a che punto è
  (`3 su 7`), perché una collezione muta è una collezione che nessuno finisce.
- **Il mondo non sa contare.** `world.ts` segnala l'impresa via `onFeat` e
  basta; chi decide se ha sbloccato qualcosa è `game.ts`, che è l'unico ad avere
  i progressi in mano.

Le marche vivono in `Progress.feats` e si sincronizzano **per unione**, come i
gomitoli: una cosa fatta non si disfa. Il formato è minuscole-e-trattini perché
`cb_sync` accetta solo quello (`^[a-z-]{1,32}$`) e scarta il resto in silenzio —
è la stessa trappola in cui il progetto è già caduto una volta con gli id dei
livelli, e infatti `tests/smoke.ts` controlla anche questo.

**Attenzione a chi tocca i livelli.** L'album di CAVIA si chiude solo se tutte e
sette le trappole senza preavviso esistono ancora in una mappa vera: togliere
l'ultimo `,` dal mondo 2 renderebbe un gatto irraggiungibile senza rompere
niente. C'è un test apposta.

### Cosa succede alla roba raccolta quando muori

La morte non ricarica il livello: lo **ricostruisce** (`World.rebuild`) dalle
righe, che sono immutabili. Quindi tutto quello che era stato raccolto tornava
al suo posto, e ammazzarsi accanto a una moneta era il modo più comodo del gioco
per farsi un punteggio — con le monete di un livello che finiscono in
`bestCoins`, cioè in classifica.

Le due cose raccoglibili si comportano in modo diverso, e la differenza è
voluta:

| | Dopo la morte | Perché |
|---|---|---|
| gomitolo `*` | **non torna** | trovato una volta non è più un segreto, e rivederlo lì sarebbe una bugia |
| moneta `C`, blocco `Q` | **torna, ma non conta più** | toglierla lascerebbe buchi in un livello che il giocatore sta imparando a memoria, e la memoria del livello è il gameplay |

Il ricordo è **per cella** (`countedCoins`, `takenYarn` in `world.ts`), non "una
moneta l'hai già presa": due monete diverse restano due monete diverse.
Sopravvive alla morte ma non a `restart()`, che azzera anche il contatore — un
tentativo nuovo riparte da zero da entrambe le parti, quindi non regala niente.

Una moneta già contata si raccoglie lo stesso e lo dice (`GIÀ PRESA` invece di
`+1`): un contatore che non si muove senza spiegazione è un bug agli occhi di
chi gioca, ed è la regola 7 del patto.

### Aggiungere roba

- **Un livello**: nuovo file in `game/levels/`, poi appenderlo a `LEVELS` in `levels/index.ts`.
  Nient'altro. Le mappe sono ASCII, un segmento largo 20 colonne per riga di codice.
  Se contiene un `*`, il conteggio dei gomitoli si aggiorna da solo (`SECRET_COUNT`).
- **Un tile**: una voce in `TILE` (`game/tiles.ts`), la sua semantica lì accanto
  (solido? letale?), il suo disegno in `game/render/tiles.ts`. Se ha uno stato
  che cambia in partita (il cero acceso o spento) serve anche un campo in
  `TileDrawContext`, perché il disegno di un tile non può interrogare il mondo.
- **Un nemico**: una classe in `game/entities/` che estende `Entity` e implementa
  `update`/`draw`/`onTouch`/`onStomp`. Se nasce da un tile, aggiungerlo agli spawner.
- **Un boss**: come un nemico, più il fatto che *lo scontro non sta nell'entità*.
  Tutto quello che richiede di sapere due cose insieme — dov'è lui e dov'è la
  cella che gli fa male — sta in `world.ts`, che è l'unico posto che le conosce
  entrambe. E serve un gatto: sia il Padrone sia Lucio ne sbloccano uno
  (`FEAT.ownRock`, `FEAT.gothic`), e `tests/smoke.ts` rifiuta un'impresa che non
  sblocchi niente.
- **Un'impresa**: una marca in `FEAT` (`game/feats.ts`), il punto che se ne accorge —
  `world.ts` se succede dentro un livello, `game.ts` se succede fuori — e un gatto in
  `cats.ts` che la chiede, **col suo indovinello**. Senza indovinello è un gatto che non
  si sblocca: nessuno indovina una cosa che il gioco non ha mai nominato.

## Comandi

`A`/`D` **o** `←`/`→` per muoversi (entrambi sempre attivi), `Spazio`/`W`/`↑` per saltare
(altezza variabile), `R` per ricominciare. Le associazioni stanno in `core/input.ts`.

## Direzione artistica

Neo-retro: forme leggibili da pixel art, resa curata e contemporanea. Non "retrò sciatto".

- **Palette limitata e coerente**, in `theme.ts`. Ogni mondo ha il suo cielo (`SKIES`).
- **Parallasse su cinque piani**: più un piano è lontano, più è lento, più è desaturato.
- **Juice ovunque**: squash & stretch, screen shake, hit-stop di pochi tick, particelle,
  polvere all'atterraggio, scie in corsa, flash, testi fluttuanti. Sta tutto in `effects.ts`.
- **Materiali, non tinte.** Ogni superficie in `theme.ts` dichiara faccia illuminata, colore
  proprio, faccia in ombra, fondo delle fessure e riflesso speculare; il disegno applica sempre
  la stessa logica. La luce viene dall'alto a sinistra, sempre.
- **Prospettiva aerea**: più una cosa è lontana, più sbiadisce verso il colore della foschia.
  È quello che dà la profondità, molto più della parallasse.
- Le texture sono deterministiche (derivate da riga/colonna): il mondo non sfarfalla mai. Il
  disegno di un tile conosce i lati liberi della cella, così l'erba nasce solo dove il suolo vede
  il cielo e le facce unite non hanno cuciture.
- **HUD e schermate in DOM**, non su canvas: testo nitido, accessibile, gratis per il renderer.
- Coerenza prima di tutto: meglio uno stile semplice ovunque che effetti belli scoordinati.

## Verifica

```bash
npm run dev     # provare a mano: è l'unico modo di sapere se è divertente
npm test        # struttura, risolutore, smoke test, regressioni
npm run build   # typecheck + build
```

`tests/` contiene dodici cose diverse:

- **lo smoke test**, che esegue il gioco headless contro un `NullRenderer` capace di
  intercettare coordinate NaN e `push`/`pop` sbilanciati. Non dice se il gioco è bello,
  dice se esplode;
- **i controlli sulle trappole**, che costruiscono un mondo minimo per ciascuna e ne
  verificano il contratto (la moneta esca uccide e non viene contata, gli spuntoni
  invisibili tornano invisibili se ricominci il livello, il nastro trasporta senza
  toccare la velocità del gatto, e così via);
- **l'igiene delle mappe**, che cerca gli errori che non rompono niente: una molla
  disegnata a mezz'aria, spuntoni invisibili sospesi sul vuoto, un nastro murato
  sotto un solido, una piastra murata o senza un solo mattone da sganciare, un
  carattere sconosciuto (che è aria, quindi la trappola che credevi di aver
  messo non c'è), un checkpoint dopo l'arrivo. E una regola che non c'era e che
  è costata due livelli ingiocabili: **sotto un risucchio che arriva fino a
  terra, il vuoto vale al massimo due colonne**. Dentro una colonna che scende
  l'accelerazione verso il basso è `gravity + downdraftPull`, quindi il salto
  pieno passa da 122px a 48 e da sei colonne a due e mezzo — una pozza larga
  quattro col risucchio piantato sopra non si scavalca, e la regola dei cinque
  salti dice di sì. Il risolutore non se ne accorgeva perché la sabbia sa
  nuotarla: attraversava quelle pozze affondando, con pochi tick di margine,
  cioè per una via che nessuno troverebbe giocando. L'hanno trovato in 3-6 e in
  3-7 giocandoci, che è l'unico posto in cui certe cose si trovano;
- **il campo rovescio del mondo 4**, che è la modifica alla fisica più radicale
  del gioco e quindi ha il contratto più stretto di tutti: che dentro un campo
  si cada in su, che quello spento sia identico e inerte, che i comandi restino
  esattamente gli stessi (destra è destra anche a testa in giù, e il salto va
  sempre via dal pavimento), che due inversioni si annullino, che si possa
  morire anche verso l'alto, che il checkpoint si ricordi come eri messo, che
  la zavorra dica la verità e che il ragno si schiacci da capovolti;
- **le correnti del mondo 3**, che sono la modifica alla fisica più invasiva
  prima di quella e hanno lo stesso genere di contratto: che il vento sposti chi è in
  aria e non chi tocca terra, che non tocchi mai la velocità del gatto, che la
  corrente morta sia identica e non sposti un pixel, che il risucchio schiacci
  il salto, che nella sabbia si affondi molto più piano che nel vuoto e — la
  cosa che conta davvero — che dalla sabbia si **esca** nuotando. Una pozza da
  cui non si uscisse smetterebbe di essere una superficie e diventerebbe una
  trappola travestita, cioè l'unica bugia che il patto non permette;
- **il disegno di tutto il vocabolario**, perché la simulazione disegna solo le
  colonne inquadrate e un tile che compare a metà livello potrebbe non essere mai
  disegnato da nessun test;
- **il contratto del boss**, che il risolutore non può verificare perché non
  conosce le entità: che toccarlo uccida, che un masso spenga una gemma, che
  quattro gemme aprano il portone, che il soffitto si ricomponga e che scansi
  mentre cammina ma non mentre è impegnato. C'è anche un controllo che rifà il
  giro del risolutore su ogni singolo mattone dell'arena: un mattone
  irraggiungibile è un boss imbattibile;
- **la sincronizzazione dei progressi**, che è l'unica parte del backend che si
  possa sbagliare in silenzio: una fusione fatta male non lancia niente e non
  rompe niente, restituisce un record peggiore di quello che il giocatore aveva.
  Si prova headless perché `net/payload.ts` è puro apposta — la rete non c'entra
  e non deve entrarci;
- **la raggiungibilità dei gomitoli**, che è un caso a parte perché è l'unico che
  non rompe niente: una stanza segreta murata sul serio lascia il livello finibile,
  i test verdi e un gatto che non si sbloccherà mai. Si riusa il risolutore col
  gomitolo al posto dell'arrivo, sul livello tagliato subito dopo di lui — intero,
  la ricerca se ne andrebbe in fondo invece di infilarsi nella stanza;
- **le imprese** (`game/feats.ts`), che nessuno andrebbe a controllare giocando:
  chi non sa che ci sono non si accorge se smettono di funzionare. Si verifica
  che la condizione giusta faccia scattare la marca e che quella quasi giusta no
  — una moneta raccolta rompe il digiuno, battere il boss nel modo normale non
  vale il contrappasso — e soprattutto che tutte e sette le trappole dell'album
  esistano ancora in una mappa vera, altrimenti c'è un gatto irraggiungibile e
  non lo dice nessuno;
- **lo scontro con la Sfinge**, che ha una parte in più che può rompersi da
  sola: l'arma non sta nella mappa da prima, se la costruisce il giocatore
  sbagliando. Un'eruzione che smette di sbriciolare, o un pavimento che si
  ricompatta troppo in fretta, non lanciano niente — rendono la Sfinge
  immortale in silenzio. Anche qui, alla fine, un giocatore finto combatte e
  deve vincere;
- **lo scontro col Rovescio**, che ha la parte fragile della Sfinge più una
  sua: l'arma non sta nella mappa da prima *e* non la fabbrica il giocatore —
  la fa partire lui, ogni volta che ribalta. Se una zavorra smettesse di
  obbedire al campo, o se il suo scarto diventasse abbastanza lungo da uscire
  sempre dalla fascia fitta, non si romperebbe niente: diventerebbe immortale
  in silenzio. Anche qui un giocatore finto si piazza sulla colonna giusta,
  non fa nient'altro, e deve vincere — ed è così che sono venuti fuori i due
  bug scritti sopra;
- **lo scontro con Lucio**, che è stato il primo posto in cui un test *gioca* un boss.
  I controlli sul contratto dicono che i pezzi funzionano, non che lo scontro si
  possa vincere: la prima versione della fase 2 era invincibile con tutti i
  controlli verdi. Quindi un giocatore finto combatte davvero — si piazza sul
  cero acceso più vicino, aspetta il tuffo, si toglie — e deve arrivare in fondo;
- **il risolutore** (`tests/solver.ts`), che *gioca* ogni livello: cerca con la fisica vera
  una sequenza di comandi dallo spawn all'arrivo, considerando perso in partenza tutto ciò
  che sparisce sotto le zampe e già scattata ogni trappola. Serve perché un livello può
  avere una geometria ineccepibile ed essere comunque impossibile: basta piazzare una
  trappola istantanea dentro l'unica traiettoria utile, ed è già successo. Se il risolutore
  non trova un percorso, il livello è rotto — e "rotto" non è un sinonimo di "difficile".

  Un avvertimento a chi ci mette le mani: la **chiave di deduplicazione** è parte
  del modello, non un dettaglio di implementazione. È grossolana apposta (quattro
  pixel) perché con una chiave fine la ricerca esplode, ma dentro le sabbie mobili
  è esatta — e ci è voluta la camera sotto la pozza di 3-5 per scoprirlo. Lì si
  affonda a poco più di un pixel al tick, quindi due traiettorie che nello stesso
  quadretto differiscono di due pixel orizzontali non sono "quasi uguali": una
  scavalca la pozza e l'altra ci finisce dentro. Con la chiave grossolana vinceva
  sempre l'arco di salto, la discesa non veniva mai esplorata, e il risolutore
  dichiarava irraggiungibile una stanza in cui il gioco entra benissimo. Un falso
  negativo è meno pericoloso di un falso positivo, ma costa lo stesso un livello.

## Account e classifica (backend Supabase)

Il gioco ha un backend, e l'unica cosa che davvero conta saperne è che **è
opzionale**. Se le due variabili d'ambiente non ci sono, `Account.enabled` è
falso, le voci ACCOUNT e CLASSIFICA non compaiono nel menu, il popup non esce e
il gioco è identico a com'era: progressi in `localStorage` e basta. Un rage game
non può smettere di partire perché è giù un server.

### Cosa c'è di là

`supabase/schema.sql` è tutto lo schema, da eseguire a mano nel SQL Editor di
Supabase. È idempotente. Tre tabelle (`players`, `sessions`, `scores`), RLS
attiva ovunque e **nessuna policy**: dal client non si legge e non si scrive una
riga. L'unica superficie pubblica sono sette funzioni RPC `SECURITY DEFINER`.

Questo è il punto architetturale, non un dettaglio: la chiave `anon` finisce nel
JavaScript pubblicato — è pubblica per costruzione — quindi l'unica difesa vera
è che con quella chiave si possano chiamare solo quelle funzioni. La chiave
`service_role` non entra in questo repo per nessun motivo.

### Come è fatto l'account

Nickname e password, niente email, niente recupero, nessun dato personale. È una
scelta di prodotto e insieme la ragione per cui non c'è niente da gestire in
termini di GDPR: nel database non c'è nulla che identifichi una persona.
Password persa = account perso, ed è dichiarato nel popup **prima** che la
password venga scelta, non dopo.

Non si usa Supabase Auth: vuole per forza un'email o un telefono. La password è
bcrypt via `pgcrypto`, la sessione è un token casuale di cui il database
conserva solo lo sha256. Le funzioni non sollevano eccezioni per gli errori
previsti — rispondono `{"ok": false, "error": "CODICE"}` — perché un'eccezione
annulla la transazione e con lei il contatore dei tentativi di login sbagliati,
che è proprio la cosa che deve sopravvivere.

### Le regole della sincronizzazione

Il client manda tutto quello che sa, il server tiene il meglio delle due parti e
rimanda il risultato, che il client adotta. Un solo giro, uguale al login e a
fine livello. Le regole stanno scritte due volte, in `cb_sync` e in
`net/payload.ts`, e vanno tenute allineate:

| Cosa | Come si fonde | Perché |
|---|---|---|
| tempo, morti del livello | il minore | sono record |
| monete del livello | la maggiore | è il massimo raccolto in un tentativo |
| morti totali | la maggiore | è un contatore, sale e basta |
| gomitoli trovati | l'unione | uno trovato non si perde più |
| imprese compiute | l'unione | una cosa fatta non si disfa |

I gatti sbloccati **non** viaggiano: dipendono solo da cosa hai fatto — gomitoli
e imprese — quindi sincronizzare quelli sincronizza già i gatti, senza che il
server debba fidarsi di una lista di gatti. Il gatto *indossato* non è un
progresso ma una preferenza, e resta in `Settings`, in locale.

Le imprese sono arrivate dopo, quindi `players.feats` nasce da un
`alter table ... add column if not exists`: chi ha già un database deve
rilanciare `schema.sql` (è idempotente) o `cb_sync` fallirà. Un client nuovo
contro un server vecchio non perde niente — la risposta senza `feats` lascia in
piedi quelle locali.

Niente di tutto questo è una verifica anti-imbroglio, e non finge di esserlo. I
controlli sui valori servono a non farsi riempire il database di spazzatura, non
a stabilire se un tempo è vero: un client è un client.

**Ma un filtro anti-spazzatura che sbaglia butta via i dati veri.** `cb_sync`
scarta le chiavi che non hanno la forma di un id di livello, e lo fa con un
`continue`: nessun errore, nessuna eccezione, solo un salvataggio che arriva e
non viene scritto. Ha funzionato così per un po' — il filtro accettava `1-11`
mentre il gioco manda `w1-11` — e il risultato era un database con dentro solo le
morti totali e una classifica sempre vuota. Il formato è ora verificato da
`tests/smoke.ts` contro i livelli veri: chi rinomina un livello lo scopre prima
del deploy.

**`cb_reset` esiste per un motivo preciso.** Senza, "azzera progressi"
mentirebbe: si cancella tutto in locale e alla prima sincronizzazione il server
rimanda indietro ogni record. Chi tocca il salvataggio si ricordi di questo.

### I tempi

Il gioco conta in tick a 60Hz e continuerà a farlo: è l'unica unità identica su
ogni computer. Fuori — classifica, record, database — si parla di millisecondi,
e la conversione sta in `core/loop.ts` (`ticksToMs` / `msToTicks`), all'unico
confine dove serve. L'HUD resta a `m:ss`: tre cifre che girano a 60Hz in un
angolo dello schermo sono rumore mentre si sta saltando.

### Configurazione

`.env.local` in sviluppo (vedi `.env.example`), secrets del repo per il deploy:

```bash
gh secret set VITE_SUPABASE_URL
gh secret set VITE_SUPABASE_ANON_KEY
```

Il workflow le passa a `npm run build` e Vite le cuce dentro al bundle. Se
mancano il deploy funziona lo stesso e pubblica il gioco senza backend.

## Distribuzione

`.github/workflows/deploy.yml` gira a **ogni push su `main`**: test → build → pubblicazione su
GitHub Pages. Il link pubblico è sempre allineato al repo, quindi si vede l'effetto di una
modifica senza fare niente di manuale.

Le **GitHub Releases** si usano solo per marcare versioni giocabili (es. `v0.1 — primo mondo`)
e allegare uno zip offline: non servono a ospitare la pagina.

## Roadmap

1. ~~Riscrittura in TypeScript e riordino del progetto~~ ✅
2. ~~Sistema multi-livello + checkpoint + salvataggio progressi~~ ✅
3. ~~Deploy automatico su Pages~~ ✅
4. ~~Schermata di selezione livelli con record e morti~~ ✅ (dentro il menu)
5. ~~Più trappole e più nemici~~ ✅
6. ~~Secondo mondo con un tileset davvero diverso~~ ✅ — gelo e fabbrica, dieci livelli
   (da 2-6 in poi si dà per scontato tutto quello che i primi cinque spiegano),
   superfici che cambiano la fisica, tre nemici nuovi, gomitoli nascosti e gatti sbloccabili
7. ~~Un boss finale che ovviamente bara~~ ✅ — 1-11, il Padrone: si guida invece di
   inseguirlo, si colpisce col suo stesso soffitto, e scansa mentre cammina.
   E 2-11, Gothic Lucio: sta appeso alla volta, si attira invece di guidarlo, e
   si spegne facendolo cadere sui suoi stessi ceri
8. ~~Account (nickname e password, niente email) e classifica dei tempi~~ ✅ — Supabase
9. ~~Terzo mondo: il deserto e il tempio~~ ✅ — undici livelli, e la regola
   nuova: dopo il pavimento del mondo 2, qui cambia l'**aria** (correnti,
   risucchi, sabbie mobili). Più il primo congegno a distanza (la piastra a
   pressione), il primo nemico che serve a *leggere* il livello invece che a
   chiuderlo (lo scarabeo, che il vento porta come porta te), e quattro
   segreti che stanno ognuno dalla parte sbagliata di una superficie: dietro
   una parete, sotto una pozza, sopra il soffitto, e dietro una parete in
   fondo a una pozza. In fondo la Sfinge, che è il problema di *spazio*
   promesso: il Padrone si guida, Lucio si attira, lei si combatte dentro
   una stanza che sta rompendo.
10. ~~Il quarto mondo: la torre e il Rovescio~~ ✅ — undici livelli, e la
   regola nuova era l'ultima rimasta: dopo il pavimento del mondo 2 e l'aria
   del mondo 3, qui cambia **da che parte si cade**. Il campo rovescio, il suo
   gemello spento (la trappola peggiore del gioco, perché sta in mezzo alla
   strada che stai già percorrendo), tre bestie nuove — il ragno che cammina
   sui soffitti, la zavorra che obbedisce al campo e non a te, il pendolo che
   pende nel verso sbagliato — e sei segreti che stanno in posti in cui non
   verrebbe in mente di andare. In fondo il Rovescio, che è l'unico dei quattro
   boss a cui non si tira niente: si spara addosso l'arena da solo, e si vince
   togliendogli i posti in cui scansarsi.
11. **Il quinto mondo, o quello che verrà** — niente di deciso, e questa volta
   nemmeno la domanda. Pavimento, aria e gravità sono spesi: quello che resta
   non è una quarta dimensione fisica ma un'altra categoria — il tempo, la
   vista, o il fatto che il livello sappia cosa hai fatto l'ultima volta. La
   regola resta quella: se non si riassume in una riga, è una raccolta di
   livelli e non un mondo.
