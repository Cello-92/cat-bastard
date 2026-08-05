import { Audio } from '@core/audio';
import { GameLoop } from '@core/loop';
import { Input, type Action } from '@core/input';
import { Canvas2DRenderer } from '@engine/render/canvas2d';
import type { Renderer } from '@engine/render/renderer';
import {
  buySkin,
  equipSkin,
  loadProgress,
  loadSettings,
  recordClear,
  recordSecret,
  resetProgress,
  saveSettings,
  unlockSkin,
  type Progress,
  type Settings,
} from '@core/storage';
import { Hud } from '@ui/hud';
import { bindFullscreenKey, isFullscreen, toggleFullscreen } from '@ui/fullscreen';
import { Menu, type MenuItem } from '@ui/menu';
import { Screens } from '@ui/screens';
import { formatTicks, plural } from '@ui/format';
import { CATS, catById, catRequirement, isCatUnlocked, type UnlockState } from './cats';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { LEVELS, SECRET_COUNT, firstLevel } from './levels';
import { World, type RunStats } from './world';

/**
 * Composition root: mette insieme loop, input, audio, renderer, mondo e UI.
 *
 * È l'unico file che conosce tutti i pezzi. Ogni altro modulo dipende solo da
 * ciò che gli serve, ed è questo che tiene il progetto scalabile: aggiungere un
 * sistema significa istanziarlo qui, non cablarlo ovunque.
 *
 * Le fasi sono tre e si escludono: nel menu la simulazione è ferma ma il mondo
 * continua a disegnarsi dietro le voci (fa da fondale vivo); in gioco corre;
 * tra un livello e l'altro resta congelata sulla schermata di fine livello.
 */

type Phase = 'menu' | 'playing' | 'between';

export class Game {
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly audio = new Audio();
  private readonly hud: Hud;
  private readonly screens: Screens;
  private readonly menu: Menu;
  private readonly loop: GameLoop;

  private world: World;
  private levelIndex = 0;
  private phase: Phase = 'menu';
  private progress: Progress;
  private settings: Settings;

  constructor(root: Document | HTMLElement = document) {
    const canvas = root.querySelector<HTMLCanvasElement>('#stage');
    if (!canvas) throw new Error('Canvas #stage non trovato');

    this.renderer = new Canvas2DRenderer(canvas, VIEW_WIDTH, VIEW_HEIGHT);
    this.input = new Input();
    this.hud = new Hud(root);
    this.progress = loadProgress();
    this.settings = loadSettings();
    this.audio.setEnabled(this.settings.audio);

    this.screens = new Screens(root, {
      onContinue: () => this.continueAfterWin(),
    });

    const panel = root.querySelector<HTMLElement>('[data-screen="menu"]');
    if (!panel) throw new Error('Pannello del menu non trovato');
    this.menu = new Menu(panel, {
      onMove: () => this.audio.play('bump'),
      onChoose: () => this.audio.play('ui'),
      onPauseRequest: () => this.pause(),
    });

    this.world = this.createWorld(0);
    this.bindTouchControls(root);
    // Entrando o uscendo dallo schermo intero la voce di menu cambia etichetta.
    bindFullscreenKey(() => {
      if (this.phase === 'menu') this.showRootMenu();
    });

    this.loop = new GameLoop(
      () => this.update(),
      () => this.render(),
    );
  }

  start(): void {
    this.openMenu();
    this.loop.start();
  }

  // ---------------------------------------------------------------- setup
  private createWorld(index: number): World {
    const level = LEVELS[index] ?? firstLevel();
    const world = new World(level, this.audio, {
      onTaunt: (text) => this.screens.showTaunt(text),
      onWin: (stats) => this.handleWin(stats),
      // Il gomitolo si segna appena raccolto, non a fine livello: chi lo
      // trova e poi muore l'ha comunque trovato.
      onSecret: () => {
        this.progress = recordSecret(this.progress, level.id);
      },
    });
    world.player.skin = catById(this.settings.cat);
    return world;
  }

