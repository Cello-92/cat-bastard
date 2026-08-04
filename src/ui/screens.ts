import { RULES } from '@game/config';

/**
 * Battuta dopo la morte e schermata di fine livello.
 *
 * Il menu ha una classe sua (`ui/menu.ts`) perché è navigabile e ha uno stato;
 * qui restano le due cose che il gioco si limita a mostrare. Come tutto lo
 * strato `ui/`, è l'unico posto che tocca `document`.
 */

export interface ScreensCallbacks {
  onContinue(): void;
}

export class Screens {
  private readonly win: HTMLElement | null;
  private readonly winStats: HTMLElement | null;
  private readonly winTitle: HTMLElement | null;
  private readonly continueButton: HTMLElement | null;
  private readonly taunt: HTMLElement | null;

  private tauntTimer: number | undefined;

  constructor(root: ParentNode, callbacks: ScreensCallbacks) {
    this.win = root.querySelector('[data-screen="win"]');
    this.winStats = root.querySelector('[data-win="stats"]');
    this.winTitle = this.win?.querySelector('.logo') ?? null;
    this.continueButton = root.querySelector('[data-act="again"]');
    this.taunt = root.querySelector('#taunt');

    this.continueButton?.addEventListener('click', () => callbacks.onContinue());
  }

  hideAll(): void {
    this.win?.classList.add('is-hidden');
  }

  /**
   * Schermata di fine livello. Il testo cambia a seconda che ci sia un
   * livello dopo: la promessa "sei arrivato" vale solo l'ultima volta.
   */
  showLevelComplete(options: {
    heading: string;
    sub: string;
    stats: string;
    buttonLabel: string;
  }): void {
    if (this.winTitle) {
      this.winTitle.innerHTML = `${escapeHtml(options.heading)}<span>${escapeHtml(options.sub)}</span>`;
    }
    if (this.winStats) this.winStats.textContent = options.stats;
    if (this.continueButton) this.continueButton.textContent = options.buttonLabel;
    this.win?.classList.remove('is-hidden');
  }

  showTaunt(text: string): void {
    if (!this.taunt) return;
    this.taunt.textContent = text;
    this.taunt.classList.add('is-on');
    window.clearTimeout(this.tauntTimer);
    this.tauntTimer = window.setTimeout(() => {
      this.taunt?.classList.remove('is-on');
    }, RULES.tauntDurationMs);
  }

  clearTaunt(): void {
    window.clearTimeout(this.tauntTimer);
    this.taunt?.classList.remove('is-on');
  }
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
