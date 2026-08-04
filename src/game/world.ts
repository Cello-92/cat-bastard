import type { Audio } from '@core/audio';
import type { Input } from '@core/input';
import { Camera } from '@engine/camera';
import { groundTiles } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { TileMap } from '@engine/tilemap';
import { overlaps } from '@engine/types';
import { FEEL, PHYSICS, RULES, TILE_SIZE, VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { Effects } from './effects';
import { Entity } from './entities/entity';
import { FallingSpike } from './entities/falling-spike';
import { Player } from './entities/player';
import { Shroom } from './entities/shroom';
import { Walker } from './entities/walker';
import type { LevelDef } from './levels';
import { drawBackground } from './render/background';
import { drawTile } from './render/tiles';
import { PALETTE } from './theme';
import { DEATH_CAUSE, tauntFor, type DeathCause } from './taunts';
import { TILE, isDeadly, isSpawner } from './tiles';

/**
 * Il mondo di gioco: mappa, entità, regole, camera.
 *
 * È l'unico posto che conosce sia la mappa sia le entità, e quindi l'unico che
 * può far succedere le cose. Le entità chiedono a lui (`world.kill(...)`),
 * non si coordinano tra loro.
 *
 * Non sa niente di DOM, HUD o schermate: comunica verso l'esterno solo
 * attraverso i callback. È quello che rende il gioco testabile e il codice
 * scalabile senza diventare una palla di fango.
 */

export type WorldState = 'playing' | 'dying' | 'won';

export interface RunStats {
  deaths: number;
  coins: number;
  ticks: number;
}

export interface WorldCallbacks {
  onTaunt(text: string): void;
  onWin(stats: RunStats): void;
}

interface TrapBrick {
  c: number;
  r: number;
  fired: boolean;
}

export class World {
  readonly player = new Player();
  readonly effects = new Effects();
  readonly camera = new Camera({ viewWidth: VIEW_WIDTH, viewHeight: VIEW_HEIGHT });

  map!: TileMap;
  state: WorldState = 'playing';

  deaths = 0;
  coins = 0;
  ticks = 0;

  private entities: Entity[] = [];
  private trapBricks: TrapBrick[] = [];
  /** Blocchi invisibili già scoperti, per chiave "c,r". */
  private revealed = new Set<string>();
  /** Piattaforme che stanno cedendo: chiave -> tick rimasti. */
  private crumbling = new Map<string, number>();
  private checkpoint: { c: number; r: number } | null = null;
  private deathTimer = 0;

  constructor(
    public level: LevelDef,
    readonly audio: Audio,
    private readonly callbacks: WorldCallbacks,
  ) {
    this.restart();
  }

  // ---------------------------------------------------------------- setup
  /** Ricomincia il livello da zero, statistiche comprese. */
  restart(): void {
    this.deaths = 0;
    this.coins = 0;
    this.ticks = 0;
    this.checkpoint = null;
    this.rebuild();
  }

  /** Ricostruisce la mappa e le entità, mantenendo le statistiche. */
  private rebuild(): void {
    this.map = new TileMap(this.level.rows, TILE_SIZE);
    this.entities = [];
    this.trapBricks = [];
    this.revealed.clear();
    this.crumbling.clear();
    this.effects.clear();
    this.state = 'playing';
    this.deathTimer = 0;

    // I marcatori nella mappa diventano entità e spariscono dalla griglia.
    for (const { c, r, tile } of this.map.entries()) {
      if (isSpawner(tile)) {
        this.map.clear(c, r);
        this.entities.push(new Walker(c * TILE_SIZE + 3, r * TILE_SIZE + 6, tile === TILE.EVIL_WALKER));
      } else if (tile === TILE.TRAP_BRICK) {
        this.trapBricks.push({ c, r, fired: false });
      }
    }

    const spawn = this.checkpoint ?? this.level.spawn;
    this.player.reset(spawn.c * TILE_SIZE + 5, spawn.r * TILE_SIZE);
    this.camera.snapTo(this.player.centerX, this.map.widthPx);
  }

  // ---------------------------------------------------------------- ciclo
  update(input: Input): void {
    // Hit-stop: congela la simulazione, non la camera (lo shake deve respirare).
    if (this.effects.consumeFreeze()) {
      this.camera.update();
      return;
    }

    if (this.state === 'won') {
      this.effects.update();
      this.camera.update();
      return;
    }

    this.ticks++;

    if (this.state === 'dying') {
      this.effects.update();
      this.camera.update();
      if (--this.deathTimer <= 0) this.rebuild();
      return;
    }

    this.player.update(this, input);

    if (this.player.y > this.map.heightPx + RULES.fallDeathMargin) {
      this.kill(DEATH_CAUSE.pit);
      return;
    }

    this.handleTileContacts();
    if (this.state !== 'playing') return;

    this.handleStandingTiles();
    this.handleCrumbling();
    this.handleTrapBricks();
    this.handleEntities();
    if (this.state !== 'playing') return;

    this.effects.update();
    this.camera.follow(this.player.centerX, this.map.widthPx);
    this.camera.update();
  }

  // ---------------------------------------------------------------- tile
  private handleTileContacts(): void {
    for (const { c, r, tile } of this.map.touching(this.player)) {
      if (tile === TILE.COIN) {
        this.collectCoin(c, r);
      } else if (tile === TILE.CHECKPOINT) {
        this.activateCheckpoint(c, r);
      } else if (tile === TILE.GOAL) {
        this.win();
        return;
      } else if (isDeadly(tile)) {
        this.kill(tile === TILE.SPIKES ? DEATH_CAUSE.spikes : DEATH_CAUSE.fakeFlag);
        return;
      }
    }
  }

  private collectCoin(c: number, r: number): void {
    this.map.clear(c, r);
    this.coins++;
    this.audio.play('coin');
    const x = c * TILE_SIZE + TILE_SIZE / 2;
    const y = r * TILE_SIZE + TILE_SIZE / 2;
    this.effects.burst(x, y, PALETTE.gold, { count: 10, speed: 3, size: 4, life: 26 });
    this.effects.floatingText(x, y - 6, '+1', PALETTE.gold, 13);
  }

  private activateCheckpoint(c: number, r: number): void {
    if (this.checkpoint?.c === c && this.checkpoint.r === r) return;
    this.checkpoint = { c, r };
    this.audio.play('coin');
    this.effects.ring(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, PALETTE.hot, 3.6, 14);
    this.effects.floatingText(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE - 4, 'CHECKPOINT', PALETTE.hot, 11);
  }

  /**
   * Tile su cui il giocatore sta poggiando, controllati ogni tick.
   *
   * Deliberatamente NON è un evento di atterraggio: ci si arriva anche
   * camminandoci sopra di lato, senza mai cadere. Le due azioni qui sotto sono
   * idempotenti, quindi ripeterle a ogni tick non fa danni.
   */
  private handleStandingTiles(): void {
    if (!this.player.onGround) return;

    for (const { c, r, tile } of groundTiles(this.player, this.map)) {
      if (tile === TILE.INVISIBLE) {
        this.reveal(c, r);
      } else if (tile === TILE.CRUMBLE) {
        const key = TileMap.key(c, r);
        if (!this.crumbling.has(key)) {
          this.crumbling.set(key, RULES.crumbleDelayTicks);
          this.audio.play('crumble');
        }
      }
    }
  }

  /** Chiamato dalla fisica del giocatore quando sbatte la testa. */
  onPlayerHeadbutt(c: number, r: number, tile: string): void {
    const x = c * TILE_SIZE + TILE_SIZE / 2;
    const y = r * TILE_SIZE + TILE_SIZE;

    switch (tile) {
      case TILE.INVISIBLE:
        this.reveal(c, r);
        break;

      case TILE.PRIZE:
        // Il blocco premio del livello: sputa un fungo che ti dà la caccia.
        this.map.set(c, r, TILE.USED);
        this.audio.play('block');
        this.camera.shake(2);
        this.entities.push(new Shroom(c * TILE_SIZE + 4, r * TILE_SIZE - 26));
        this.effects.burst(x, y, PALETTE.shroom, { count: 8, speed: 2.4, size: 4 });
        break;

      case TILE.HONEST:
        // Questo invece è onesto. Serve a rendere credibile l'altro.
        this.map.set(c, r, TILE.USED);
        this.coins++;
        this.audio.play('coin');
        this.effects.burst(x, y - TILE_SIZE, PALETTE.gold, { count: 12, speed: 3.4, size: 4 });
        this.effects.floatingText(x, y - TILE_SIZE - 8, '+1', PALETTE.gold, 13);
        break;

      default:
        this.audio.play('bump');
        this.effects.burst(x, y, PALETTE.paper, { count: 4, speed: 1.6, size: 3, life: 16 });
        break;
    }
  }

  private reveal(c: number, r: number): void {
    const key = TileMap.key(c, r);
    if (this.revealed.has(key)) return;
    this.revealed.add(key);
    this.audio.play('reveal');
    this.camera.shake(3);
    this.effects.burst(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE, PALETTE.paper, {
      count: 10,
      speed: 2.6,
      size: 4,
    });
  }

  private handleCrumbling(): void {
    for (const [key, remaining] of [...this.crumbling]) {
      if (remaining > 0) {
        this.crumbling.set(key, remaining - 1);
        continue;
      }
      const [cs, rs] = key.split(',');
      const c = Number(cs);
      const r = Number(rs);
      this.map.clear(c, r);
      this.crumbling.delete(key);
      this.effects.burst(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, PALETTE.wood, {
        count: 12,
        speed: 2.8,
        size: 5,
        gravity: 0.4,
      });
    }
  }

  private handleTrapBricks(): void {
    const playerColumn = Math.floor(this.player.centerX / TILE_SIZE);
    for (const brick of this.trapBricks) {
      if (brick.fired || brick.c !== playerColumn) continue;
      // Scatta solo se il giocatore è passato SOTTO il mattone.
      if (this.player.y < brick.r * TILE_SIZE) continue;

      brick.fired = true;
      this.map.clear(brick.c, brick.r);
      this.entities.push(new FallingSpike(brick.c * TILE_SIZE + 4, brick.r * TILE_SIZE + 6));
      this.audio.play('trap');
      this.camera.shake(FEEL.screenShakeOnTrap);
      this.effects.burst(
        brick.c * TILE_SIZE + TILE_SIZE / 2,
        brick.r * TILE_SIZE + TILE_SIZE,
        PALETTE.brick,
        { count: 10, speed: 2.6, size: 4 },
      );
    }
  }

  // ---------------------------------------------------------------- entità
  private handleEntities(): void {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      if (!entity) continue;

      entity.update(this);
      if (entity.expired) {
        this.entities.splice(i, 1);
        continue;
      }

      if (!overlaps(this.player, entity)) continue;

      const stomped =
        this.player.vy > 0 && this.player.y + this.player.h - entity.y < RULES.stompTolerance;

      if (stomped) {
        if (entity.onStomp(this)) this.player.vy = -PHYSICS.stompBounce;
      } else {
        entity.onTouch(this);
      }

      if (this.state !== 'playing') return;
      if (entity.expired) this.entities.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- esiti
  kill(cause: DeathCause = DEATH_CAUSE.generic): void {
    if (this.state !== 'playing') return;

    this.deaths++;
    this.state = 'dying';
    this.deathTimer = RULES.deathFreezeTicks;

    this.audio.play('death');
    this.camera.shake(FEEL.screenShakeOnDeath);
    this.effects.freeze(5);
    this.effects.flash(0.45, PALETTE.hot);
    this.effects.ring(this.player.centerX, this.player.centerY, PALETTE.hot, 5, 18);
    this.effects.burst(this.player.centerX, this.player.centerY, PALETTE.paper, {
      count: 20,
      speed: 5,
      size: 5,
      life: 40,
      gravity: 0.36,
    });

    this.callbacks.onTaunt(tauntFor(cause, this.deaths));
  }

  private win(): void {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.audio.play('win');
    this.effects.flash(0.5, PALETTE.paper);
    this.effects.ring(this.player.centerX, this.player.centerY, PALETTE.gold, 6, 24);
    this.callbacks.onWin({ deaths: this.deaths, coins: this.coins, ticks: this.ticks });
  }

  // ---------------------------------------------------------------- disegno
  draw(r: Renderer, tick: number): void {
    r.begin();
    drawBackground(r, this.camera.x, this.level.sky, tick);

    r.push();
    r.translate(-this.camera.offsetX, -this.camera.offsetY);

    this.drawTiles(r, tick);
    for (const entity of this.entities) entity.draw(r, tick);
    if (this.state !== 'dying') this.player.draw(r, tick);
    this.effects.drawWorld(r);

    r.pop();

    this.effects.drawOverlay(r);
    r.vignette(FEEL.vignetteStrength);
    r.end();
  }

  private drawTiles(r: Renderer, tick: number): void {
    const { from, to } = this.camera.visibleColumns(TILE_SIZE, this.map.cols);

    for (let row = 0; row < this.map.rows; row++) {
      for (let col = from; col <= to; col++) {
        const tile = this.map.get(col, row);
        if (tile === TILE.EMPTY) continue;

        const above = this.map.get(col, row - 1);
        drawTile(r, tile, col * TILE_SIZE, row * TILE_SIZE, {
          tick,
          col,
          row,
          revealed: this.revealed.has(TileMap.key(col, row)),
          crumbling: this.crumbling.has(TileMap.key(col, row)),
          checkpointActive: this.checkpoint?.c === col && this.checkpoint.r === row,
          hasFlagAbove: above === tile && (tile === TILE.FAKE_FLAG || tile === TILE.GOAL),
        });
      }
    }
  }
}