  /** Stato di sblocco dei gatti, ricavato dai progressi. */
  private get unlockState(): UnlockState {
    return {
      yarn: this.progress.secrets.length,
      everyLevelCleared: LEVELS.every((level) => this.progress.levels[level.id]?.cleared),
    };
  }

  private bindTouchControls(root: ParentNode): void {
    if (matchMedia('(hover: none)').matches) document.body.classList.add('is-touch');
    for (const el of root.querySelectorAll<HTMLElement>('[data-action]')) {
      const action = el.dataset['action'] as Action | undefined;
      if (action) this.input.bindTouch(el, action);
    }
    // Su touch non esiste Esc: la pausa ha bisogno di un tasto suo.
    root.querySelector('[data-act="pause"]')?.addEventListener('click', () => this.pause());
  }

  // ---------------------------------------------------------------- menu
  /** Livello da cui riprende "CONTINUA": il primo non ancora superato. */
  private get resumeIndex(): number {
    const next = LEVELS.findIndex((level) => !this.progress.levels[level.id]?.cleared);
    return next < 0 ? 0 : next;
  }

  /** Un livello è giocabile se è il primo o se il precedente è stato superato. */
  private isUnlocked(index: number): boolean {
    if (index === 0) return true;
    const previous = LEVELS[index - 1];
    return previous ? (this.progress.levels[previous.id]?.cleared ?? false) : false;
  }

  private openMenu(): void {
    this.phase = 'menu';
    this.screens.hideAll();
    this.screens.clearTaunt();
    this.input.releaseAll();
    this.showRootMenu();
  }

  private showRootMenu(): void {
    const resume = this.resumeIndex;
    const started = resume > 0 || this.progress.totalDeaths > 0;
    const cleared = LEVELS.filter((level) => this.progress.levels[level.id]?.cleared).length;
    const yarn = this.progress.secrets.length;

    this.menu.show({
      title: started
        ? `${cleared} livelli su ${LEVELS.length} · ${plural(this.progress.totalDeaths, 'morte', 'morti')} in totale · ${plural(yarn, 'gomitolo', 'gomitoli')}`
        : 'Un platform che ti odia. Ogni blocco è sospetto, ogni fungo è una trappola, la bandiera potrebbe non essere la bandiera.',
      items: [
        {
          label: cleared > 0 ? 'CONTINUA' : 'GIOCA',
          value: LEVELS[resume]?.name ?? '',
          hint: LEVELS[resume]?.title ?? '',
          onSelect: () => this.startLevel(resume),
        },
        {
          label: 'LIVELLI',
          hint: 'Rigioca quello che hai già sofferto, e guarda i record',
          onSelect: () => this.showLevelsMenu(),
        },
        {
          label: 'GATTI',
          value: catById(this.settings.cat).name,
          hint: 'I gomitoli nascosti nei livelli servono a questo, e solo a questo',
          onSelect: () => this.showCatsMenu(),
        },
        {
          label: 'SCHERMO INTERO',
          value: isFullscreen() ? 'ON' : 'OFF',
          hint: 'Anche col tasto F, in qualunque momento',
          onSelect: () => {
            toggleFullscreen();
            this.showRootMenu();
          },
        },
        {
          label: 'AUDIO',
          value: this.settings.audio ? 'ON' : 'OFF',
          hint: 'Suoni sintetizzati, nessun file: si spengono e si riaccendono qui',
          onSelect: () => this.toggleAudio(),
        },
        {
          label: 'COMANDI',
          hint: 'Come si muove il gatto, e cosa non è colpa dei comandi',
          onSelect: () => this.showHelpMenu(),
        },
        {
          label: 'AZZERA PROGRESSI',
          hint: 'Cancella record, morti e livelli sbloccati. Non si torna indietro',
          onSelect: () => this.showResetMenu(),
        },
      ],
    });
  }

