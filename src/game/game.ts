import { Audio } from '@core/audio';
import { GameLoop } from '@core/loop';
import { Input, type Action } from '@core/input';
import { Canvas2DRenderer } from '@engine/render/canvas2d';
import type { Renderer } from '@engine/render/renderer';
import { loadProgress, recordClear, type Progress } from '@core/storage';
import { Hud } from '@ui/hud';
import { Screens } from '@ui/screens';
import { formatTicks, plural } from '@ui/format';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { LEVELS, firstLevel } from './levels';
import { World, type RunStats } from './world';

/**
 * Composition root: mette insieme loop, input, audio, renderer, mondo e UI.
 *
 * È l'unico file che conosce tutti i pezzi. Ogni altro modulo dipende solo da
 * ciò che gli serve, ed è questo che tiene il progetto scalabile: aggiungere un
 * sistema significa istanziarlo qui, non cablarlo ovunque.
 */

type Phase = 'title' | 'playing' | 'between';

export class Game {
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly audio = new Audio();
  private readonly hud: Hud;
  private readonly screens: Screens;
  private readonly loop: GameLoop;

  private world: World;
  private levelIndex = 0;
  private phase: Phase = 'title';
  private progress: Progress;

  constructor(root: Document | HTMLElement = document) {
    const canvas = root.querySelector<HTMLCanvasElement>('#stage');
    if (!canvas) throw new Error('Canvas #stage non trovato');

    this.renderer = new Canvas2DRenderer(canvas, VIEW_WIDTH, VIEW_HEIGHT);
    this.input = new Input();
    this.hud = new Hud(root);
    this.progress = loadProgress();

    this.screens = new Screens(root, {
      onStart: () => this.startRun(),
      onContinue: () => this.continueAfterWin(),
    });

    this.world = this.createWorld(0);
    this.bindTouchControls(root);

    this.loop = new GameLoop(
      () => this.update(),
      () => this.render(),
    );
  }

  start(): void {
    this.screens.showTitle();
    this.loop.start();
  }

  // ---------------------------------------------------------------- setup
  private createWorld(index: number): World {
    const level = LEVELS[index] ?? firstLevel();
    return new World(level, this.audio, {
      onTaunt: (text) => this.screens.showTaunt(text),
      onWin: (stats) => this.handleWin(stats),
    });
  }

  private bindTouchControls(root: ParentNode): void {
    if (matchMedia('(hover: none)').matches) document.body.classList.add('is-touch');
    for (const el of root.querySelectorAll<HTMLElement>('[data-action]')) {
      const action = el.dataset.action as Action | undefined;
      if (action) this.input.bindTouch(el, action);
    }
  }

  // ---------------------------------------------------------------- flusso
  private startRun(): void {
    this.audio.unlock();
    this.audio.play('ui');
    this.levelIndex = 0;
    this.world = this.createWorld(this.levelIndex);
    this.screens.hideAll();
    this.screens.clearTaunt();
    this.phase = 'playing';
  }

  private handleWin(stats: RunStats): void {
    this.phase = 'between';
    this.progress = recordClear(this.progress, this.world.level.id, stats);

    const isLast = this.levelIndex >= LEVELS.length - 1;
    const summary = `${plural(stats.deaths, 'morte', 'morti')} · ${plural(stats.coins, 'moneta', 'monete')} · ${formatTicks(stats.ticks)} di sofferenza`;

    if (isLast) {
      this.screens.showLevelComplete({
        heading: 'SEI ARRIVATO',
        sub: 'DAVVERO',
        stats: `Hai finito tutti i livelli. ${summary}`,
        buttonLabel: 'ANCORA',
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
    const isLast = this.levelIndex >= LEVELS.length - 1;
    this.levelIndex = isLast ? 0 : this.levelIndex + 1;
    this.world = this.createWorld(this.levelIndex);
    this.screens.hideAll();
    this.screens.clearTaunt();
    this.phase = 'playing';
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
    this.world.draw(this.renderer, this.loop.tick);
    this.hud.update({
      deaths: this.world.deaths,
      coins: this.world.coins,
      ticks: this.world.ticks,
      levelName: this.world.level.name,
    });
  }
}
