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
import { Diver } from './entities/diver';
import { Drone } from './entities/drone';
import { FallingSpike } from './entities/falling-spike';
import { Player } from './entities/player';
import { Sentry } from './entities/sentry';
import { Shroom } from './entities/shroom';
import { Snowball } from './entities/snowball';
import { Walker } from './entities/walker';
import type { LevelDef } from './levels';
import { drawBackground } from './render/background';
import { drawTile, type OpenSides } from './render/tiles';
import { MATERIAL, PALETTE, SKIES, alpha } from './theme';
import { DEATH_CAUSE, tauntFor, type DeathCause } from './taunts';
import { TILE, isDeadly, isSpawner, joins } from './tiles';

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
  /** Il gomitolo nascosto è stato trovato in questo tentativo? */
  secret: boolean;
}

export interface WorldCallbacks {
  onTaunt(text: string): void;
  onWin(stats: RunStats): void;
  /** Gomitolo raccolto: va segnato subito, anche se poi il livello non finisce. */
  onSecret?(): void;
}

/** Da quale tile letale è arrivata la morte: serve a scegliere la battuta. */
const causeOfTile = (tile: string): DeathCause => {
  switch (tile) {
    case TILE.SPIKES:
      return DEATH_CAUSE.spikes;
    case TILE.CEILING_SPIKES:
      return DEATH_CAUSE.ceilingSpikes;
    case TILE.LURE_COIN:
      return DEATH_CAUSE.lureCoin;
    case TILE.FAKE_CHECKPOINT:
      return DEATH_CAUSE.fakeCheckpoint;
    case TILE.HIDDEN_SPIKES:
      return DEATH_CAUSE.hiddenSpikes;
    case TILE.FAKE_FLAG:
      return DEATH_CAUSE.fakeFlag;
    default:
      return DEATH_CAUSE.generic;
  }
};

/** Ritardo di cedimento delle superfici che spariscono, per tile. */
const VANISH_DELAY: Readonly<Record<string, number>> = {
  [TILE.CRUMBLE]: RULES.crumbleDelayTicks,
  // Un solo tick di vita: non trema, non si scurisce, non fa rumore finché è
  // troppo tardi. Quando te ne accorgi sei già in caduta.
  [TILE.GHOST]: RULES.ghostDelayTicks,
  [TILE.FAKE_GROUND]: RULES.fakeGroundDelayTicks,
  [TILE.BRITTLE_ICE]: RULES.brittleIceDelayTicks,
};

