/**
 * Il menu: l'unica parte del gioco con cui si interagisce senza correre.
 *
 * È costruito come un menu da console, non come una pagina web: si naviga con
 * le frecce, si conferma con Invio, si torna indietro con Esc — e le stesse
 * voci restano cliccabili col mouse e toccabili col dito, perché il gioco vive
 * in un browser e nessuno dei tre modi va penalizzato.
 *
 * Vive interamente nel DOM: il testo resta nitido a qualunque risoluzione, è
 * leggibile dagli screen reader e non costa un pixel di lavoro al renderer.
 * Come tutto il resto di `ui/`, è l'unico strato che tocca `document`.
 */

export interface MenuItem {
  /** Testo della voce. */
  label: string;
  /** Valore mostrato a destra: lo stato di un'opzione, il record di un livello. */
  value?: string;
  /** Riga di spiegazione mostrata quando la voce è selezionata. */
  hint?: string;
  /** Riga sotto l'etichetta: il sottotitolo di un mondo, il nome di un livello. */
  sub?: string;
  /**
   * Voce non ancora disponibile.
   *
   * Si può guardare ma non confermare. La differenza conta: il motivo per cui
   * una voce è chiusa sta nel suo `hint`, e un gatto ancora da sbloccare ha una
   * sagoma da mostrare — roba che nessuno vedrebbe mai se la selezione le
   * saltasse a piè pari, com'è stato finché il mouse era l'unico modo di
   * arrivarci.
   */
  locked?: boolean;
  /**
   * La voce è diventata quella corrente.
   *
   * Serve alle pagine che mostrano qualcosa accanto alla lista — il gatto della
   * collezione, per dirne una. Il menu non sa cosa ci sia da mostrare e non deve
   * saperlo: dice solo *quando* è cambiata la selezione, e chi ha costruito la
   * pagina disegna quello che gli pare.
   */
  onFocus?(): void;
  onSelect(): void;
}

/** Una riga di dati: la classifica, e qualunque cosa venga dopo. */
export interface MenuRow {
  cells: readonly string[];
  /** Riga da far risaltare: in classifica è la tua. */
  strong?: boolean;
}

export interface MenuPage {
  title?: string;
  /** Pagina "di servizio" (pausa, conferme): senza logo, va dritta al punto. */
  compact?: boolean;
  /**
   * Con `gallery` la lista si stringe e lascia posto al riquadro d'anteprima.
   * È l'unica pagina del gioco in cui c'è qualcosa da *guardare* e non da
   * leggere, e una lista a tutta larghezza le toglierebbe il senso.
   */
  layout?: 'list' | 'gallery';
  /** Righe di testo mostrate sopra le voci: istruzioni, crediti, avvertimenti. */
  body?: readonly string[];
  /** Dati in colonne, sopra le voci. Allineati dal CSS, non con gli spazi. */
  rows?: readonly MenuRow[];
  items: readonly MenuItem[];
  /** Chiamata su Esc / voce "indietro". Assente = pagina radice. */
  onBack?: () => void;
}

export interface MenuCallbacks {
  /** La selezione si è spostata: serve solo a far suonare il menu. */
  onMove(): void;
  /** Una voce è stata confermata. */
  onChoose(): void;
  /** Invio su una voce chiusa: va detto, altrimenti sembra un tasto rotto. */
  onDenied?(): void;
  /** Esc premuto a menu chiuso: il gioco decide se è una pausa. */
  onPauseRequest(): void;
  /**
   * C'è qualcosa sopra al menu che si sta prendendo la tastiera?
   *
   * Il menu resta visibile dietro al popup dell'account, e senza questa
   * domanda continuerebbe a rispondere alle frecce e all'Invio: si premerebbe
   * "GIOCA" senza vederlo, mentre si sta scrivendo una password. Il menu non
   * sa cosa ci sia sopra e non deve saperlo — chiede, e basta.
   */
  isBlocked?(): boolean;
}

export class Menu {
  private readonly list: HTMLElement;
  private readonly heading: HTMLElement | null;
  private readonly body: HTMLElement | null;
  private readonly rows: HTMLElement | null;
  private readonly hint: HTMLElement | null;

  private items: readonly MenuItem[] = [];
  private onBack: (() => void) | undefined;
  private index = 0;
  private open = false;

