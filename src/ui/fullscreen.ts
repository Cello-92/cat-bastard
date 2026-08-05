/**
 * Schermo intero.
 *
 * Il gioco riempie già la finestra da solo (vedi `#app` in style.css); questo
 * modulo fa l'altro pezzo, cioè togliere di mezzo anche il browser. Sono due
 * cose distinte apposta: chi non vuole il fullscreen vero ha comunque un gioco
 * che occupa tutto lo spazio disponibile.
 *
 * L'API va chiamata da un gesto dell'utente, altrimenti il browser la rifiuta
 * in silenzio: per questo si entra solo dal tasto F o dalla voce di menu, mai
 * da solo all'avvio.
 */

export const isFullscreen = (): boolean => document.fullscreenElement !== null;

export function toggleFullscreen(): void {
  if (isFullscreen()) {
    void document.exitFullscreen().catch(() => {
      // Uscire può fallire solo se ci siamo già usciti: non è un problema.
    });
    return;
  }

  void document.documentElement.requestFullscreen().catch(() => {
    // Alcuni browser (e iOS Safari) lo negano. Il gioco resta perfettamente
    // giocabile a finestra piena, quindi non c'è niente da segnalare.
  });
}

/**
 * Collega il tasto F. Ritorna la funzione per staccarlo.
 * F è l'unica scorciatoia globale del gioco che non sia un comando di gioco,
 * quindi vive qui e non in `core/input.ts`, che si occupa solo del gatto.
 */
export function bindFullscreenKey(onChange?: () => void): () => void {
  const handler = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyF' || event.repeat) return;
    // Niente scorciatoie mentre si scrive da qualche parte, per correttezza.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    toggleFullscreen();
  };

  window.addEventListener('keydown', handler);
  const changed = (): void => onChange?.();
  document.addEventListener('fullscreenchange', changed);

  return () => {
    window.removeEventListener('keydown', handler);
    document.removeEventListener('fullscreenchange', changed);
  };
}