  private showLevelsMenu(): void {
    const items: MenuItem[] = LEVELS.map((level, index) => {
      const record = this.progress.levels[level.id];
      const unlocked = this.isUnlocked(index);
      // Il gomitolo si segnala solo nei livelli che ne hanno uno: un livello
      // senza segreti non deve sembrare un livello con un segreto mancato.
      const hasSecret = level.rows.some((row) => row.includes('*'));
      const gotSecret = this.progress.secrets.includes(level.id);
      const yarnMark = hasSecret ? (gotSecret ? ' · GOMITOLO' : ' · ·') : '';

      return {
        label: `${level.name}   ${level.title}`,
        value: record?.cleared
          ? `${plural(record.bestDeaths, 'morte', 'morti')} · ${formatTicks(record.bestTicks)}${yarnMark}`
          : unlocked
            ? `MAI FINITO${yarnMark}`
            : 'BLOCCATO',
        hint: unlocked
          ? record?.cleared
            ? `Record: ${plural(record.bestDeaths, 'morte', 'morti')}, ${formatTicks(record.bestTicks)}, ${plural(record.bestCoins, 'moneta', 'monete')}`
            : 'Mai superato. Prima o poi.'
          : `Finisci ${LEVELS[index - 1]?.name ?? ''} per sbloccarlo`,
        locked: !unlocked,
        onSelect: () => this.startLevel(index),
      };
    });

    items.push({ label: 'INDIETRO', onSelect: () => this.showRootMenu() });

    this.menu.show({
      title: 'LIVELLI',
      items,
      onBack: () => this.showRootMenu(),
    });
  }

  /**
   * La collezione.
   *
   * Cambiare gatto non cambia niente di quello che succede: è l'unica
   * schermata del gioco che non nasconde nulla, e serve esattamente a questo —
   * a far vedere che quando il gioco promette qualcosa di gratis, ogni tanto
   * lo mantiene.
   */
  private showCatsMenu(): void {
    const state = this.unlockState;

    const items: MenuItem[] = CATS.map((cat) => {
      const unlocked = isCatUnlocked(cat, state);
      const current = this.settings.cat === cat.id;
      return {
        label: cat.name,
        value: current ? 'IN USO' : unlocked ? '' : 'BLOCCATO',
        hint: unlocked ? cat.blurb : catRequirement(cat, state),
        locked: !unlocked,
        onSelect: () => {
          this.settings = { ...this.settings, cat: cat.id };
          saveSettings(this.settings);
          this.world.player.skin = cat;
          this.showCatsMenu();
        },
      };
    });

    items.push({ label: 'INDIETRO', onSelect: () => this.showRootMenu() });

    this.menu.show({
      title: `GATTI · ${plural(state.yarn, 'gomitolo', 'gomitoli')} su ${SECRET_COUNT}`,
      body: [
        'Ogni livello nasconde un gomitolo dietro qualcosa che sembra un muro.',
        'Non danno nessun vantaggio: cambiano solo la faccia di chi muore.',
      ],
      items,
      onBack: () => this.showRootMenu(),
    });
  }

  private showHelpMenu(): void {
    this.menu.show({
      title: 'COMANDI',
      body: [
        'A D  oppure  ← →     muoversi',
        'SPAZIO / W / ↑     saltare, e più lo tieni premuto più salti in alto',
        'R     ricominciare il livello da capo',
        'ESC     pausa',
        'F     schermo intero',
        'I comandi non tradiscono mai: niente ritardi, niente tasti invertiti. Se sei morto è colpa del livello, ed era voluto.',
      ],
      items: [{ label: 'INDIETRO', onSelect: () => this.showRootMenu() }],
      onBack: () => this.showRootMenu(),
    });
  }

  private showResetMenu(): void {
    this.menu.show({
      compact: true,
      title: 'AZZERARE TUTTO?',
      body: [
        'Record, morti totali, monete, gatti sbloccati e livelli: sparisce tutto. Anche i cubi nascosti tornano dove erano.',
      ],
      items: [
        { label: 'NO, LASCIA STARE', onSelect: () => this.showRootMenu() },
        {
          label: 'SÌ, CANCELLA',
          hint: 'Si riparte da 1-1 come il primo giorno',
          onSelect: () => {
            this.progress = resetProgress();
            this.showRootMenu();
          },
        },
      ],
      onBack: () => this.showRootMenu(),
    });
  }