interface TrapBrick {
  c: number;
  r: number;
  fired: boolean;
  /** Zero preavviso: il masso parte nello stesso istante in cui lo attivi. */
  instant: boolean;
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
  /**
   * Trappole a tempo attive: chiave -> avanzamento in [0,1].
   * Ci stanno dentro gli spuntoni a scatto (quanto sono usciti) e le molle
   * (quanto sono compresse): entrambi hanno bisogno di un valore continuo
   * perché il disegno possa mostrarli a metà corsa, che è tutto il preavviso
   * che il giocatore riceve.
   */
  private extensions = new Map<string, number>();
  /**
   * Celle di spuntoni a scatto, raccolte una volta al caricamento.
   * `snap` distingue quelli con la piastra e la carica lenta da quelli che
   * schizzano fuori dal terreno liscio senza preavviso.
   */
  private popSpikes: { c: number; r: number; snap: boolean }[] = [];
  /**
   * Trappole invisibili già scoperte, per chiave "c,r".
   *
   * A differenza di tutto il resto NON viene azzerata alla morte: una trappola
   * invisibile uccide una volta sola, poi resta visibile per tutto il
   * tentativo. È il compromesso che tiene in piedi il patto — la prima volta
   * muori senza capire, dalla seconda è colpa tua.
   */
  private discovered = new Set<string>();
  private checkpoint: { c: number; r: number } | null = null;
  private deathTimer = 0;
  /**
   * Tick in cui il gatto ha toccato l'ultimo getto spento.
   *
   * Serve solo a scegliere la battuta: chi cade subito dopo essersi buttato
   * dentro un getto che non spingeva non è morto "nel vuoto", è morto per
   * quella trappola lì, e il gioco glielo deve dire (CLAUDE.md, punto 7).
   */
  private lastDeadVent = -1000;
  /** Il gomitolo di questo livello è già stato preso in questo tentativo. */
  secretFound = false;

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
    this.secretFound = false;
    // Ricominciare da capo significa anche tornare a non sapere dove sono le
    // trappole invisibili: è l'unica cosa che il respawn non porta con sé.
    this.discovered.clear();
    this.rebuild();
  }

  /** Ricostruisce la mappa e le entità, mantenendo le statistiche. */
  private rebuild(): void {
    this.map = new TileMap(this.level.rows, TILE_SIZE);
    this.entities = [];
    this.trapBricks = [];
    this.revealed.clear();
    this.crumbling.clear();
    this.extensions.clear();
    this.popSpikes = [];
    this.effects.clear();
    this.state = 'playing';
    this.deathTimer = 0;

    // I marcatori nella mappa diventano entità e spariscono dalla griglia.
    for (const { c, r, tile } of this.map.entries()) {
      if (isSpawner(tile)) {
        this.map.clear(c, r);
        this.entities.push(this.spawn(tile, c, r));
      } else if (tile === TILE.TRAP_BRICK) {
        this.trapBricks.push({ c, r, fired: false, instant: false });
      } else if (tile === TILE.COLLAPSE) {
        this.trapBricks.push({ c, r, fired: false, instant: true });
      } else if (tile === TILE.POP_SPIKES) {
        this.popSpikes.push({ c, r, snap: false });
      } else if (tile === TILE.SNAP_SPIKES) {
        this.popSpikes.push({ c, r, snap: true });
      }
    }

    const spawn = this.checkpoint ?? this.level.spawn;
    this.player.reset(spawn.c * TILE_SIZE + 5, spawn.r * TILE_SIZE);
    this.camera.snapTo(this.player.centerX, this.map.widthPx);
    this.lastDeadVent = -1000;
  }

  /**
   * Dal marcatore all'entità.
   *
   * Ogni nemico nasce già al posto giusto dentro la cella: qualche pixel di
   * margine, così non compenetra il pavimento al primo tick.
   */
  private spawn(tile: string, c: number, r: number): Entity {
    const x = c * TILE_SIZE + 3;
    const y = r * TILE_SIZE + 6;
    switch (tile) {
      case TILE.DIVER:
        return new Diver(x, y);
      case TILE.SENTRY:
        return new Sentry(c * TILE_SIZE + 2, r * TILE_SIZE + 4);
      case TILE.DRONE:
        return new Drone(c * TILE_SIZE + 3, r * TILE_SIZE + 8);
      case TILE.SNOWBALL:
        return new Snowball(c * TILE_SIZE + 1, r * TILE_SIZE + 2);
      default:
        return new Walker(x, y, tile === TILE.EVIL_WALKER);
    }
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
    this.handlePopSpikes();
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
      } else if (tile === TILE.YARN) {
        this.collectYarn(c, r);
      } else if (tile === TILE.FAKE_WALL) {
        // Una volta che ci sei passato attraverso resta segnata per tutto il
        // tentativo: il segreto è nasconderla la prima volta, non farti
        // ricercare a memoria una parete che hai già trovato.
        this.discovered.add(TileMap.key(c, r));
      } else if (tile === TILE.DEAD_VENT) {
        // Non fa niente. È esattamente questo il punto: se ne prende nota solo
        // per poter dare la colpa a lui quando il gatto arriva in fondo.
        this.lastDeadVent = this.ticks;
      } else if (tile === TILE.CHECKPOINT) {
        this.activateCheckpoint(c, r);
      } else if (tile === TILE.GOAL) {
        this.win();
        return;
      } else if (tile === TILE.SPRING) {
        this.launch(c, r);
      } else if (tile === TILE.POP_SPIKES || tile === TILE.SNAP_SPIKES) {
        // Uccidono solo quando sono davvero fuori: mezzi usciti sono l'avviso.
        // Per quelli istantanei l'avviso dura due tick, che è come dire niente.
        if ((this.extensions.get(TileMap.key(c, r)) ?? 0) > 0.55) {
          this.kill(tile === TILE.SNAP_SPIKES ? DEATH_CAUSE.snapSpikes : DEATH_CAUSE.popSpikes);
          return;
        }
      } else if (tile === TILE.HIDDEN_SPIKES) {
        // Da qui in poi si vedono. Non serve a chi è appena morto, serve a chi
        // riprova — ed è esattamente il punto.
        this.discovered.add(TileMap.key(c, r));
        this.kill(DEATH_CAUSE.hiddenSpikes);
        return;
      } else if (isDeadly(tile)) {
        this.kill(causeOfTile(tile));
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

  /**
   * Il gomitolo: l'unica cosa nascosta del gioco che non ti ammazza.
   *
   * Ne esiste uno per livello, sempre dietro qualcosa che sembrava un muro.
   * Vale per tutta la partita, non per il tentativo: raccoglierlo e poi morire
   * non lo fa perdere — sarebbe l'ennesima cattiveria, e questa parte del gioco
   * è deliberatamente gentile.
   */
  private collectYarn(c: number, r: number): void {
    this.map.clear(c, r);
    this.secretFound = true;
    this.audio.play('win');
    const x = c * TILE_SIZE + TILE_SIZE / 2;
    const y = r * TILE_SIZE + TILE_SIZE / 2;
    this.effects.ring(x, y, PALETTE.yarn, 4.2, 20);
    this.effects.burst(x, y, PALETTE.yarn, { count: 18, speed: 3.4, size: 4, life: 34 });
    this.effects.floatingText(x, y - 8, 'GOMITOLO', PALETTE.yarn, 13);
    this.callbacks.onSecret?.();
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
        continue;
      }

      const delay = VANISH_DELAY[tile];
      if (delay === undefined) continue;

      const key = TileMap.key(c, r);
      if (this.crumbling.has(key)) continue;

      this.crumbling.set(key, delay);
      this.audio.play('crumble');
      // Polvere o schegge sotto le zampe: per il terreno finto e il ghiaccio
      // sottile è l'unico avviso che arriva prima della caduta.
      if (tile === TILE.FAKE_GROUND || tile === TILE.BRITTLE_ICE) {
        this.effects.burst(
          c * TILE_SIZE + TILE_SIZE / 2,
          r * TILE_SIZE + 4,
          tile === TILE.BRITTLE_ICE ? PALETTE.ice : PALETTE.dust,
          { count: 6, speed: 1.6, size: 3, life: 20, shape: 'circle' },
        );
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
      // I detriti sono del materiale che ha appena ceduto: legno per l'asse,
      // ghiaccio per la lastra. Va letto prima di cancellare la cella.
      const debris = this.map.get(c, r) === TILE.BRITTLE_ICE ? PALETTE.ice : PALETTE.wood;
      this.map.clear(c, r);
      this.crumbling.delete(key);
      this.effects.burst(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, debris, {
        count: 12,
        speed: 2.8,
        size: 5,
        gravity: 0.4,
      });
    }
  }

  /**
   * Molla: lancia il gatto molto più in alto di un salto, e senza dosaggio.
   * Non è una trappola di per sé — lo diventa per via di quello che di solito
   * c'è sopra.
   */
  private launch(c: number, r: number): void {
    if (this.player.vy < 0) return;

    this.player.vy = -PHYSICS.springImpulse;
    this.player.onGround = false;
    this.extensions.set(TileMap.key(c, r), 1);
    this.audio.play('jump');
    this.camera.shake(3);
    this.effects.burst(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE - 8, PALETTE.dust, {
      count: 8,
      speed: 2.6,
      size: 3,
      life: 20,
      shape: 'circle',
      angle: -Math.PI / 2,
      spread: Math.PI * 0.8,
    });
  }

  /**
   * Spuntoni a scatto: escono quando il gatto è vicino e rientrano quando se
   * ne va. L'uscita non è istantanea — ci mette `popSpikeChargeTicks`, e quei
   * pochi tick sono l'unico preavviso. Sono anche l'unico modo di passare.
   */
  private handlePopSpikes(): void {
    for (const { c, r, snap } of this.popSpikes) {
      // Quelli con la piastra si vedono e ci mettono un attimo. Quelli
      // nascosti nel terreno liscio scattano quasi subito, e solo quando sei
      // già sopra: la portata è la metà.
      const step = snap ? 1 / RULES.snapSpikeChargeTicks : 1 / RULES.popSpikeChargeTicks;
      const range = snap ? RULES.snapSpikeRange : RULES.popSpikeRange;

      const key = TileMap.key(c, r);
      const current = this.extensions.get(key) ?? 0;
      const dx = Math.abs(this.player.centerX - (c * TILE_SIZE + TILE_SIZE / 2));
      const near = dx < range;

      const next = near ? Math.min(1, current + step) : Math.max(0, current - step * 0.6);
      if (next === current) continue;

      // Al primo scatto fanno rumore e polvere: almeno l'orecchio deve avere
      // una possibilità, visto che l'occhio non ce l'ha.
      if (current === 0 && next > 0) {
        this.audio.play('trap');
        this.effects.burst(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE - 4, PALETTE.dust, {
          count: 5,
          speed: 1.8,
          size: 2.5,
          life: 16,
          shape: 'circle',
        });
      }
      this.extensions.set(key, next);
    }

    // Le molle si riaprono da sole dopo essere state schiacciate.
    for (const [key, value] of this.extensions) {
      if (this.map.get(Number(key.split(',')[0]), Number(key.split(',')[1])) !== TILE.SPRING) continue;
      if (value > 0) this.extensions.set(key, Math.max(0, value - 0.12));
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
      this.entities.push(
        new FallingSpike(brick.c * TILE_SIZE + 4, brick.r * TILE_SIZE + 6, brick.instant ? 0 : undefined),
      );
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

    // Chi è appena stato dentro un getto che non spingeva non è caduto "nel
    // vuoto": è caduto per colpa di quello, e la battuta deve dirlo.
    if (cause === DEATH_CAUSE.pit && this.ticks - this.lastDeadVent < RULES.deadVentBlameTicks) {
      cause = DEATH_CAUSE.deadVent;
    }

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
    this.callbacks.onWin({
      deaths: this.deaths,
      coins: this.coins,
      ticks: this.ticks,
      secret: this.secretFound,
    });
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

    this.drawLighting(r);
    this.effects.drawOverlay(r);
    r.vignette(FEEL.vignetteStrength);
    r.end();
  }

  /**
   * Passata di luce, in coordinate schermo.
   *
   * Tile, nemici e sfondo sono disegnati da funzioni diverse che non si
   * parlano: se ognuna si illuminasse per conto suo, il risultato sarebbe un
   * collage. Questa passata li mette tutti sotto la stessa luce — la tinta
   * calda del sole dall'alto, il colore del cielo nelle ombre in basso, e un
   * velo di foschia che aumenta con la profondità — ed è ciò che fa sembrare
   * l'immagine una scena sola, ripresa in un momento preciso della giornata.
   */
  private drawLighting(r: Renderer): void {
    const sky = SKIES[this.level.sky];
    const { width: W, height: H } = r;

    // Luce diretta: scende dall'alto e si esaurisce a metà schermo.
    r.push();
    r.setBlend('add');
    r.setAlpha(sky.sunTintAmount * 0.65);
    r.gradientRect(0, 0, W, H * 0.7, [
      { at: 0, color: alpha(sky.sunTint, 0.85) },
      { at: 1, color: alpha(sky.sunTint, 0) },
    ]);
    r.pop();

    // Ombra ambientale: in basso arriva solo la luce riflessa dal cielo, che
    // è più fredda. Senza questo il terreno sembra illuminato da sotto.
    r.push();
    r.setBlend('multiply');
    r.setAlpha(0.34);
    r.gradientRect(0, H * 0.45, W, H * 0.55, [
      { at: 0, color: alpha(MATERIAL.fur.light, 1) },
      { at: 1, color: alpha(sky.ambient, 0.8) },
    ]);
    r.pop();
  }

  private drawTiles(r: Renderer, tick: number): void {
    const { from, to } = this.camera.visibleColumns(TILE_SIZE, this.map.cols);

    for (let row = 0; row < this.map.rows; row++) {
      for (let col = from; col <= to; col++) {
        const tile = this.map.get(col, row);
        if (tile === TILE.EMPTY) continue;

        const key = TileMap.key(col, row);
        const above = this.map.get(col, row - 1);
        drawTile(r, tile, col * TILE_SIZE, row * TILE_SIZE, {
          tick,
          col,
          row,
          revealed: this.revealed.has(key) || this.discovered.has(key),
          crumbling: this.crumbling.has(key),
          checkpointActive: this.checkpoint?.c === col && this.checkpoint.r === row,
          hasFlagAbove: above === tile && (tile === TILE.FAKE_FLAG || tile === TILE.GOAL),
          extension: this.extensions.get(key) ?? 0,
          open: this.openSidesOf(col, row, tile),
        });
      }
    }
  }

  /**
   * Quali facce della cella danno sul vuoto.
   *
   * È l'informazione da cui il disegno ricava l'erba, i bordi illuminati e
   * l'occlusione ambientale: senza, una parete di terra sarebbe una griglia di
   * quadrati tutti uguali invece di una massa continua di terreno.
   */
  private openSidesOf(c: number, r: number, tile: string): OpenSides {
    // Terra con terra, ghiaccio con ghiaccio, lamiera con lamiera: la regola
    // completa sta in tiles.ts, qui si applica e basta.
    return {
      up: !joins(tile, this.map.get(c, r - 1)),
      down: !joins(tile, this.map.get(c, r + 1)),
      left: !joins(tile, this.map.get(c - 1, r)),
      right: !joins(tile, this.map.get(c + 1, r)),
    };
  }
}
