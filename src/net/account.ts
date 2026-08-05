import {
  clearSession,
  loadSession,
  saveSession,
  type Progress,
  type Session,
} from '@core/storage';
import { BackendError, SupabaseClient } from './supabase';
import {
  applyRemote,
  errorMessage,
  isRemoteState,
  toPayload,
  type LeaderboardRow,
  type RemoteFailure,
  type RemoteReply,
} from './payload';

/**
 * L'account, visto dal gioco.
 *
 * Tre regole, e non sono negoziabili più di quanto lo siano quelle delle
 * trappole:
 *
 * 1. **Il gioco non aspetta mai il server.** Niente qui dentro blocca un
 *    livello, una morte o un salto. Se la rete non c'è si gioca uguale e si
 *    salva in locale, come si è sempre fatto.
 * 2. **Il locale è la verità corrente, il server è la copia condivisa.** Si
 *    spinge quello che si ha, si adotta quello che torna, e in caso di dubbio
 *    vince il record migliore (vedi `payload.ts`).
 * 3. **Un errore di rete non è un errore di gioco.** `sync` non lancia niente
 *    e non mostra niente: fallisce in silenzio e riprova la volta dopo. Solo
 *    login e registrazione parlano, perché lì c'è qualcuno che sta aspettando
 *    una risposta.
 */

export type AuthResult = { ok: true; progress: Progress } | { ok: false; message: string };

export class Account {
  private readonly client = SupabaseClient.create();
  private session: Session | null = loadSession();

  /** C'è un backend configurato? Se no, tutto il resto è un no-op. */
  get enabled(): boolean {
    return this.client !== null;
  }

  get isLogged(): boolean {
    return this.client !== null && this.session !== null;
  }

  get nickname(): string | null {
    return this.session?.nickname ?? null;
  }

  // ------------------------------------------------------------- accesso
  async register(nickname: string, password: string, local: Progress): Promise<AuthResult> {
    return this.authenticate('cb_register', nickname, password, local);
  }

  async login(nickname: string, password: string, local: Progress): Promise<AuthResult> {
    return this.authenticate('cb_login', nickname, password, local);
  }

  private async authenticate(
    fn: 'cb_register' | 'cb_login',
    nickname: string,
    password: string,
    local: Progress,
  ): Promise<AuthResult> {
    if (!this.client) return { ok: false, message: 'Il backend non è configurato.' };

    let reply: RemoteReply;
    try {
      reply = await this.client.rpc<RemoteReply>(fn, {
        p_nickname: nickname.trim(),
        p_password: password,
      });
    } catch (error) {
      return { ok: false, message: errorMessage(codeOf(error)) };
    }

    if (!isRemoteState(reply)) {
      return { ok: false, message: errorMessage((reply as RemoteFailure).error) };
    }
    if (!reply.token) {
      return { ok: false, message: errorMessage('HTTP_ERROR') };
    }

    this.session = { token: reply.token, nickname: reply.nickname };
    saveSession(this.session);

    // Appena entrati si spinge quello che c'era in questo browser: chi ha
    // giocato mezz'ora prima di farsi l'account non deve perdere quella
    // mezz'ora. La risposta di `sync` è già la fusione delle due parti.
    const merged = (await this.sync(local)) ?? applyRemote(reply, local);
    return { ok: true, progress: merged };
  }

  async logout(): Promise<void> {
    const token = this.session?.token;
    this.session = null;
    clearSession();
    if (!this.client || !token) return;
    // Chiudere la sessione sul server è cortesia, non correttezza: se fallisce
    // il token resta valido là ma qui non esiste più.
    try {
      await this.client.rpc('cb_logout', { p_token: token });
    } catch {
      // Silenzio: chi ha premuto "esci" è già uscito.
    }
  }

  // ---------------------------------------------------------- sincronia
  /**
   * Manda i progressi e adotta la fusione. `null` se non c'è niente da fare o
   * se è andata male: chi chiama tiene quello che aveva e riprova più in là.
   */
  async sync(local: Progress): Promise<Progress | null> {
    if (!this.client || !this.session) return null;

    try {
      const reply = await this.client.rpc<RemoteReply>('cb_sync', {
        p_token: this.session.token,
        p_payload: toPayload(local),
      });
      if (!isRemoteState(reply)) {
        // Sessione morta (scaduta, o account cancellato a mano): meglio
        // saperlo subito e tornare anonimi che ritentare per sempre.
        if ((reply as RemoteFailure).error === 'NO_SESSION') {
          this.session = null;
          clearSession();
        }
        return null;
      }
      return applyRemote(reply, local);
    } catch {
      return null;
    }
  }

  /**
   * Azzera anche sul server. Senza, "azzera progressi" sarebbe una bugia: la
   * sincronizzazione dopo rimanderebbe indietro tutti i record cancellati.
   */
  async reset(local: Progress): Promise<Progress | null> {
    if (!this.client || !this.session) return null;
    try {
      const reply = await this.client.rpc<RemoteReply>('cb_reset', {
        p_token: this.session.token,
      });
      return isRemoteState(reply) ? applyRemote(reply, local) : null;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------- classifica
  /** La classifica di un livello. Pubblica: si guarda anche senza account. */
  async leaderboard(levelId: string, limit = 20): Promise<LeaderboardRow[] | null> {
    if (!this.client) return null;
    try {
      const rows = await this.client.rpc<LeaderboardRow[]>('cb_leaderboard', {
        p_level_id: levelId,
        p_limit: limit,
      });
      return Array.isArray(rows) ? rows : [];
    } catch {
      return null;
    }
  }
}

const codeOf = (error: unknown): string =>
  error instanceof BackendError ? error.code : 'HTTP_ERROR';

export type { LeaderboardRow };