  private toggleAudio(): void {
    this.settings = { ...this.settings, audio: !this.settings.audio };
    this.audio.setEnabled(this.settings.audio);
    saveSettings(this.settings);
    if (this.settings.audio) this.audio.play('ui');
    // La voce mostra il proprio stato: va ridisegnata dopo averlo cambiato.
    this.showRootMenu();
  }

  /** Pausa: esiste solo durante il gioco. */
  private pause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'menu';
    this.input.releaseAll();
    this.menu.show({
      compact: true,
      title: `PAUSA · ${this.world.level.name} — ${this.world.level.title}`,
      items: [
        { label: 'RIPRENDI', onSelect: () => this.resume() },
        {
          label: 'RICOMINCIA IL LIVELLO',
          hint: 'Azzera anche le morti di questo tentativo',
          onSelect: () => {
            this.world.restart();
            this.resume();
          },
        },
        { label: 'MENU PRINCIPALE', onSelect: () => this.openMenu() },
      ],
      onBack: () => this.resume(),
    });
  }

  private resume(): void {
    this.menu.hide();
    this.screens.hideAll();
    this.phase = 'playing';
  }

  // ---------------------------------------------------------------- flusso
  private startLevel(index: number): void {
    this.audio.unlock();
    this.levelIndex = index;
    this.world = this.createWorld(index);
    this.menu.hide();
    this.screens.hideAll();
    this.screens.clearTaunt();
    this.phase = 'playing';
  }

  private handleWin(stats: RunStats): void {
    this.phase = 'between';
    const levelId = this.world.level.id;
    const before = this.progress;
    this.progress = recordClear(this.progress, levelId, stats);

    const isLast = this.levelIndex >= LEVELS.length - 1;
    const yarn = stats.secret ? ' · gomitolo trovato' : '';
    const summary = `${plural(stats.deaths, 'morte', 'morti')} · ${plural(stats.coins, 'moneta', 'monete')} · ${formatTicks(stats.ticks)} di sofferenza${yarn}`;

    if (isLast) {
      this.screens.showLevelComplete({
        heading: 'SEI ARRIVATO',
        sub: 'DAVVERO',
        stats: `Hai finito tutti i livelli. ${summary}`,
        buttonLabel: 'TORNA AL MENU',
      });
    } else {
      const next = LEVELS[this.levelIndex + 1];
      this.screens.showLevelComplete({
        heading: 'LIVELLO',
        sub: 'FATTO',
        stats: `${summary}\nProssimo: ${next?.name ?? ''} — ${next?.title ?? ''}`,
        buttonLabel: 'CONTINUA',
      });
    }
  }

  private continueAfterWin(): void {
    this.audio.play('ui');
    // Finito l'ultimo livello si torna al menu: è lì che si vedono i record,
    // ed è l'unico momento in cui il gioco smette di spingere avanti.
    if (this.levelIndex >= LEVELS.length - 1) {
      this.openMenu();
      return;
    }
    this.startLevel(this.levelIndex + 1);
  }

  // ---------------------------------------------------------------- ciclo
  private update(): void {
    if (this.phase === 'playing') {
      if (this.input.justPressed('restart')) {
        this.world.restart();
        this.screens.clearTaunt();
      }
      this.world.update(this.input);
    }

    // Va consumato SEMPRE, anche a gioco fermo: altrimenti un tasto premuto
    // durante una schermata resterebbe "appena premuto" per sempre.
    this.input.endTick();
  }

  private render(): void {
    // Il mondo si disegna anche dietro al menu: fa da fondale, e mostra subito
    // di che gioco si tratta senza dover premere niente.
    this.world.draw(this.renderer, this.loop.tick);
    this.hud.update({
      deaths: this.world.deaths,
      coins: this.world.coins,
      ticks: this.world.ticks,
      levelName: this.world.level.name,
    });
  }
}
