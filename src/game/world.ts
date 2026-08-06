import type { Audio } from '@core/audio';
import type { Input } from '@core/input';
import { Camera } from '@engine/camera';
import { groundTiles } from '@engine/physics';
import type { Renderer } from '@engine/render/renderer';
import { TileMap } from '@engine/tilemap';
import { overlaps } from '@engine/types';
import { BOSS, FEEL, PHYSICS, RULES, TILE_SIZE, VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { Effects } from './effects';
import { Entity } from './entities/entity';
import { Boss } from './entities/boss';
import { Diver } from './entities/diver';
import { Drone } from './entities/drone';
import { FallingSpike } from './entities/falling-spike';
import { Player } from './entities/player';
import { Rubble } from './entities/rubble';
import { Sentry } from './entities/sentry';
import { Shroom } from './entities/shroom';
import { Snowball } from './entities/snowball';
import { Walker } from './entities/walker';
import { FEAT, featForDeath, type FeatId } from './feats';
import type { LevelDef } from './levels';
import { drawBackground } from './render/background';
import { drawTile, type OpenSides } from './render/tiles';
import { MATERIAL, PALETTE, SKIES, alpha } from './theme';
import { DEATH_CAUSE, tauntFor, type DeathCause } from './taunts';
import { TILE, beltDirection, isDeadly, isSpawner, joins } from './tiles';

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

/** Riporta una chiave "c,r" alle sue due coordinate. */
const cellOf = (key: string): [number, number] => {
  const [cs, rs] = key.split(',');
  return [Number(cs), Number(rs)];
};

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
  /**
   * Impresa compiuta (vedi `game/feats.ts`).
   *
   * Il mondo dice solo *cosa è successo*: non sa quante ne mancano, non sa se
   * questa sblocca un gatto e non deve saperlo — quella roba sta nei progressi,
   * e i progressi non entrano qui dentro (vedi la regola di sempre: `world.ts`
   * non conosce niente che stia fuori dal livello in corso).
   */
  onFeat?(feat: FeatId): void;
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
    case TILE.TRAP_SPRING:
      return DEATH_CAUSE.trapSpring;
    case TILE.HIDDEN_SPIKES:
      return DEATH_CAUSE.hiddenSpikes;
    case TILE.FAKE_FLAG:
      return DEATH_CAUSE.fakeFlag;
    default:
      return DEATH_CAUSE.generic;
  }
};

/**
 * Di chi è la colpa quando il pavimento sparisce e si finisce di sotto.
 *
 * L'asse marcia (`D`) non è nell'elenco: trema per un quarto di secondo prima
 * di cedere, quindi chi ci casca sa già benissimo cos'è successo.
 */
