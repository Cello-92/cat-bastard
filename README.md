# Cat Bastard

Un platform 2D che ti odia. Sembra Super Mario, si comporta come *Cat Mario*:
ogni blocco è sospetto, ogni fungo è una trappola, la bandiera potrebbe non
essere la bandiera.

**▶ Gioca: https://diamond26.github.io/cat-bastard/**

Niente installazione, niente account. Gira nel browser, anche da telefono.

## Comandi

| Azione     | Tasti                    |
| ---------- | ------------------------ |
| Muoviti    | `A` `D` oppure `←` `→`   |
| Salta      | `Spazio`, `W` oppure `↑` |
| Ricomincia | `R`                      |

Il salto è ad altezza variabile: tieni premuto per saltare più in alto.
Su mobile compaiono i comandi a schermo.

## Sviluppo

Serve Node 22+.

```bash
npm install
npm run dev        # server di sviluppo con hot reload
npm test           # smoke test headless (logica + rendering)
npm run build      # typecheck + build di produzione in dist/
npm run preview    # anteprima della build
```

## Struttura

```
src/
  core/      loop, input, audio, storage, math — non sanno niente di Cat Bastard
  engine/    tilemap, fisica, camera, renderer — motore 2D generico
    render/  interfaccia Renderer + backend Canvas 2D
  game/      regole, tile, entità, livelli, effetti — il gioco vero e proprio
    entities/  giocatore e nemici
    levels/    un file per livello, mappe ASCII
    render/    sfondo a parallasse e disegno dei tile
  ui/        HUD e schermate in DOM
tests/       smoke test eseguito in CI
legacy/      il prototipo originale in un singolo file HTML
```

Stack: **TypeScript + Vite**, zero dipendenze a runtime, rendering su Canvas 2D
dietro un'interfaccia sostituibile.

## Deploy

Ogni push su `main` fa partire la GitHub Action in `.github/workflows/deploy.yml`,
che esegue test e build e pubblica `dist/` su GitHub Pages. Il link sopra è
sempre allineato al contenuto del repo.

Le istruzioni di progetto per lavorarci stanno in [CLAUDE.md](CLAUDE.md).
