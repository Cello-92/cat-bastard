# Cat Bastard

## Cos'è

Un **rage game** platform 2D nello stile di *Super Mario Bros.* / *Syobon Action (Cat Mario)*:
sembra un platform classico e onesto, ma ogni elemento familiare è una trappola. Si gioca nel
browser aprendo un link pubblico — niente installazione, niente account.

Il gioco è strutturato **a livelli** su due mondi, con un menu di avvio navigabile (gioca,
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
              taunts, cats (manti sbloccabili), effects (particelle/juice),
              world.ts (orchestratore), game.ts (composition root)
    entities/ player, walker, shroom, falling-spike, diver,
              sentry, drone, snowball, boss + rubble (solo 1-11)
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

### Il Padrone: l'arena di 1-11

Tre tile esistono solo dentro l'arena del boss, e non compaiono in nessun altro
livello. Non sono trappole: sono l'attrezzatura di uno scontro.

| Tile | Cosa sembra | Cosa fa |
|---|---|---|
| `@` | niente, sparisce al caricamento | marcatore: qui nasce il Padrone |
| `?` | mattone del soffitto | ci sali, trema, si stacca. È l'unica arma contro di lui |
| `|` | portone chiuso | solido finché il Padrone è vivo, aperto quando cade |

Il combattimento sta in `world.ts` (`handleBossFight`, `bossSlam`, `onBossRage`)
e non dentro l'entità, per la regola di sempre: serve sapere insieme dove sta il
masso e dove sta il boss, e quel posto è uno solo. Il risolutore non sa niente di
tutto questo — tratta il mattone come un appoggio che sparisce e il portone come
già aperto — quindi il contratto dello scontro si verifica in `smoke.ts`.

**Attenzione ai caratteri.** `?` e `|` sono quello che sono perché `H` e `=`
erano già presi da `SENTRY` e `STEEL`: due tile diversi con lo stesso carattere
non danno nessun errore, danno un livello che si carica sbagliato. Prima di
battezzare un tile nuovo, guardare tutto `TILE`.

### Il menu

Il menu è un menu da console che vive nel DOM: frecce, Invio, Esc — e le stesse
voci restano cliccabili e toccabili, perché il gioco gira in un browser e
nessuno dei tre modi va penalizzato. `ui/menu.ts` non sa niente di Cat Bastard:
riceve pagine (titolo, corpo, righe, voci) e le disegna. Chi decide *cosa* c'è
in una pagina è `game.ts`, che è il composition root.

Tre cose da sapere prima di toccarlo:

- **La gerarchia è a due livelli, non piatta.** Radice → mondi → livelli. Con
  ventuno livelli una lista sola non è una lista, è uno scorrimento; e i mondi
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
| `*` | un gomitolo | l'unica cosa del gioco che non uccide: sblocca i gatti |

**Non tutti i livelli ne hanno uno, ed è il punto.** Da 2-1 a 2-6 ce n'era uno
ovunque, e cercarlo aveva smesso di essere cercare: era diventato raccogliere. 2-7
e 2-9 non ne hanno nessuno, quindi da lì in poi una parete che sembra finta a volte
è solo una parete, e l'unico modo di saperlo è perderci tempo. Chi aggiunge un
livello non è tenuto a metterci un gomitolo: `SECRET_COUNT` si conta dalle mappe.

**Ma chi ce lo mette deve mettere anche il gatto.** C'è un manto per ogni
gomitolo — undici gomitoli, dodici gatti contando quello che c'è da sempre — e
`tests/smoke.ts` rifiuta un buco nella scala. Non è pignoleria: un gomitolo sta
in una stanza murata che non serve a finire il livello, quindi l'unica ragione
per andarci è quello che dà. Se il quinto e il sesto dessero la stessa identica
cosa (cioè niente), cercare il sesto sarebbe una perdita di tempo *dimostrabile*.
Le soglie dei primi cinque manti non si toccano mai: i progressi salvano
gomitoli, non gatti, quindi alzare una soglia richiude una porta già aperta a
qualcuno.

I manti stanno in `game/cats.ts` e sono
**solo estetici**, per due motivi: un gatto che salta più in alto romperebbe ogni
mappa già tarata su `config.ts`, e una collezione che dà vantaggi smette di essere
una ricompensa e diventa una scorciatoia. I gomitoli trovati stanno nei progressi
(`core/storage.ts`) e non si perdono più.

I colori dei manti non stanno lì: stanno in `PELT` e `IRIS` (`game/theme.ts`),
come tutti gli altri colori del gioco. `cats.ts` decide *quale* manto ha un gatto
e come si sblocca; `theme.ts` di che pasta è fatto. Il motivo del manto
(`CatPattern`: tinta unita, soriano, punte, pettorina, chiazze, rosette) è
l'unica cosa che richiede di toccare il disegno — `drawMarkings` in
`entities/player.ts`, che il ritratto del menu riusa tale e quale.

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
  (solido? letale?), il suo disegno in `game/render/tiles.ts`.
- **Un nemico**: una classe in `game/entities/` che estende `Entity` e implementa
  `update`/`draw`/`onTouch`/`onStomp`. Se nasce da un tile, aggiungerlo agli spawner.

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

`tests/` contiene otto cose diverse:

- **lo smoke test**, che esegue il gioco headless contro un `NullRenderer` capace di
  intercettare coordinate NaN e `push`/`pop` sbilanciati. Non dice se il gioco è bello,
  dice se esplode;
- **i controlli sulle trappole**, che costruiscono un mondo minimo per ciascuna e ne
  verificano il contratto (la moneta esca uccide e non viene contata, gli spuntoni
  invisibili tornano invisibili se ricominci il livello, il nastro trasporta senza
  toccare la velocità del gatto, e così via);
- **l'igiene delle mappe**, che cerca gli errori che non rompono niente: una molla
  disegnata a mezz'aria, spuntoni invisibili sospesi sul vuoto, un nastro murato
  sotto un solido, un carattere sconosciuto (che è aria, quindi la trappola che
  credevi di aver messo non c'è), un checkpoint dopo l'arrivo;
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
- **il risolutore** (`tests/solver.ts`), che *gioca* ogni livello: cerca con la fisica vera
  una sequenza di comandi dallo spawn all'arrivo, considerando perso in partenza tutto ciò
  che sparisce sotto le zampe e già scattata ogni trappola. Serve perché un livello può
  avere una geometria ineccepibile ed essere comunque impossibile: basta piazzare una
  trappola istantanea dentro l'unica traiettoria utile, ed è già successo. Se il risolutore
  non trova un percorso, il livello è rotto — e "rotto" non è un sinonimo di "difficile".

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

I gatti sbloccati **non** viaggiano: dipendono solo da quanti gomitoli hai, quindi
sincronizzare i gomitoli sincronizza già i gatti, senza che il server debba
fidarsi di una lista di gatti. Il gatto *indossato* non è un progresso ma una
preferenza, e resta in `Settings`, in locale.

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
   inseguirlo, si colpisce col suo stesso soffitto, e scansa mentre cammina
8. ~~Account (nickname e password, niente email) e classifica dei tempi~~ ✅ — Supabase