  constructor(
    private readonly panel: HTMLElement,
    private readonly callbacks: MenuCallbacks,
  ) {
    this.list = panel.querySelector('[data-menu-list]') ?? panel;
    this.heading = panel.querySelector('[data-menu-title]');
    this.body = panel.querySelector('[data-menu-body]');
    this.rows = panel.querySelector('[data-menu-rows]');
    this.hint = panel.querySelector('[data-menu-hint]');

    window.addEventListener('keydown', this.handleKey);
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Mostra una pagina. Ricostruisce le voci: sono dati, non markup fisso. */
  show(page: MenuPage): void {
    this.items = page.items;
    this.onBack = page.onBack;
    this.index = this.items.findIndex((item) => !item.locked);
    if (this.index < 0) this.index = 0;

    if (this.heading) {
      this.heading.textContent = page.title ?? '';
      this.heading.hidden = !page.title;
    }

    if (this.body) {
      const lines = page.body ?? [];
      this.body.replaceChildren(
        ...lines.map((line) => {
          const p = document.createElement('p');
          p.textContent = line;
          return p;
        }),
      );
      this.body.hidden = lines.length === 0;
    }

    if (this.rows) {
      const data = page.rows ?? [];
      this.rows.replaceChildren(...data.map((row) => this.renderRow(row)));
      this.rows.hidden = data.length === 0;
    }

    this.list.replaceChildren(...this.items.map((item, i) => this.render(item, i)));
    this.panel.classList.toggle('is-compact', page.compact === true);
    this.panel.classList.toggle('is-gallery', page.layout === 'gallery');
    this.panel.classList.remove('is-hidden');
    this.open = true;
    this.refresh();
  }

  private renderRow(row: MenuRow): HTMLElement {
    const line = document.createElement('div');
    line.className = 'menu__row';
    if (row.strong) line.classList.add('is-strong');
    line.replaceChildren(
      ...row.cells.map((cell) => {
        const span = document.createElement('span');
        span.textContent = cell;
        return span;
      }),
    );
    return line;
  }

  hide(): void {
    this.panel.classList.add('is-hidden');
    this.open = false;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKey);
  }

  private render(item: MenuItem, i: number): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu__item';
    button.dataset['index'] = String(i);
    if (item.locked) button.classList.add('is-locked');

    const label = document.createElement('span');
    label.className = 'menu__label';
    label.textContent = item.label;

    if (item.sub) {
      // Il sottotitolo sta *dentro* l'etichetta e non in una colonna sua: così
      // la voce resta un blocco solo e il valore a destra continua ad allinearsi
      // con quello delle altre righe, che è tutto il punto della colonna.
      const sub = document.createElement('small');
      sub.className = 'menu__sub';
      sub.textContent = item.sub;
      label.append(sub);
    }
    button.append(label);

    if (item.value) {
      const value = document.createElement('span');
      value.className = 'menu__value';
      value.textContent = item.value;
      button.append(value);
    }

    // Il mouse muove la selezione come le frecce: una sola nozione di "voce
    // corrente", qualunque sia il dispositivo.
    button.addEventListener('pointerenter', () => this.moveTo(i, false));
    // Su touch il puntatore non "passa sopra": il tap deve bastare.
    button.addEventListener('click', () => {
      this.moveTo(i, false);
      this.choose();
    });
    return button;
  }

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (this.callbacks.isBlocked?.() === true) return;

    if (!this.open) {
      // Esc a gioco aperto non è "indietro": è la richiesta di pausa.
      if (event.code === 'Escape') {
        event.preventDefault();
        this.callbacks.onPauseRequest();
      }
      return;
    }

    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        event.preventDefault();
        this.step(-1);
        break;
      case 'ArrowDown':
      case 'KeyS':
        event.preventDefault();
        this.step(1);
        break;
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        event.preventDefault();
        this.choose();
        break;
      case 'Escape':
      case 'Backspace':
        if (!this.onBack) return;
        event.preventDefault();
        this.onBack();
        break;
      default:
        break;
    }
  };

  /**
   * Scorre di una voce, girando in tondo.
   *
   * Le voci chiuse si attraversano come le altre: è l'unico modo di leggere
   * perché sono chiuse, e nella collezione è l'unico modo di vedere la sagoma
   * di quello che manca. Confermarle non fa niente (vedi `choose`).
   */
  private step(direction: number): void {
    const total = this.items.length;
    if (total === 0) return;
    this.moveTo((((this.index + direction) % total) + total) % total, true);
  }

  private moveTo(index: number, sound: boolean): void {
    if (index === this.index) return;
    this.index = index;
    this.refresh();
    if (sound) this.callbacks.onMove();
  }

  private choose(): void {
    const item = this.items[this.index];
    if (!item) return;
    if (item.locked) {
      this.callbacks.onDenied?.();
      return;
    }
    this.callbacks.onChoose();
    item.onSelect();
  }

  private refresh(): void {
    const buttons = this.list.querySelectorAll<HTMLElement>('.menu__item');
    buttons.forEach((button, i) => {
      button.classList.toggle('is-current', i === this.index);
      if (i === this.index) {
        button.setAttribute('aria-current', 'true');
        // Con undici livelli o dieci gatti la lista è più alta dello schermo:
        // senza questo, chi naviga con le frecce perde di vista la selezione e
        // il menu sembra bloccato.
        button.scrollIntoView({ block: 'nearest' });
      } else {
        button.removeAttribute('aria-current');
      }
    });

    if (this.hint) {
      const text = this.items[this.index]?.hint ?? '';
      this.hint.textContent = text;
      this.hint.hidden = text.length === 0;
    }

    // Per ultimo: chi ascolta il focus di solito disegna qualcosa, e deve
    // trovare la pagina già a posto.
    this.items[this.index]?.onFocus?.();
  }
}
