import { Audio } from '@core/audio';
import { GameLoop } from '@core/loop';
import { Input, type Action } from '@core/input';
import { Canvas2DRenderer } from '@engine/render/canvas2d';
import type { Renderer } from '@engine/render/renderer';
import {
  loadProgress,
  loadSettings,
  recordClear,
  recordSecret,
  resetProgress,
  saveProgress,
  saveSettings,
  type Progress,
  type Settings,
} from '@core/storage';
import { Account } from '@net/account';
import { Hud } from '@ui/hud';
import { AccountDialog } from '@ui/account-dialog';
import { bindFullscreenKey, isFullscreen, toggleFullscreen } from '@ui/fullscreen';
import { Menu, type MenuItem, type MenuPage, type MenuRow } from '@ui/menu';
import { Preview } from '@ui/preview';
import { Screens } from '@ui/screens';
import { formatMs, formatTicksPrecise, plural } from '@ui/format';
import { CATS, catById, catRequirement, isCatUnlocked, type UnlockState } from './cats';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { LEVELS, SECRET_COUNT, WORLDS, firstLevel, type WorldDef } from './levels';
import { drawCatPortrait } from './render/cat-portrait';
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
  private readonly preview: Preview;
  private readonly loop: GameLoop;
  private readonly account = new Account();
  private readonly accountDialog: AccountDialog;

  private world: World;
  private levelIndex = 0;
  private phase: Phase = 'menu';
  private progress: Progress;
  private settings: Settings;
  /**
   * Quale classifica si sta aspettando.
   *
   * La rete risponde quando le pare, e nel frattempo il giocatore ha già
   * cambiato pagina tre volte: senza questo contatore una risposta in ritardo
   * riscriverebbe il menu che sta guardando adesso.
   */
  private leaderboardRequest = 0;

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
      // Un Invio che non fa niente sembra un tasto rotto: il tonfo dice "no".
      onDenied: () => this.audio.play('block'),
      onPauseRequest: () => this.pause(),
      // Col popup dell'account aperto il menu resta visibile dietro: senza
      // questo, l'Invio che conferma la password confermerebbe anche la voce
      // selezionata sotto.
      isBlocked: () => this.accountDialog.isOpen,
    });

    this.preview = new Preview(
      panel.querySelector<HTMLElement>('[data-preview]'),
      panel.querySelector<HTMLCanvasElement>('[data-preview-canvas]'),
      panel.querySelector<HTMLElement>('[data-preview-caption]'),
    );

    this.accountDialog = new AccountDialog(root, {
      onRegister: (nickname, password) => this.authenticate('register', nickname, password),
      onLogin: (nickname, password) => this.authenticate('login', nickname, password),
      onDismiss: () => this.markAccountPromptSeen(),
      onDone: () => {
        this.markAccountPromptSeen();
        if (this.phase === 'menu') this.showRootMenu();
      },
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
    // Il backend parte per conto suo e non ferma niente: se non risponde, o se
    // non è nemmeno configurato, il gioco è quello di sempre.
    void this.boot();
  }

  // ---------------------------------------------------------------- account
  /**
   * Il primo contatto col backend.
   *
   * Chi ha già una sessione la usa e non se ne accorge: si sincronizza e via.
   * Chi non ce l'ha si vede il popup — una volta sola nella vita di questo
   * browser, e con "non ora" fra le risposte.
   */
  private async boot(): Promise<void> {
    if (!this.account.enabled) return;

    if (this.account.isLogged) {
      const merged = await this.account.sync(this.progress);
      if (merged) this.adopt(merged);
      if (this.phase === 'menu') this.showRootMenu();
      return;
    }

    if (this.settings.accountPromptSeen) return;
    this.accountDialog.open('welcome');
  }

  private async authenticate(
    kind: 'register' | 'login',
    nickname: string,
    password: string,
  ): Promise<string | null> {
    const result =
      kind === 'register'
        ? await this.account.register(nickname, password, this.progress)
        : await this.account.login(nickname, password, this.progress);

    if (!result.ok) return result.message;
    this.adopt(result.progress);
    return null;
  }

  /** Adotta i progressi fusi col server e li scrive anche in locale. */
  private adopt(progress: Progress): void {
    this.progress = progress;
    saveProgress(progress);
  }

  /**
   * Manda i progressi al server senza far aspettare nessuno.
   *
   * Fallisce in silenzio di proposito: una richiesta persa si ritenta alla
   * prossima occasione, e non c'è nessun motivo per cui un problema di rete
   * debba comparire sopra alla schermata di fine livello.
   */
  private queueSync(): void {
    if (!this.account.isLogged) return;
    void this.account.sync(this.progress).then((merged) => {
      if (merged) this.adopt(merged);
    });
  }

  private markAccountPromptSeen(): void {
    if (this.settings.accountPromptSeen) return;
    this.settings = { ...this.settings, accountPromptSeen: true };
    saveSettings(this.settings);
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

  /**
   * Tutte le pagine passano di qui.
   *
   * Serve a una cosa sola: spegnere l'anteprima quando la pagina non ne ha una.
   * Farlo in ogni `show` sarebbe la stessa riga scritta dodici volte, e prima o
   * poi una dimenticata — con un gatto che resta a respirare accanto alle
   * opzioni audio.
   */
  private page(page: MenuPage): void {
    if (page.layout !== 'gallery') this.preview.hide();
    this.menu.show(page);
  }

  /** Quanti livelli di un mondo sono finiti, e quanti gomitoli ne sono usciti. */
  private worldProgress(world: WorldDef): { cleared: number; yarn: number; secrets: number } {
    let cleared = 0;
    let yarn = 0;
    let secrets = 0;
    for (const level of world.levels) {
      if (this.progress.levels[level.id]?.cleared) cleared++;
      if (level.rows.some((row) => row.includes('*'))) {
        secrets++;
        if (this.progress.secrets.includes(level.id)) yarn++;
      }
    }
    return { cleared, yarn, secrets };
  }

  private showRootMenu(): void {
    const resume = this.resumeIndex;
    const started = resume > 0 || this.progress.totalDeaths > 0;
    const cleared = LEVELS.filter((level) => this.progress.levels[level.id]?.cleared).length;
    const yarn = this.progress.secrets.length;

    const online: MenuItem[] = this.account.enabled
      ? [
          {
            label: 'CLASSIFICA',
            hint: 'I tempi migliori di tutti, livello per livello',
            onSelect: () => this.showLeaderboardMenu(),
          },
          {
            label: 'ACCOUNT',
            value: this.account.nickname ?? 'OSPITE',
            hint: this.account.isLogged
              ? 'I tuoi record sono al sicuro e vanno in classifica'
              : 'Senza account i progressi restano solo in questo browser',
            onSelect: () => this.showAccountMenu(),
          },
        ]
      : [];

    this.page({
      title: started
        ? `${cleared} livelli su ${LEVELS.length} · ${plural(this.progress.totalDeaths, 'morte', 'morti')} in totale · ${plural(yarn, 'gomitolo', 'gomitoli')}`
        : 'Un platform che ti odia. Ogni blocco è sospetto, ogni fungo è una trappola, la bandiera potrebbe non essere la bandiera.',
      items: [
        {
          label: cleared > 0 ? 'CONTINUA' : 'GIOCA',
          sub: LEVELS[resume]?.title ?? '',
          value: LEVELS[resume]?.name ?? '',
          hint: cleared > 0 ? 'Riprende dal primo livello che non hai ancora finito' : 'Si comincia da 1-1, come tutti',
          onSelect: () => this.startLevel(resume),
        },
        {
          label: 'MONDI E LIVELLI',
          value: `${cleared}/${LEVELS.length}`,
          hint: 'Scegli il mondo, poi il livello. Con i record e i gomitoli',
          onSelect: () => this.showWorldsMenu(),
        },
        {
          label: 'GATTI',
          sub: `${plural(yarn, 'gomitolo', 'gomitoli')} su ${SECRET_COUNT}`,
          value: catById(this.settings.cat).name,
          hint: 'I gomitoli nascosti nei livelli servono a questo, e solo a questo',
          onSelect: () => this.showCatsMenu(() => this.showRootMenu()),
        },
        ...online,
        {
          label: 'OPZIONI',
          hint: 'Audio, schermo, comandi — e il tasto per buttare via tutto',
          onSelect: () => this.showOptionsMenu(),
        },
      ],
    });
  }

  /**
   * I mondi.
   *
   * Con sedici livelli una lista sola non è più una lista: è uno scorrimento.
   * I mondi esistono già nel gioco (cambiano cielo, tileset e regole del
   * pavimento), quindi il menu smette di fingere che sia tutto di seguito.
   */
  private showWorldsMenu(): void {
    const items: MenuItem[] = WORLDS.map((world) => {
      const { cleared, yarn, secrets } = this.worldProgress(world);
      const unlocked = this.isUnlocked(world.firstIndex);
      const done = cleared === world.levels.length;

      return {
        label: `MONDO ${world.number}`,
        sub: world.subtitle,
        value: unlocked ? `${cleared}/${world.levels.length}${done ? ' ✓' : ''}` : 'BLOCCATO',
        hint: unlocked
          ? secrets > 0
            ? `${plural(cleared, 'livello finito', 'livelli finiti')} · ${yarn} gomitoli su ${secrets}`
            : `${plural(cleared, 'livello finito', 'livelli finiti')} su ${world.levels.length}`
          : `Finisci il mondo ${world.number - 1} per arrivare qui`,
        locked: !unlocked,
        onSelect: () => this.showLevelsMenu(world),
      };
    });

    items.push({ label: 'INDIETRO', onSelect: () => this.showRootMenu() });

    this.page({
      title: 'MONDI',
      items,
      onBack: () => this.showRootMenu(),
    });
  }

  private showOptionsMenu(): void {
    this.page({
      title: 'OPZIONI',
      items: [
        {
          label: 'AUDIO',
          value: this.settings.audio ? 'ON' : 'OFF',
          hint: 'Suoni sintetizzati, nessun file: si spengono e si riaccendono qui',
          onSelect: () => this.toggleAudio(() => this.showOptionsMenu()),
        },
        {
          label: 'SCHERMO INTERO',
          value: isFullscreen() ? 'ON' : 'OFF',
          hint: 'Anche col tasto F, in qualunque momento',
          onSelect: () => {
            toggleFullscreen();
            this.showOptionsMenu();
          },
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
        { label: 'INDIETRO', onSelect: () => this.showRootMenu() },
      ],
      onBack: () => this.showRootMenu(),
    });
  }

  private showLevelsMenu(world: WorldDef): void {
    const items: MenuItem[] = world.levels.map((level) => {
      const index = LEVELS.indexOf(level);
      const record = this.progress.levels[level.id];
      const unlocked = this.isUnlocked(index);
      // Il gomitolo si segnala solo nei livelli che ne hanno uno: un livello
      // senza segreti non deve sembrare un livello con un segreto mancato.
      const hasSecret = level.rows.some((row) => row.includes('*'));
      const gotSecret = this.progress.secrets.includes(level.id);
      // Stella piena = preso, stella vuota = c'è e non ce l'hai. Che il
      // livello *abbia* un gomitolo si può dire: dove sta, no.
      const yarnMark = hasSecret ? (gotSecret ? ' ✦' : ' ✧') : '';

      return {
        label: level.name,
        sub: unlocked ? level.title : '???',
        value: record?.cleared
          ? `${formatTicksPrecise(record.bestTicks)}${yarnMark}`
          : unlocked
            ? `MAI FINITO${yarnMark}`
            : 'BLOCCATO',
        hint: unlocked
          ? record?.cleared
            ? `Record: ${formatTicksPrecise(record.bestTicks)} · ${plural(record.bestDeaths, 'morte', 'morti')} · ${plural(record.bestCoins, 'moneta', 'monete')}${hasSecret ? (gotSecret ? ' · gomitolo trovato' : ' · il gomitolo è ancora lì') : ''}`
            : 'Mai superato. Prima o poi.'
          : `Finisci ${LEVELS[index - 1]?.name ?? ''} per sbloccarlo`,
        locked: !unlocked,
        onSelect: () => this.startLevel(index),
      };
    });

    items.push({ label: 'INDIETRO', onSelect: () => this.showWorldsMenu() });

    const { cleared, yarn, secrets } = this.worldProgress(world);
    this.page({
      title: `MONDO ${world.number} · ${cleared} su ${world.levels.length}${secrets > 0 ? ` · ${yarn}/${secrets} gomitoli` : ''}`,
      items,
      onBack: () => this.showWorldsMenu(),
    });
  }

  // ------------------------------------------------------------ classifica
  private showLeaderboardMenu(): void {
    const items: MenuItem[] = LEVELS.map((level) => {
      const record = this.progress.levels[level.id];
      return {
        label: level.name,
        sub: level.title,
        value: record?.cleared ? formatTicksPrecise(record.bestTicks) : '—',
        hint: record?.cleared
          ? 'Il valore a destra è il tuo tempo: guarda quanto sei lontano'
          : 'Non l\'hai mai finito. Gli altri sì',
        onSelect: () => void this.showLeaderboardFor(level.id, level.name, level.title),
      };
    });

    items.push({ label: 'INDIETRO', onSelect: () => this.showRootMenu() });

    this.page({
      title: 'CLASSIFICA · i venti tempi migliori di ogni livello',
      items,
      onBack: () => this.showRootMenu(),
    });
  }

  private async showLeaderboardFor(levelId: string, name: string, title: string): Promise<void> {
    const request = ++this.leaderboardRequest;
    const back: MenuItem = { label: 'INDIETRO', onSelect: () => this.showLeaderboardMenu() };

    const page = (body: readonly string[], rows: readonly MenuRow[] = []): void => {
      this.page({
        compact: true,
        title: `${name} — ${title}`,
        body,
        rows,
        items: [back],
        onBack: () => this.showLeaderboardMenu(),
      });
    };

    page(['Caricamento…']);

    const rows = await this.account.leaderboard(levelId);
    // Risposta in ritardo su una pagina che non c'è più: si butta. Il giocatore
    // ha già cambiato schermata e riscrivergliela sotto sarebbe un bug.
    if (request !== this.leaderboardRequest) return;

    if (!rows) {
      page([
        'Il server non risponde.',
        'La classifica si guarda quando torna: il gioco no, quello va lo stesso.',
      ]);
      return;
    }
    if (rows.length === 0) {
      page([
        'Nessuno ha ancora finito questo livello.',
        'C\'è un primo posto libero, e non capita spesso.',
      ]);
      return;
    }

    // Le colonne le allinea il CSS con una griglia. Prima erano stringhe
    // riempite di spazi: bastava un nickname più lungo del previsto per
    // sfilare tutta la tabella, e i tempi non erano incolonnati davvero.
    const mine = this.account.nickname?.toLowerCase();
    page(
      [],
      rows.map((row, i) => ({
        cells: [
          `${i + 1}.`,
          row.nickname,
          formatMs(row.ms),
          plural(row.deaths, 'morte', 'morti'),
        ],
        strong: mine !== undefined && row.nickname.toLowerCase() === mine,
      })),
    );
  }

  // --------------------------------------------------------------- account
  private showAccountMenu(): void {
    if (this.account.isLogged) {
      this.page({
        compact: true,
        title: `ACCOUNT · ${this.account.nickname ?? ''}`,
        body: [
          'I tuoi record vanno in classifica e ti seguono su qualunque computer.',
          'Nessuna email, nessun recupero password: se la perdi, perdi l\'account.',
        ],
        items: [
          {
            label: 'SINCRONIZZA ORA',
            hint: 'Di solito succede da solo a fine livello',
            onSelect: () => {
              this.queueSync();
              this.showRootMenu();
            },
          },
          {
            label: 'ESCI',
            hint: 'I progressi restano su questo browser, ma smettono di salire in classifica',
            onSelect: () => void this.logout(),
          },
          { label: 'INDIETRO', onSelect: () => this.showRootMenu() },
        ],
        onBack: () => this.showRootMenu(),
      });
      return;
    }

    this.page({
      compact: true,
      title: 'ACCOUNT',
      body: [
        'Senza account tempi e progressi restano solo in questo browser: se cancelli i dati del sito o cambi computer, spariscono.',
        'Serve solo un nickname e una password. Niente email.',
      ],
      items: [
        {
          label: 'CREA UN ACCOUNT',
          hint: 'I progressi di adesso non si perdono: si portano dentro',
          onSelect: () => this.accountDialog.open('create'),
        },
        {
          label: 'ACCEDI',
          hint: 'Ne hai già uno',
          onSelect: () => this.accountDialog.open('login'),
        },
        { label: 'INDIETRO', onSelect: () => this.showRootMenu() },
      ],
      onBack: () => this.showRootMenu(),
    });
  }

  private async logout(): Promise<void> {
    await this.account.logout();
    this.showRootMenu();
  }

  /**
   * La collezione.
   *
   * Cambiare gatto non cambia niente di quello che succede: è l'unica
   * schermata del gioco che non nasconde nulla, e serve esattamente a questo —
   * a far vedere che quando il gioco promette qualcosa di gratis, ogni tanto
   * lo mantiene.
   */
  private showCatsMenu(back: () => void): void {
    const state = this.unlockState;

    const items: MenuItem[] = CATS.map((cat) => {
      const unlocked = isCatUnlocked(cat, state);
      const current = this.settings.cat === cat.id;
      return {
        label: unlocked ? cat.name : '???',
        value: current ? 'IN USO' : unlocked ? '' : `${cat.yarn} ✦`,
        hint: unlocked ? cat.blurb : catRequirement(cat, state),
        locked: !unlocked,
        // Scorrere la lista cambia il ritratto: è l'unico posto del gioco in
        // cui si guarda qualcosa invece di leggerlo, e una galleria che non
        // mostra la merce non è una galleria.
        onFocus: () => {
          this.preview.show(
            (r, tick) => drawCatPortrait(r, cat, tick, { locked: !unlocked, current }),
            unlocked ? cat.name : 'CHIUSO',
          );
        },
        onSelect: () => {
          if (!unlocked) return;
          this.settings = { ...this.settings, cat: cat.id };
          saveSettings(this.settings);
          this.world.player.skin = cat;
          this.showCatsMenu(back);
        },
      };
    });

    items.push({
      label: 'INDIETRO',
      // Anche l'ultima voce ha il suo focus: senza, uscendo dalla lista il
      // ritratto resterebbe fermo sull'ultimo gatto guardato, e sembrerebbe
      // che "INDIETRO" sia un gatto.
      onFocus: () => this.preview.show((r, tick) => drawCatPortrait(r, catById(this.settings.cat), tick, { current: true }), 'IN USO'),
      onSelect: back,
    });

    this.page({
      layout: 'gallery',
      title: `GATTI · ${plural(state.yarn, 'gomitolo', 'gomitoli')} su ${SECRET_COUNT}`,
      body: [
        `${SECRET_COUNT} livelli nascondono un gomitolo dietro qualcosa che sembra un muro. Quali, si scopre andandoci a sbattere.`,
        'Non danno nessun vantaggio: cambiano solo la faccia di chi muore. Non c\'è niente da comprare, e le monete non servono a questo.',
      ],
      items,
      onBack: back,
    });
  }

  private showHelpMenu(): void {
    this.page({
      title: 'COMANDI',
      body: [
        'A D  oppure  ← →     muoversi',
        'SPAZIO / W / ↑     saltare, e più lo tieni premuto più salti in alto',
        'R     ricominciare il livello da capo',
        'ESC     pausa',
        'F     schermo intero',
        'I comandi non tradiscono mai: niente ritardi, niente tasti invertiti. Se sei morto è colpa del livello, ed era voluto.',
      ],
      items: [{ label: 'INDIETRO', onSelect: () => this.showOptionsMenu() }],
      onBack: () => this.showOptionsMenu(),
    });
  }

  private showResetMenu(): void {
    this.page({
      compact: true,
      title: 'AZZERARE TUTTO?',
      body: [
        'Record, morti totali, monete, gomitoli e livelli sbloccati: sparisce tutto. Anche i gomitoli già trovati tornano dove erano, e con loro i gatti.',
      ],
      items: [
        { label: 'NO, LASCIA STARE', onSelect: () => this.showOptionsMenu() },
        {
          label: 'SÌ, CANCELLA',
          hint: 'Si riparte da 1-1 come il primo giorno',
          onSelect: () => {
            this.progress = resetProgress();
            this.showRootMenu();
            // Con un account bisogna azzerare anche di là, altrimenti la
            // prima sincronizzazione rimanda indietro tutto quello che si è
            // appena buttato via e il menu avrebbe mentito.
            if (this.account.isLogged) {
              void this.account.reset(this.progress).then((cleared) => {
                if (cleared) this.adopt(cleared);
              });
            }
          },
        },
      ],
      onBack: () => this.showOptionsMenu(),
    });
  }

  /**
   * L'audio si spegne da due posti (opzioni e pausa) e deve tornare da dove è
   * stato toccato: `after` è la pagina che ha chiesto il cambio.
   */
  private toggleAudio(after: () => void): void {
    this.settings = { ...this.settings, audio: !this.settings.audio };
    this.audio.setEnabled(this.settings.audio);
    saveSettings(this.settings);
    if (this.settings.audio) this.audio.play('ui');
    // La voce mostra il proprio stato: va ridisegnata dopo averlo cambiato.
    after();
  }

  /** Pausa: esiste solo durante il gioco. */
  private pause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'menu';
    this.input.releaseAll();
    this.pauseMenu();
  }

  /**
   * La pagina della pausa, separata dall'atto di mettere in pausa.
   *
   * Servono due cose distinte perché dai sottomenu della pausa (i gatti,
   * l'audio) si torna *qui*, e a quel punto il gioco è già fermo: `pause()`
   * rifiuterebbe di fare qualunque cosa, e si finirebbe nel menu principale
   * con il livello perso.
   */
  private pauseMenu(): void {
    const level = this.world.level;
    const stats = this.world.stats;
    const record = this.progress.levels[level.id];

    this.page({
      compact: true,
      title: `PAUSA · ${level.name} — ${level.title}`,
      // In pausa la domanda è sempre la stessa: "quanto sto andando male?".
      // Il HUD lo dice mentre si corre, ma correndo non si legge niente.
      body: [
        `In questo tentativo: ${plural(stats.deaths, 'morte', 'morti')} · ${plural(stats.coins, 'moneta', 'monete')} · ${formatTicksPrecise(stats.ticks)}`,
        record?.cleared
          ? `Il tuo record qui: ${formatTicksPrecise(record.bestTicks)} con ${plural(record.bestDeaths, 'morte', 'morti')}`
          : 'Non hai mai finito questo livello.',
      ],
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
        {
          label: 'GATTI',
          value: catById(this.settings.cat).name,
          hint: 'Cambiare manto qui non fa ricominciare niente',
          onSelect: () => this.showCatsMenu(() => this.pauseMenu()),
        },
        {
          label: 'AUDIO',
          value: this.settings.audio ? 'ON' : 'OFF',
          hint: 'Il posto in cui si spegne senza uscire dal livello',
          onSelect: () => this.toggleAudio(() => this.pauseMenu()),
        },
        { label: 'MENU PRINCIPALE', hint: 'Il livello ricomincia da capo la prossima volta', onSelect: () => this.openMenu() },
      ],
      onBack: () => this.resume(),
    });
  }

  /**
   * Chiude il menu e spegne l'anteprima.
   *
   * L'anteprima disegna a frame liberi: nascosta dal CSS resterebbe comunque a
   * girare sotto al gioco, cioè un secondo canvas animato per niente proprio
   * mentre serve tutto il tempo di frame che c'è.
   */
  private closeMenu(): void {
    this.preview.hide();
    this.menu.hide();
  }

  private resume(): void {
    this.closeMenu();
    this.screens.hideAll();
    this.phase = 'playing';
  }

  // ---------------------------------------------------------------- flusso
  private startLevel(index: number): void {
    this.audio.unlock();
    this.levelIndex = index;
    this.world = this.createWorld(index);
    this.closeMenu();
    this.screens.hideAll();
    this.screens.clearTaunt();
    this.phase = 'playing';
  }

  private handleWin(stats: RunStats): void {
    this.phase = 'between';
    const levelId = this.world.level.id;
    this.progress = recordClear(this.progress, levelId, stats);
    // Il tempo appena fatto va in classifica adesso, non alla prossima
    // apertura del gioco: è l'unico momento in cui interessa a qualcuno.
    this.queueSync();

    const isLast = this.levelIndex >= LEVELS.length - 1;
    const yarn = stats.secret ? ' · gomitolo trovato' : '';
    const summary =
      `${plural(stats.deaths, 'morte', 'morti')} · ${plural(stats.coins, 'moneta', 'monete')} · ${formatTicksPrecise(stats.ticks)} di sofferenza${yarn}` +
      // Chi non ha un account l'ha già saputo all'avvio: qui è un promemoria
      // che arriva nel momento in cui ha appena stabilito un tempo.
      (this.account.enabled && !this.account.isLogged
        ? '\nQuesto tempo non va in classifica: non hai un account.'
        : '');

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
