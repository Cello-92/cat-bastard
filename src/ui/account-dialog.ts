/**
 * Il popup dell'account.
 *
 * Esce una volta sola, all'apertura del gioco, e non obbliga a niente: si può
 * rispondere "non ora" e giocare per sempre senza. Chi risponde così però
 * riceve l'avvertimento vero — tempi e progressi restano nel browser, e un
 * browser si svuota da solo — perché scoprirlo dopo trenta livelli sarebbe la
 * sola cosa scorretta di tutto il gioco.
 *
 * Niente email, niente recupero: nickname e password, e la password persa è
 * l'account perso. È scritto qui dentro, non nelle condizioni d'uso.
 *
 * Come il menu, vive nel DOM ed è l'unico strato che tocca `document`.
 */

export interface AccountDialogCallbacks {
  /** `null` se è andata bene, altrimenti il messaggio da mostrare. */
  onRegister(nickname: string, password: string): Promise<string | null>;
  onLogin(nickname: string, password: string): Promise<string | null>;
  /** Chiuso senza account: il gioco se lo segna e non chiede più. */
  onDismiss(): void;
  /** Chiuso dopo essere entrati. */
  onDone(nickname: string): void;
}

type Mode = 'welcome' | 'create' | 'login' | 'warning';

export class AccountDialog {
  private readonly panel: HTMLElement | null;
  private readonly title: HTMLElement | null;
  private readonly lead: HTMLElement | null;
  private readonly form: HTMLFormElement | null;
  private readonly nickname: HTMLInputElement | null;
  private readonly password: HTMLInputElement | null;
  private readonly error: HTMLElement | null;
  private readonly submit: HTMLButtonElement | null;
  private readonly actions: HTMLElement | null;
  private readonly note: HTMLElement | null;

  private mode: Mode = 'welcome';
  /** Con quale schermata è stato aperto: decide dove porta "INDIETRO". */
  private entry: Mode = 'welcome';
  private busy = false;

