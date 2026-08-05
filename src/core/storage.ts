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
   * Monete in tasca, spendibili.
   *
   * Si incassano solo *finendo* un livello: quelle raccolte in un tentativo
   * finito male non entrano in tasca. È la ragione per cui raccogliere una
   * moneta è una scelta e non un riflesso — e visto che una moneta su tre è
   * avvelenata, è anche una scommessa.
   */
  coins: number;
  /** Skin già ottenute: comprate, trovate, o vinte una volta per sempre. */
  skins: string[];
  /** Skin equipaggiata. */
  skin: string;
}

const emptyProgress = (): Progress => ({
  levels: {},
  totalDeaths: 0,
  coins: 0,
  skins: [],
  skin: 'classic',
});

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
      coins: parsed.coins ?? 0,
      skins: Array.isArray(parsed.skins) ? parsed.skins : [],
      skin: typeof parsed.skin === 'string' ? parsed.skin : 'classic',
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

/** Aggiunge una skin alla collezione. Idempotente: un cubo si prende una volta. */
export function unlockSkin(progress: Progress, skinId: string): Progress {
  if (progress.skins.includes(skinId)) return progress;
  const updated: Progress = { ...progress, skins: [...progress.skins, skinId] };
  saveProgress(updated);
  return updated;
}

/** Compra una skin: toglie le monete e la aggiunge. Se non bastano, non fa niente. */
export function buySkin(progress: Progress, skinId: string, price: number): Progress {
  if (progress.skins.includes(skinId) || progress.coins < price) return progress;
  const updated: Progress = {
    ...progress,
    coins: progress.coins - price,
    skins: [...progress.skins, skinId],
  };
  saveProgress(updated);
  return updated;
}

export function equipSkin(progress: Progress, skinId: string): Progress {
  if (progress.skin === skinId) return progress;
  const updated: Progress = { ...progress, skin: skinId };
  saveProgress(updated);
  return updated;
}