const VANISH_CAUSE: Readonly<Record<string, DeathCause>> = {
  [TILE.GHOST]: DEATH_CAUSE.ghost,
  [TILE.FAKE_GROUND]: DEATH_CAUSE.fakeGround,
  [TILE.BRITTLE_ICE]: DEATH_CAUSE.brittleIce,
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

  /**
   * Il tentativo in corso, nella stessa forma che arriva a `onWin`.
   *
   * Esiste perché la pausa deve poter dire come sta andando *adesso*, e perché
   * un solo posto che sa comporre queste quattro cose è meglio di due che
   * possono scostarsi.
   */
  get stats(): RunStats {
    return {
      deaths: this.deaths,
      coins: this.coins,
      ticks: this.ticks,
      secret: this.secretFound,
    };
  }

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
  /**
   * L'ultimo pavimento svanito sotto le zampe, e di che tipo era.
   *
   * Stessa idea del getto spento qui sopra: chi cade perché la piattaforma
   * fantasma non c'è più non è morto "nel vuoto". Senza questo, le battute di
   * `ghost`, `fakeGround` e `brittleIce` erano scritte in `taunts.ts` e non le
   * vedeva nessuno — cioè tre trappole senza spiegazione (CLAUDE.md, punto 7).
   */
  private lastVanish: { tick: number; cause: DeathCause } | null = null;
  /** Il gomitolo di questo livello è già stato preso in questo tentativo. */
  secretFound = false;

  /**
   * Tick consecutivi senza toccare un comando (vedi `FEAT.still`).
   *
   * È l'unica cosa del gioco che si guadagna non giocando, e per questo si
   * azzera al primo tasto e a ogni morte: mezzo minuto vero, in un tentativo
   * solo, non mezzo minuto messo insieme a pezzi mentre si era altrove.
   */
  private stillTicks = 0;
  /**
   * Imprese già annunciate in questo livello.
   *
   * I progressi sono altrove e sono loro a decidere se una cosa è nuova: qui
   * serve solo a non richiamare il callback sessanta volte al secondo mentre
   * il gatto continua a non muoversi.
   */
  private claimed = new Set<FeatId>();

  // -------------------------------------------------------------- il boss
  /**
   * Il Padrone, se questo livello ne ha uno.
   *
   * È l'unica entità che il mondo tiene anche per nome invece che solo nella
   * lista: il combattimento ha bisogno di sapere dov'è, se è vulnerabile e se
   * è morto, e sono tutte cose che nessun'altra entità può chiedergli senza
   * passare da qui (vedi CLAUDE.md: le entità non si coordinano tra loro).
   *
   * È pubblico perché lo scontro è l'unica parte del gioco che ha uno stato
   * osservabile dall'esterno — i test ci verificano il contratto del
   * combattimento, che è troppo importante per essere solo "non esplode".
   */
  boss: Boss | null = null;
  /** Celle in cui la muratura del soffitto ricompare: le posizioni originali. */
  private bossBricks: { c: number; r: number }[] = [];
  /** Mattoni che stanno per staccarsi: chiave -> tick rimasti. */
  private brickFalling = new Map<string, number>();
  /** Mattoni caduti che si stanno ricomponendo: chiave -> tick rimasti. */
  private brickRespawn = new Map<string, number>();
  private gateCells: { c: number; r: number }[] = [];
  private gateOpen = false;
  /**
   * Tick di "colpa del nastro" rimasti.
   *
   * Un nastro non uccide mai da solo: uccide il vuoto in cui ti ha
   * accompagnato. Senza questo contatore la morte sarebbe attribuita alla
   * fossa e la battuta sarebbe quella sbagliata — e la regola è che ogni
   * trappola si spieghi da sé (vedi CLAUDE.md).
   */
  private beltGrace = 0;

  /**
   * Monete già contate e gomitoli già presi, per cella.
   *
   * Esistono perché la mappa non sopravvive alla morte: `rebuild()` la
   * ricostruisce dalle righe del livello, quindi ogni moneta e ogni gomitolo
   * tornavano al loro posto a ogni respawn. Bastava morire accanto a una
   * moneta per raccoglierla altre mille volte — e le monete di un livello
   * finiscono in `bestCoins`, che va in classifica.
   *
   * Le due cose si comportano in modo diverso di proposito:
   *
   *  - il **gomitolo** sparisce e non torna. È un segreto: una volta trovato
   *    non c'è più niente da trovare, e vederlo ancora lì sarebbe una bugia;
   *  - la **moneta** torna al suo posto e si può riprendere, ma non conta.
   *    Toglierla lascerebbe buchi in un livello che il giocatore sta
   *    imparando a memoria, e la memoria di un livello è il gameplay.
   *
   * Sopravvivono alla morte, non a `restart()`: ricominciare da capo azzera
   * anche il contatore, quindi è un tentativo nuovo e non un raccolto in più.
   */
  private countedCoins = new Set<string>();
  private takenYarn = new Set<string>();

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
    // Le monete tornano a contare e il gomitolo torna al suo posto: il
    // contatore è appena stato azzerato, quindi non si regala niente.
    this.countedCoins.clear();
    this.takenYarn.clear();
    this.stillTicks = 0;
    this.claimed.clear();
    this.rebuild();
  }

  /**
   * Un'impresa è appena riuscita: si dice una volta sola.
   *
   * Il mondo non tiene il conto di niente che duri più di un livello — chi
   * ascolta scrive nei progressi e decide se c'è un gatto da annunciare.
   */
  private claim(feat: FeatId): void {
    if (this.claimed.has(feat)) return;
    this.claimed.add(feat);
    this.callbacks.onFeat?.(feat);
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
    this.beltGrace = 0;
    this.boss = null;
    this.bossBricks = [];
    this.brickFalling.clear();
    this.brickRespawn.clear();
    this.gateCells = [];
    this.gateOpen = false;

    // Il gomitolo già preso non torna: la mappa è appena stata ricostruita
    // dalle righe del livello, e lì lui c'è ancora.
    for (const key of this.takenYarn) {
      const [c, r] = cellOf(key);
      this.map.clear(c, r);
    }

    // I marcatori nella mappa diventano entità e spariscono dalla griglia.
    for (const { c, r, tile } of this.map.entries()) {
      if (isSpawner(tile)) {
        this.map.clear(c, r);
        this.entities.push(this.spawn(tile, c, r));
      } else if (tile === TILE.TRAP_BRICK) {
        this.trapBricks.push({ c, r, fired: false, instant: false });
      } else if (tile === TILE.COLLAPSE) {
        this.trapBricks.push({ c, r, fired: false, instant: true });
      } else if (tile === TILE.BOSS_BRICK) {
        this.bossBricks.push({ c, r });
      } else if (tile === TILE.BOSS_GATE) {
        this.gateCells.push({ c, r });
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
    this.lastVanish = null;
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
      case TILE.BOSS: {
        // Il marcatore sta nella cella *sopra* il pavimento: il Padrone ci
        // poggia i piedi, non ci sta dentro.
        this.boss = new Boss(
          c * TILE_SIZE + (TILE_SIZE - BOSS.width) / 2,
          (r + 1) * TILE_SIZE - BOSS.height,
        );
        return this.boss;
      }
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
    this.handleStillness(input);

    if (this.beltGrace > 0) this.beltGrace--;

    if (this.player.y > this.map.heightPx + RULES.fallDeathMargin) {
      // Caduti da un nastro, la colpa è del nastro: è lui che ti ha portato lì.
      this.kill(this.beltGrace > 0 ? DEATH_CAUSE.belt : DEATH_CAUSE.pit);
      return;
    }

    this.handleTileContacts();
    if (this.state !== 'playing') return;

    this.handleStandingTiles();
    this.handleCrumbling();
    this.handleBossBricks();
    this.handlePopSpikes();
    this.handleTrapBricks();
    this.handleEntities();
    if (this.state !== 'playing') return;

    this.handleBossFight();
    if (this.state !== 'playing') return;

    this.effects.update();
    this.camera.follow(this.player.centerX, this.map.widthPx);
    this.camera.update();
  }

  /**
   * L'impresa di non fare assolutamente niente.
   *
   * Un platform dà per scontato che ti muova: le trappole aspettano te, i
   * nemici camminano verso di te, il tempo sale. Restare fermi mezzo minuto è
   * l'unica cosa che nessuna mappa può prevedere, ed è per questo che vale un
   * gatto. Si azzera al primo comando — anche `R`, anche il pad touch: la
   * fisica non distingue chi ha premuto, e nemmeno questo.
   */
  private handleStillness(input: Input): void {
    if (
      input.isDown('left') ||
      input.isDown('right') ||
      input.isDown('jump') ||
      input.isDown('restart')
    ) {
      this.stillTicks = 0;
      return;
    }

    this.stillTicks++;
    if (this.stillTicks < RULES.stillTicks) return;

    this.effects.ring(this.player.centerX, this.player.centerY, PALETTE.paper, 4, 22);
    this.effects.floatingText(this.player.centerX, this.player.y - 8, 'FERMO', PALETTE.paper, 13);
    this.claim(FEAT.still);
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
    this.countCoin(TileMap.key(c, r), c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2);
  }

  /**
   * Segna una moneta, se non era già stata segnata.
   *
   * Una moneta si raccoglie quante volte si vuole — muore il gatto, torna la
   * moneta — ma la seconda volta non vale: `bestCoins` è il massimo raccolto
   * in un tentativo, non quante volte si è passati di lì.
   *
   * Il riscontro però c'è lo stesso, ed è diverso: senza, un giocatore che
   * vede il contatore fermo penserebbe a un bug invece che a una regola (vedi
   * CLAUDE.md, punto 7: quello che succede dev'essere leggibile).
   */
  private countCoin(key: string, x: number, y: number): void {
    this.audio.play('coin');

    if (this.countedCoins.has(key)) {
      this.effects.burst(x, y, PALETTE.dust, { count: 5, speed: 1.8, size: 3, life: 18 });
      this.effects.floatingText(x, y - 6, 'GIÀ PRESA', PALETTE.stone, 11);
      return;
    }

    this.countedCoins.add(key);
    this.coins++;
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
    // Da qui in poi non torna più, nemmeno morendo: è la differenza tra un
    // segreto e una moneta.
    this.takenYarn.add(TileMap.key(c, r));
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
      if (beltDirection(tile) !== 0) {
        this.beltGrace = RULES.beltBlameTicks;
      } else if (tile === TILE.INVISIBLE) {
        this.reveal(c, r);
        continue;
      } else if (tile === TILE.BOSS_BRICK) {
        // Salirci sopra è l'unico modo di caricare l'arma: da qui parte il
        // conto alla rovescia, e il mattone lo dice tremando.
        const brickKey = TileMap.key(c, r);
        if (!this.brickFalling.has(brickKey)) {
          this.brickFalling.set(brickKey, RULES.bossBrickDelayTicks);
          this.audio.play('crumble');
          this.camera.shake(2);
        }
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
        //
        // La sua moneta passa dallo stesso contatore di quelle sparse: il
        // blocco torna intatto a ogni respawn, quindi senza sarebbe la
        // sorgente di monete infinite più comoda del gioco.
        this.map.set(c, r, TILE.USED);
        this.countCoin(TileMap.key(c, r), x, y - TILE_SIZE);
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
      const tile = this.map.get(c, r);
      const debris = tile === TILE.BRITTLE_ICE ? PALETTE.ice : PALETTE.wood;
      // Da adesso, per qualche tick, una caduta è colpa sua e non del vuoto.
      const cause = VANISH_CAUSE[tile];
      if (cause) this.lastVanish = { tick: this.ticks, cause };
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
        brick.instant
          ? // Il masso che crolla: nessun tremolio, e una battuta sua — è una
            // trappola diversa dalla stalattite, non la stessa senza preavviso.
            new FallingSpike(brick.c * TILE_SIZE + 4, brick.r * TILE_SIZE + 6, 0, DEATH_CAUSE.collapse)
          : new FallingSpike(brick.c * TILE_SIZE + 4, brick.r * TILE_SIZE + 6),
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

  // ---------------------------------------------------------------- boss
  /**
   * La muratura dell'arena: quella che sta cedendo e quella che si ricompone.
   *
   * Il ciclo è chiuso apposta — un mattone che cade torna sempre, dopo un po'.
   * Senza, un giocatore che sbaglia tutti i tiri resterebbe chiuso in una
   * stanza con un boss e niente con cui colpirlo, e non sarebbe una partita
   * persa: sarebbe una partita finita.
   */
  private handleBossBricks(): void {
    for (const [key, remaining] of [...this.brickFalling]) {
      if (remaining > 0) {
        this.brickFalling.set(key, remaining - 1);
        continue;
      }
      this.brickFalling.delete(key);
      const [c, r] = cellOf(key);
      this.dropBrick(c, r);
    }

    for (const [key, remaining] of [...this.brickRespawn]) {
      if (remaining > 0) {
        this.brickRespawn.set(key, remaining - 1);
        continue;
      }
      const [c, r] = cellOf(key);
      // Mai murare il gatto dentro un solido: se è lì sotto, si aspetta.
      if (this.playerOverlapsCell(c, r)) {
        this.brickRespawn.set(key, 6);
        continue;
      }
      this.brickRespawn.delete(key);
      this.map.set(c, r, TILE.BOSS_BRICK);
      this.audio.play('block');
      this.effects.burst(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE, PALETTE.dust, {
        count: 6,
        speed: 1.8,
        size: 3,
        life: 18,
        shape: 'circle',
      });
    }
  }

  /**
   * Stacca il mattone: da qui in poi è un masso, e non è più di nessuno.
   * `slam` dice solo chi l'ha staccato — il masso si comporta uguale.
   */
  private dropBrick(c: number, r: number, slam = false): void {
    if (this.map.get(c, r) !== TILE.BOSS_BRICK) return;

    this.map.clear(c, r);
    this.brickRespawn.set(TileMap.key(c, r), RULES.bossBrickRespawnTicks);
    this.entities.push(new Rubble(c * TILE_SIZE + 2, r * TILE_SIZE + 4, slam));
    this.audio.play('trap');
    this.camera.shake(FEEL.screenShakeOnTrap);
    this.effects.burst(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE, PALETTE.dust, {
      count: 8,
      speed: 2.2,
      size: 3.5,
      life: 22,
      shape: 'circle',
    });
  }

  /**
   * Il combattimento vero e proprio: chi colpisce chi.
   *
   * Sta qui e non dentro le entità perché è esattamente il tipo di cosa che
   * richiede di sapere due cose insieme — dove sta il masso e dove sta il
   * Padrone — e nel progetto quel posto è uno solo.
   */
  private handleBossFight(): void {
    const boss = this.boss;
    if (!boss) return;

    for (const entity of this.entities) {
      if (!(entity instanceof Rubble) || entity.expired) continue;

      const overlapping =
        entity.x < boss.x + boss.w &&
        entity.x + entity.w > boss.x &&
        entity.y < boss.y + boss.h &&
        entity.y + entity.h > boss.y;

      if (overlapping) {
        if (boss.takeHit(this)) {
          entity.shatter(this);
          // Ucciso da un masso che ha staccato lui: è l'unico modo di vincere
          // senza aver mai alzato un dito, ed è l'impresa che se lo merita.
          if (boss.isDead && entity.slam) {
            this.effects.floatingText(boss.centerX, boss.y - 24, 'TUO', PALETTE.gold, 14);
            this.claim(FEAT.ownRock);
          }
        }
        continue;
      }

      // Non l'ha ancora preso ma gli sta arrivando in testa: se in quel momento
      // può permetterselo, si sposta. È il suo modo di barare, ed è anche il
      // motivo per cui va colpito mentre è occupato a fare altro.
      const above = entity.y + entity.h < boss.y;
      const dx = entity.x + entity.w / 2 - boss.centerX;
      if (above && Math.abs(dx) < BOSS.dodgeRange && boss.canDodge) {
        // Se il masso è decentrato scarta dalla parte opposta; se invece gli
        // sta esattamente sulla testa fa un passo indietro, che è quello che
        // farebbe chiunque e soprattutto è quello che si vede meglio.
        boss.dodge(Math.abs(dx) < 6 ? 0 : -Math.sign(dx));
        this.audio.play('bump');
        this.effects.floatingText(boss.centerX, boss.y - 8, 'ops', PALETTE.paper, 12);
      }
    }

    if (boss.isDead && !this.gateOpen) this.openGate();
  }

  /**
   * Fase 2: il Padrone batte a terra e fa cadere il mattone sopra al gatto.
   *
   * È l'unica trappola del gioco che si può rigirare: il masso arriva dove sta
   * il *giocatore*, e per un secondo abbondante dopo la botta il Padrone resta
   * lì fermo. Chi ha capito il trucco si mette accanto a lui e lo lascia fare.
   */
  bossSlam(boss: Boss): void {
    let best: { c: number; r: number } | null = null;
    let bestDistance = Infinity;
    const target = this.player.centerX;

    for (const { c, r } of this.bossBricks) {
      if (this.map.get(c, r) !== TILE.BOSS_BRICK) continue;
      if (this.brickFalling.has(TileMap.key(c, r))) continue;
      const distance = Math.abs(c * TILE_SIZE + TILE_SIZE / 2 - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { c, r };
      }
    }

    if (!best) return;
    this.effects.floatingText(boss.centerX, boss.y - 10, 'GIÙ', PALETTE.hot, 14);
    this.dropBrick(best.c, best.r, true);
  }

  /** Cambio di fase: si rifà il soffitto, perché può. */
  onBossRage(): void {
    this.brickFalling.clear();
    for (const { c, r } of this.bossBricks) {
      this.brickRespawn.delete(TileMap.key(c, r));
      if (this.map.get(c, r) === TILE.BOSS_BRICK) continue;
      if (this.playerOverlapsCell(c, r)) continue;
      this.map.set(c, r, TILE.BOSS_BRICK);
      this.effects.burst(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE, PALETTE.stone, {
        count: 8,
        speed: 2.4,
        size: 4,
        life: 24,
      });
    }
    this.callbacks.onTaunt('si è rifatto il soffitto. certo che sì');
  }

  /** Il Padrone è caduto: il portone non ha più motivo di stare chiuso. */
  private openGate(): void {
    this.gateOpen = true;
    for (const { c, r } of this.gateCells) {
      this.map.clear(c, r);
      this.effects.burst(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, PALETTE.stone, {
        count: 6,
        speed: 3,
        size: 4,
        life: 30,
        gravity: 0.4,
      });
    }
    if (this.gateCells.length === 0) return;

    this.audio.play('coin');
    this.camera.shake(6);
    const first = this.gateCells[0];
    if (first) {
      this.effects.floatingText(
        first.c * TILE_SIZE + TILE_SIZE / 2,
        first.r * TILE_SIZE - 6,
        'APERTO',
        PALETTE.gold,
        14,
      );
    }
  }

  private playerOverlapsCell(c: number, r: number): boolean {
    const x = c * TILE_SIZE;
    const y = r * TILE_SIZE;
    return (
      this.player.x < x + TILE_SIZE &&
      this.player.x + this.player.w > x &&
      this.player.y < y + TILE_SIZE &&
      this.player.y + this.player.h > y
    );
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
    // vuoto": è caduto per colpa di quello, e la battuta deve dirlo. Vale anche
    // per il pavimento che è appena svanito, e per la stessa ragione.
    if (cause === DEATH_CAUSE.pit) {
      if (this.ticks - this.lastDeadVent < RULES.deadVentBlameTicks) {
        cause = DEATH_CAUSE.deadVent;
      } else if (
        this.lastVanish &&
        this.ticks - this.lastVanish.tick < RULES.vanishBlameTicks
      ) {
        cause = this.lastVanish.cause;
      }
    }

    // L'album delle imboscate: certe morti valgono una figurina (feats.ts).
    const feat = featForDeath(cause);
    if (feat) this.claim(feat);

    this.stillTicks = 0;
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
    // Il livello era pieno di monete e di modi di morire, e non hai preso né
    // le une né gli altri. È l'unica impresa che si compie non toccando niente.
    if (this.deaths === 0 && this.coins === 0) this.claim(FEAT.ascetic);
    this.audio.play('win');
    this.effects.flash(0.5, PALETTE.paper);
    this.effects.ring(this.player.centerX, this.player.centerY, PALETTE.gold, 6, 24);
    this.callbacks.onWin(this.stats);
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
          crumbling: this.crumbling.has(key) || this.brickFalling.has(key),
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
