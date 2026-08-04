# Cat Bastard

## Cos'è

Un **rage game** platform 2D nello stile di *Super Mario Bros.* / *Syobon Action (Cat Mario)*:
sembra un platform classico e onesto, ma ogni elemento familiare è una trappola. Si gioca nel
browser aprendo un link pubblico — niente installazione, niente account.

Il gioco è strutturato **a livelli**. Il protagonista è un gatto. Il tono è ironico e cattivo:
il gioco ti prende in giro mentre muori. I testi in-game sono **in italiano**.

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
   Per questo la stalattite ha un preavviso e le assi marce tremano prima di cedere.

## Stack e vincoli tecnici

- **TypeScript + Vite**, `strict` con tutti i flag di rigore attivi (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, ...). Il typecheck fa parte della build.
- **Zero dipendenze a runtime.** Niente framework, niente librerie, niente CDN. Solo devDependencies
  (Vite, TypeScript, @types/node). Se serve una libreria, prima chiedersi perché.
- **Rendering su Canvas 2D dietro l'interfaccia `Renderer`** (`engine/render/renderer.ts`).
  Il gioco non tocca **mai** il contesto canvas direttamente: disegna solo via `Renderer`.
  È il punto di sostituzione per un futuro backend WebGL.
- **Nessun asset binario.** Grafica disegnata via codice, audio sintetizzato con WebAudio.
- **Path relativi** (`base: './'` in vite.config): il sito vive in una sottocartella.
- **60fps su hardware modesto**, e deve funzionare su mobile (pad touch già presente).
- Codice e nomi in **inglese**, commenti e testi di gioco in **italiano**.

## Architettura

Tre strati, con dipendenze a senso unico: `game` → `engine` → `core`. Mai il contrario.

```
src/
  core/       loop (timestep fisso 60Hz), input, audio, storage, math
              Non sanno niente di Cat Bastard: sono riutilizzabili ovunque.
  engine/     tilemap, physics (AABB su griglia), camera
    render/   renderer.ts (interfaccia) + canvas2d.ts (backend)
              Motore 2D generico: non conosce il significato dei tile.
  game/       config (costanti), theme (palette), tiles (vocabolario),
              taunts, effects (particelle/juice), world.ts (orchestratore),
              game.ts (composition root)
    entities/ player, walker, shroom, falling-spike
    levels/   level.ts (helper) + un file per livello + index.ts (registro)
    render/   background.ts (parallasse), tiles.ts (disegno dei tile)
  ui/         hud.ts, screens.ts, format.ts — l'unico codice che tocca il DOM
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
- **Colori solo in `theme.ts`**, mai hardcoded nel codice di disegno (i valori UI sono duplicati in
  `src/style.css`: vanno tenuti allineati a mano).

### Aggiungere roba

- **Un livello**: nuovo file in `game/levels/`, poi appenderlo a `LEVELS` in `levels/index.ts`.
  Nient'altro. Le mappe sono ASCII, un segmento largo 20 colonne per riga di codice.
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
- **Ogni tile ha luce in alto, ombra in basso a destra, e un dettaglio che ne racconta la funzione.**
  Le texture sono deterministiche (derivate da riga/colonna): il mondo non sfarfalla mai.
- **HUD e schermate in DOM**, non su canvas: testo nitido, accessibile, gratis per il renderer.
- Coerenza prima di tutto: meglio uno stile semplice ovunque che effetti belli scoordinati.

## Verifica

```bash
npm run dev     # provare a mano: è l'unico modo di sapere se è divertente
npm test        # smoke test: 600 tick per livello con rendering, morte, vittoria
npm run build   # typecheck + build
```

Lo smoke test (`tests/`) esegue il gioco headless contro un `NullRenderer` che intercetta
coordinate NaN e `push`/`pop` sbilanciati. Non dice se il gioco è bello, dice se esplode.

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
4. Schermata di selezione livelli, che mostri record e morti per livello
   (i dati sono già salvati da `core/storage.ts`, manca solo la UI).
5. Più trappole e più nemici; un secondo mondo con un tileset diverso.
6. Un boss finale che ovviamente bara.
