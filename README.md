<div align="center">

# 🐈‍⬛ CAT BASTARD

**Un platform 2D che ti odia.**

Sembra *Super Mario*. Si comporta come *Cat Mario*.<br>
Ogni blocco è sospetto, ogni fungo è una trappola, la bandiera potrebbe non essere la bandiera.

### [▶︎ GIOCA ORA](https://diamond26.github.io/cat-bastard/)

Niente installazione. Niente account. Niente pietà.

<sub>TypeScript · Canvas 2D · zero dipendenze a runtime · zero asset binari</sub>

</div>

---

## Il patto

Un rage game funziona solo se è **ingiusto ma leale**. Qui la regola è una sola:

> Il gioco è bastardo nei **contenuti**, mai nella **risposta ai comandi**.

Quindi niente input lag, niente comandi invertiti, niente hitbox bugiarde: ci
sono coyote time e jump buffer apposta. Se sei morto è colpa del livello, ed era
voluto.

E niente trappole casuali. Stesso punto, stessa morte, sempre — perché l'unica
cosa che ti resta è **imparare il livello a memoria**, ed è quello il gameplay.
Metà delle trappole non ti dà alcun preavviso; tutte, dopo, ti lasciano capire
esattamente cosa ti ha fregato.

## Cosa ti aspetta

Quattro livelli, un gatto, e un numero imbarazzante di modi per morire.

| | |
|---|---|
| 🟨 **Il blocco premio** | ne sputa un fungo che ti insegue e non si può schiacciare |
| 🪙 **La moneta** | una su tre è avvelenata, e sono identiche |
| 🏁 **La bandiera** | ce n'è più di una, e solo l'ultima è l'arrivo |
| 🪤 **Il gemello cattivo** | stesso nemico, stessa faccia, ma ha le punte sotto |
| 🕳️ **Il pavimento** | a volte non c'è. Te ne accorgi mentre cadi |
| 🏮 **Il checkpoint** | quella lanterna non si accende mai, sai |
| 🔻 **Gli spuntoni invisibili** | la prima morte è gratis. La seconda è colpa tua |

Chi arriva in fondo ha imparato dove si muore. Non è la stessa cosa di essere bravo.

## Comandi

| Azione | Tasti |
|---|---|
| Muoviti | `A` `D` · `←` `→` |
| Salta | `Spazio` · `W` · `↑` |
| Ricomincia il livello | `R` |
| Pausa | `Esc` |
| Schermo intero | `F` |

Il salto è ad **altezza variabile**: più tieni premuto, più sali. Serve, perché
in certi punti saltare troppo in alto è esattamente ciò che ti ammazza.
Su mobile compaiono i comandi a schermo.

## Come è fatto

Tre strati, dipendenze a senso unico: `game` → `engine` → `core`.

```
src/
  core/       loop a 60Hz fissi, input, audio sintetizzato, storage
              Non sanno niente di Cat Bastard: sono riutilizzabili ovunque.
  engine/     tilemap, fisica AABB su griglia, camera
    render/   interfaccia Renderer + backend Canvas 2D
              Motore 2D generico: non conosce il significato dei tile.
  game/       tile, trappole, entità, livelli, effetti, atmosfere
    entities/ il gatto e chi lo vuole morto
    levels/   un file per livello, mappe ASCII leggibili nel sorgente
    render/   sfondo a sette piani e disegno dei materiali
  ui/         menu, HUD, schermate — l'unico codice che tocca il DOM
tests/        smoke test e risolutore, girano in CI
```

Qualche scelta che vale la pena raccontare:

- **Niente asset.** Non un PNG, non un WAV. La grafica è disegnata da codice
  (materiali con luce, ombra e riflesso speculare, prospettiva aerea su sette
  piani di profondità), l'audio è sintetizzato con WebAudio.
- **Il gioco non tocca mai il canvas.** Disegna solo attraverso l'interfaccia
  `Renderer`: è il punto in cui un giorno si innesta un backend WebGL senza
  riscrivere una riga di gameplay.
- **Risoluzione logica fissa a 800×480.** Fisica e mappe sono tarate lì sopra.
  Il canvas rasterizza fino a 2× e nasconde la scala in una trasformazione di
  base, così il gioco riempie lo schermo senza che nessun salto cambi.
- **Timestep fisso.** La simulazione gira a 60 update al secondo comunque: su un
  monitor a 144Hz il gatto non salta più in alto.

## Il risolutore

Il test più interessante del progetto non controlla che il gioco non esploda:
controlla che i livelli **si possano finire**.

È nato da un bug vero. Una moneta avvelenata era finita esattamente dentro
l'unico arco utile per scavalcare una fossa di spuntoni, con una lama a soffitto
a chiudere l'alternativa: due trappole ragionevoli prese una per una, un muro
invalicabile prese insieme. La geometria era ineccepibile — a non essere
percorribile era la *traiettoria*, e nessun controllo sulla mappa lo avrebbe mai
visto.

Così ora, a ogni test, un risolutore **gioca ogni livello**: esplora gli stati
raggiungibili del gatto usando la fisica vera del gioco e cerca una sequenza di
comandi che porti dallo spawn all'arrivo. Considera perso in partenza tutto ciò
che sparisce sotto le zampe e già scattata ogni trappola che potrebbe scattare.
Se non trova un percorso, la build fallisce.

Difficile sì. Impossibile no.

## Sviluppo

Serve Node 22+.

```bash
npm install
npm run dev        # server di sviluppo con hot reload
npm test           # struttura livelli + risolutore + smoke test + regressioni
npm run build      # typecheck + build di produzione in dist/
npm run preview    # anteprima della build
```

`npm test` è headless e gira in CI: esegue il gioco contro un renderer finto che
intercetta coordinate NaN e trasformazioni lasciate aperte, verifica il
contratto di ogni trappola, e prova a finire i livelli.

## Deploy

Ogni push su `main` fa partire la GitHub Action in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): test, build e
pubblicazione su GitHub Pages. Il link in cima è sempre allineato al repo.

---

<div align="center">
<sub>Le istruzioni di progetto per lavorarci stanno in <a href="CLAUDE.md">CLAUDE.md</a>.<br>
Suggerimento: la seconda volta che muori nello stesso punto non è sfortuna.</sub>
</div>
