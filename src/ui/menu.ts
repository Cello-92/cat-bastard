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
  /** Voce non ancora disponibile: si vede, non si sceglie. */
  locked?: boolean;
  onSelect(): void;
}

export interface MenuPage {
  title?: string;
  /** Pagina "di servizio" (pausa, conferme): senza logo, va dritta al punto. */
  compact?: boolean;
  /** Righe di testo mostrate sopra le voci: istruzioni, crediti, avvertimenti. */
  body?: readonly string[];
  items: readonly MenuItem[];
  /** Chiamata su Esc / voce "indietro". Assente = pagina radice. */
  onBack?: () => void;
}

export interface MenuCallbacks {
  /** La selezione si è spostata: serve solo a far suonare il menu. */
  onMove(): void;
  /** Una voce è stata confermata. */
  onChoose(): void;
  /** Esc premuto a menu chiuso: il gioco decide se è una pausa. */
  onPauseRequest(): void;
}

export class Menu {
  private readonly list: HTMLElement;
  private readonly heading: HTMLElement | null;
  private readonly body: HTMLElement | null;
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

    this.list.replaceChildren(...this.items.map((item, i) => this.render(item, i)));
    this.panel.classList.toggle('is-compact', page.compact === true);
    this.panel.classList.remove('is-hidden');
    this.open = true;
    this.refresh();
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

  /** Salta le voci bloccate: selezionarle sarebbe un vicolo cieco. */
  private step(direction: number): void {
    const total = this.items.length;
    if (total === 0) return;

    for (let i = 1; i <= total; i++) {
      const next = (((this.index + direction * i) % total) + total) % total;
      if (!this.items[next]?.locked) {
        this.moveTo(next, true);
        return;
      }
    }
  }

  private moveTo(index: number, sound: boolean): void {
    if (index === this.index) return;
    this.index = index;
    this.refresh();
    if (sound) this.callbacks.onMove();
  }

  private choose(): void {
    const item = this.items[this.index];
    if (!item || item.locked) return;
    this.callbacks.onChoose();
    item.onSelect();
  }

  private refresh(): void {
    const buttons = this.list.querySelectorAll<HTMLElement>('.menu__item');
    buttons.forEach((button, i) => {
      button.classList.toggle('is-current', i === this.index);
      if (i === this.index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });

    if (this.hint) {
      const text = this.items[this.index]?.hint ?? '';
      this.hint.textContent = text;
      this.hint.hidden = text.length === 0;
    }
  }
}
