/**
 * Progressi salvati in localStorage. Ogni accesso è difensivo: in modalità
 * privata o con i cookie bloccati il gioco deve comunque partire.
 */

const KEY = 'cat-bastard/progress/v1';
const SETTINGS_KEY = 'cat-bastard/settings/v1';

export interface LevelRecord {
  cleared: boolean;
  bestDeaths: number;
  bestTicks: number;
  bestCoins: number;
}

export interface Progress {
  levels: Record<string, LevelRecord>;
  totalDeaths: number;
  /**
   * Id dei livelli in cui il gomitolo nascosto è stato trovato.
   *
   * Sta nei progressi e non nel record del livello perché un segreto trovato
   * non si perde più: rigiocare il livello e non prenderlo non lo cancella —
   * sarebbe l'unica cattiveria del gioco senza una battuta a giustificarla.
   */
  secrets: string[];
}

const emptyProgress = (): Progress => ({ levels: {}, totalDeaths: 0, secrets: [] });

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    // Ogni campo ha il suo default: un salvataggio di una versione precedente
    // del gioco deve continuare a caricarsi, non azzerare i record di nessuno.
    return {
      levels: parsed.levels ?? {},
      totalDeaths: parsed.totalDeaths ?? 0,
      // Chi giocava prima che i gomitoli esistessero non ne ha nessuno, e va
      // benissimo così: il salvataggio vecchio deve continuare a caricarsi.
      secrets: parsed.secrets ?? [],
    };
  } catch {
    return emptyProgress();
  }
}

/** Preferenze del giocatore. Poche, e tutte con un default sensato. */
export interface Settings {
  audio: boolean;
  /** Id del gatto scelto (vedi game/cats.ts). */
  cat: string;
}

const defaultSettings = (): Settings => ({ audio: true, cat: 'bastardo' });

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { audio: parsed.audio ?? true, cat: parsed.cat ?? 'bastardo' };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Come sopra: senza salvataggio si gioca lo stesso.
  }
}

/** Cancella tutto: record, livelli sbloccati, morti accumulate. */
export function resetProgress(): Progress {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Se non si può cancellare, almeno la sessione riparte pulita.
  }
  return emptyProgress();
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Niente salvataggio: pazienza, non è un motivo per rompere il gioco.
  }
}

/** Registra un livello completato tenendo solo il risultato migliore. */
export function recordClear(
  progress: Progress,
  levelId: string,
  run: { deaths: number; ticks: number; coins: number },
): Progress {
  const previous = progress.levels[levelId];
  const next: LevelRecord = {
    cleared: true,
    bestDeaths: previous ? Math.min(previous.bestDeaths, run.deaths) : run.deaths,
    bestTicks: previous ? Math.min(previous.bestTicks, run.ticks) : run.ticks,
    bestCoins: previous ? Math.max(previous.bestCoins, run.coins) : run.coins,
  };
  const updated: Progress = {
    ...progress,
    levels: { ...progress.levels, [levelId]: next },
    totalDeaths: progress.totalDeaths + run.deaths,
    // Le monete si portano a casa solo arrivando in fondo, ogni volta: un
    // livello si può rigiocare, e chi lo rigioca per farmare monete sta
    // comunque rigiocando un livello che lo odia. Ci sta.
    coins: progress.coins + run.coins,
  };
  saveProgress(updated);
  return updated;
}

/** Segna il gomitolo di un livello come trovato. Idempotente. */
export function recordSecret(progress: Progress, levelId: string): Progress {
  if (progress.secrets.includes(levelId)) return progress;
  const updated: Progress = { ...progress, secrets: [...progress.secrets, levelId] };
  saveProgress(updated);
  return updated;
}