  constructor(
    root: ParentNode,
    private readonly callbacks: AccountDialogCallbacks,
  ) {
    this.panel = root.querySelector<HTMLElement>('[data-screen="account"]');
    this.title = root.querySelector('[data-account="title"]');
    this.lead = root.querySelector('[data-account="lead"]');
    this.form = root.querySelector<HTMLFormElement>('[data-account="form"]');
    this.nickname = root.querySelector<HTMLInputElement>('[data-account="nickname"]');
    this.password = root.querySelector<HTMLInputElement>('[data-account="password"]');
    this.error = root.querySelector('[data-account="error"]');
    this.submit = root.querySelector<HTMLButtonElement>('[data-account="submit"]');
    this.actions = root.querySelector('[data-account="actions"]');
    this.note = root.querySelector('[data-account="note"]');

    this.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.send();
    });

    // Senza questa riga il nickname non si può nemmeno scrivere: A, D, W, R e
    // spazio sono comandi di gioco, e `core/input.ts` li intercetta sulla
    // finestra con preventDefault. Fermando l'evento qui — il pannello è un
    // antenato dei campi, quindi passa di qui prima — la tastiera torna a fare
    // la tastiera, e il menu smette di navigare mentre si digita.
    this.panel?.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if ((event as KeyboardEvent).key === 'Escape') this.dismiss();
    });
  }

  get isOpen(): boolean {
    return this.panel?.classList.contains('is-hidden') === false;
  }

  /** Apertura vera: all'avvio è `welcome`, dal menu si va dritti al modulo. */
  open(mode: Mode = 'welcome'): void {
    if (!this.panel) return;
    this.entry = mode;
    this.panel.classList.remove('is-hidden');
    this.goto(mode);
  }

  /** Cambio di schermata dentro al popup, senza riaprirlo. */
  private goto(mode: Mode): void {
    this.mode = mode;
    this.busy = false;
    this.render();
  }

  close(): void {
    this.panel?.classList.add('is-hidden');
    if (this.password) this.password.value = '';
    this.setError('');
  }

  // ------------------------------------------------------------- disegno
  private render(): void {
    const isForm = this.mode === 'create' || this.mode === 'login';

    if (this.form) this.form.hidden = !isForm;
    this.setError('');

    switch (this.mode) {
      case 'welcome':
        this.setText(this.title, 'UN NOME PER LA CLASSIFICA');
        this.setText(
          this.lead,
          'Un account serve a due cose: tenere i tuoi record anche se cambi computer, e mettere il tuo nome nella classifica dei tempi, livello per livello.',
        );
        this.setText(this.note, 'Nickname e password. Niente email, niente altro.');
        this.setActions([
          { label: 'CREA UN ACCOUNT', primary: true, onSelect: () => this.goto('create') },
          { label: 'HO GIÀ UN ACCOUNT', onSelect: () => this.goto('login') },
          { label: 'NON ORA', onSelect: () => this.goto('warning') },
        ]);
        break;

      case 'create':
        this.setText(this.title, 'CREA UN ACCOUNT');
        this.setText(this.lead, 'Da 3 a 16 caratteri, e una password di almeno 6.');
        this.setText(
          this.note,
          'Non c\'è modo di recuperare la password: non c\'è la tua email e non la vogliamo. Se la perdi, perdi l\'account. Non usarne una che usi altrove.',
        );
        if (this.submit) this.submit.textContent = 'CREA';
        if (this.password) this.password.autocomplete = 'new-password';
        this.setActions([{ label: 'INDIETRO', onSelect: () => this.back() }]);
        this.focusFirst();
        break;

      case 'login':
        this.setText(this.title, 'ACCEDI');
        this.setText(this.lead, 'Il nickname che hai scelto, e la sua password.');
        this.setText(
          this.note,
          'I progressi di questo browser non si perdono: si uniscono a quelli dell\'account, tenendo i record migliori dei due.',
        );
        if (this.submit) this.submit.textContent = 'ENTRA';
        if (this.password) this.password.autocomplete = 'current-password';
        this.setActions([{ label: 'INDIETRO', onSelect: () => this.back() }]);
        this.focusFirst();
        break;

      case 'warning':
        this.setText(this.title, 'ALLORA SAPPILO');
        this.setText(
          this.lead,
          'Senza account tempi e progressi restano solo in questo browser: se cancelli i dati del sito, cambi computer o giochi in incognito, spariscono. E nella classifica non ci finisci.',
        );
        this.setText(this.note, 'Puoi farti un account quando vuoi, dal menu, alla voce ACCOUNT.');
        this.setActions([
          { label: 'VA BENE COSÌ', primary: true, onSelect: () => this.dismiss() },
          { label: 'RIPENSANDOCI, CREALO', onSelect: () => this.goto('create') },
        ]);
        break;
    }
  }

  /**
   * "INDIETRO" torna da dove si è arrivati: alla scelta iniziale se il popup
   * si è aperto da solo all'avvio, fuori del tutto se l'ha aperto il menu.
   */
  private back(): void {
    if (this.entry === 'welcome') {
      this.goto('welcome');
      return;
    }
    this.close();
  }

  private dismiss(): void {
    if (this.busy) return;
    this.close();
    this.callbacks.onDismiss();
  }

  // ------------------------------------------------------------- invio
  private async send(): Promise<void> {
    if (this.busy) return;
    const nickname = this.nickname?.value.trim() ?? '';
    const password = this.password?.value ?? '';

    // Due controlli, gli stessi che fa il server. Qui servono solo a non far
    // fare un giro di rete a chi ha lasciato un campo vuoto.
    if (nickname.length < 3) {
      this.setError('Il nickname deve avere almeno 3 caratteri.');
      return;
    }
    if (password.length < 6) {
      this.setError('La password deve avere almeno 6 caratteri.');
      return;
    }

    this.setBusy(true);
    const failure =
      this.mode === 'create'
        ? await this.callbacks.onRegister(nickname, password)
        : await this.callbacks.onLogin(nickname, password);
    this.setBusy(false);

    if (failure) {
      this.setError(failure);
      this.password?.focus();
      return;
    }

    this.close();
    this.callbacks.onDone(nickname);
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    if (this.submit) {
      this.submit.disabled = busy;
      if (busy) this.submit.textContent = 'UN ATTIMO…';
      else this.submit.textContent = this.mode === 'create' ? 'CREA' : 'ENTRA';
    }
    this.panel?.classList.toggle('is-busy', busy);
  }

  private focusFirst(): void {
    // Il fuoco va nel campo, non sul primo bottone: chi apre il modulo vuole
    // scrivere. `setTimeout` perché l'elemento è appena tornato visibile.
    window.setTimeout(() => this.nickname?.focus(), 0);
  }

  private setError(message: string): void {
    if (!this.error) return;
    this.error.textContent = message;
    this.error.hidden = message.length === 0;
  }

  private setText(el: HTMLElement | null, text: string): void {
    if (el) el.textContent = text;
  }

  private setActions(
    items: ReadonlyArray<{ label: string; primary?: boolean; onSelect(): void }>,
  ): void {
    if (!this.actions) return;
    this.actions.replaceChildren(
      ...items.map((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = item.primary ? 'btn' : 'btn btn--ghost';
        button.textContent = item.label;
        button.addEventListener('click', () => {
          if (!this.busy) item.onSelect();
        });
        return button;
      }),
    );
  }
}
