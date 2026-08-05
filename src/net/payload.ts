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
  coins: number;
  total_deaths: number;
  skin: string;
  skins: string[];
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
    coins: progress.coins,
    total_deaths: progress.totalDeaths,
    skin: progress.skin,
    skins: progress.skins,
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
 *
 * Le monete in tasca sono l'unica eccezione e vince il server: si spendono, e
 * tenere la cifra più alta significherebbe restituire quelle già spese.
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

  const skins = [...new Set([...local.skins, ...(remote.skins ?? [])])];

  return {
    levels,
    totalDeaths: Math.max(local.totalDeaths, remote.total_deaths ?? 0),
    coins: typeof remote.coins === 'number' ? remote.coins : local.coins,
    skins,
    // Una skin equipaggiata che non si possiede non esiste: il gioco la
    // rimpiazza col gatto di serie, ma è meglio non scrivercela proprio.
    skin: skins.includes(remote.skin) ? remote.skin : local.skin,
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
