import { REQUEST_TIMEOUT_MS, backendConfig, type BackendConfig } from './config';

/**
 * Il trasporto: chiamate RPC a PostgREST con `fetch` e basta.
 *
 * Non c'è nessuna libreria e non serve: una RPC di Supabase è una POST con due
 * intestazioni e un corpo JSON. Il vincolo "zero dipendenze a runtime" del
 * progetto non è un capriccio da rispettare a denti stretti, qui è proprio la
 * scelta più semplice — `@supabase/supabase-js` sono 40kB per fare questo.
 *
 * Questo file non sa niente di Cat Bastard: sa parlare con un database. Cosa
 * si dice sta in `account.ts`.
 */

export class BackendError extends Error {
  constructor(
    message: string,
    /** Codice interno: serve a distinguere "rete giù" da "password sbagliata". */
    readonly code: string,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

export class SupabaseClient {
  private constructor(private readonly config: BackendConfig) {}

  /** Restituisce null se il backend non è configurato: il gioco va avanti lo stesso. */
  static create(): SupabaseClient | null {
    const config = backendConfig();
    return config ? new SupabaseClient(config) : null;
  }

  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    // Una richiesta che non torna è peggio di una che fallisce: senza questo,
    // il popup dell'account resterebbe a "attendere..." per sempre.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.config.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.config.anonKey,
          Authorization: `Bearer ${this.config.anonKey}`,
        },
        body: JSON.stringify(args),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BackendError(`RPC ${fn}: HTTP ${response.status}`, 'HTTP_ERROR');
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BackendError) throw error;
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      throw new BackendError(
        aborted ? `RPC ${fn}: scaduta` : `RPC ${fn}: rete non raggiungibile`,
        aborted ? 'TIMEOUT' : 'NETWORK',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
