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
}

const emptyProgress = (): Progress => ({ levels: {}, totalDeaths: 0 });

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      levels: parsed.levels ?? {},
      totalDeaths: parsed.totalDeaths ?? 0,
    };
  } catch {
    return emptyProgress();
  }
}

/** Preferenze del giocatore. Poche, e tutte con un default sensato. */
export interface Settings {
  audio: boolean;
}

const defaultSettings = (): Settings => ({ audio: true });

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { audio: parsed.audio ?? true };
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
    levels: { ...progress.levels, [levelId]: next },
    totalDeaths: progress.totalDeaths + run.deaths,
  };
  saveProgress(updated);
  return updated;
}
