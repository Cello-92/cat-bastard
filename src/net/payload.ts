import { msToTicks, ticksToMs } from '@core/loop';
import type { LevelRecord, Progress } from '@core/storage';

/**
 * La traduzione fra il salvataggio locale e quello del server, e viceversa.
 *
 * Sta in un file suo, senza `fetch` e senza DOM, perché è l'unica parte del
 * backend che si possa sbagliare in silenzio: una fusione fatta male non dà
 * errore, restituisce semplicemente un record peggiore di quello che il
 * giocatore aveva. Così com'è si prova headless, e infatti si prova.
 *
 * Il gioco conta in tick, il server in millisecondi (vedi `core/loop.ts`):
 * la conversione avviene qui, all'unico confine dove serve.
 *
 * Quello che *non* passa di qui è il gatto scelto: è una preferenza come
 * l'audio, non un progresso, e vive in `Settings`. Il gatto sbloccato invece
 * dipende solo dai gomitoli trovati, quindi sincronizzare i gomitoli
 * sincronizza già i gatti — senza dover mandare una lista di gatti che il
 * server dovrebbe fidarsi di ricevere.
 */

/** Un livello come lo vede il server. */
export interface RemoteLevel {
  ms: number;
  deaths: number;
  coins: number;
}

/** Lo stato di un account, come risponde `cb_sync` / `cb_login`. */
export interface RemoteState {
  ok: true;
  nickname: string;
  total_deaths: number;
  /** Id dei livelli in cui il gomitolo è stato trovato. */
  secrets: string[];
  levels: Record<string, RemoteLevel>;
  /** Presente solo su login e registrazione. */
  token?: string;
}

export interface RemoteFailure {
  ok: false;
  error: string;
}

export type RemoteReply = RemoteState | RemoteFailure;

/** Una riga di classifica. */
export interface LeaderboardRow {
  nickname: string;
  ms: number;
  deaths: number;
  coins: number;
}

export const isRemoteState = (reply: unknown): reply is RemoteState =>
  typeof reply === 'object' && reply !== null && (reply as { ok?: unknown }).ok === true;

/** Progressi locali → payload da mandare. Solo i livelli finiti hanno un tempo. */
export function toPayload(progress: Progress): Record<string, unknown> {
  const levels: Record<string, RemoteLevel> = {};
  for (const [id, record] of Object.entries(progress.levels)) {
    if (!record?.cleared) continue;
    levels[id] = {
      ms: ticksToMs(record.bestTicks),
      deaths: record.bestDeaths,
      coins: record.bestCoins,
    };
  }

  return {
    total_deaths: progress.totalDeaths,
    secrets: progress.secrets,
    levels,
  };
}

/**
 * Stato del server → progressi locali.
 *
 * Il server ha già fuso quello che gli abbiamo appena mandato, quindi in teoria
 * basterebbe adottare la sua risposta. Si rifonde lo stesso con la copia locale
 * perché "in teoria" non è una garanzia: se la spinta è fallita a metà, o se
 * nel frattempo il giocatore ha finito un livello, l'unica cosa che non deve
 * succedere è che un record sparisca. Nel dubbio si tiene il migliore dei due.
 */
export function applyRemote(remote: RemoteState, local: Progress): Progress {
  const levels: Record<string, LevelRecord> = { ...local.levels };

  for (const [id, entry] of Object.entries(remote.levels ?? {})) {
    if (!entry || typeof entry.ms !== 'number') continue;
    const ticks = msToTicks(entry.ms);
    const previous = levels[id];
    levels[id] = {
      cleared: true,
      bestTicks: previous?.cleared ? Math.min(previous.bestTicks, ticks) : ticks,
      bestDeaths: previous?.cleared
        ? Math.min(previous.bestDeaths, entry.deaths ?? 0)
        : (entry.deaths ?? 0),
      bestCoins: previous?.cleared
        ? Math.max(previous.bestCoins, entry.coins ?? 0)
        : (entry.coins ?? 0),
    };
  }

  return {
    levels,
    // Le morti totali sono un contatore che sale e basta: il numero più alto è
    // sempre quello vero.
    totalDeaths: Math.max(local.totalDeaths, remote.total_deaths ?? 0),
    // I gomitoli si uniscono, come già fa `recordSecret` in locale: un segreto
    // trovato non si perde più, e tantomeno cambiando computer.
    secrets: [...new Set([...local.secrets, ...(remote.secrets ?? [])])],
  };
}

/**
 * I codici del server, in italiano.
 *
 * Il server non parla italiano di proposito: manda codici, e la lingua la
 * decide chi la mostra. Un messaggio sconosciuto non deve mai finire davanti
 * al giocatore così com'è.
 */
const MESSAGES: Record<string, string> = {
  NICKNAME_INVALID: 'Il nickname va da 3 a 16 caratteri: lettere, numeri, punto, trattino.',
  PASSWORD_INVALID: 'La password deve avere almeno 6 caratteri (e al massimo 72).',
  NICKNAME_TAKEN: 'Quel nickname se lo è già preso qualcuno. Inventatene un altro.',
  BAD_CREDENTIALS: 'Nickname o password sbagliati.',
  LOCKED: 'Troppi tentativi sbagliati. Riprova fra un quarto d\'ora.',
  NO_SESSION: 'La sessione è scaduta: rifai l\'accesso.',
  PAYLOAD_INVALID: 'Il salvataggio da mandare non ha senso. Segnalalo.',
  PAYLOAD_TOO_BIG: 'Il salvataggio da mandare è assurdamente grosso. Segnalalo.',
  TIMEOUT: 'Il server ci sta mettendo troppo. Riprova.',
  NETWORK: 'Non si raggiunge il server. Controlla la connessione.',
  HTTP_ERROR: 'Il server ha risposto male. Riprova fra poco.',
};

export const errorMessage = (code: string): string =>
  MESSAGES[code] ?? 'Qualcosa è andato storto. Riprova.';
