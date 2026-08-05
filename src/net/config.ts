/**
 * Dove sta il backend, e se c'è.
 *
 * I due valori arrivano dalle variabili d'ambiente di Vite e finiscono dentro
 * al bundle: la chiave `anon` è pubblica per costruzione — sta nel JavaScript
 * di ogni sito Supabase del mondo — e da sola non permette di fare niente,
 * perché sul database RLS è attiva ovunque e non esiste una sola policy. Si
 * possono chiamare le funzioni RPC, e quelle decidono da sé (vedi
 * `supabase/schema.sql`).
 *
 * Se mancano, il gioco funziona esattamente come prima: niente account, niente
 * classifica, progressi solo nel browser. Il backend è un di più, non un
 * requisito — un rage game non può smettere di partire perché è giù un server.
 */

export interface BackendConfig {
  readonly url: string;
  readonly anonKey: string;
}

// `import.meta.env` non esiste fuori da Vite (i test girano su Node): letto
// così, un ambiente senza variabili è un ambiente senza backend, non un errore.
const env = ((import.meta.env ?? {}) as Partial<Record<string, string>>) ?? {};

const trimSlash = (value: string): string => value.replace(/\/+$/, '');

export const backendConfig = (): BackendConfig | null => {
  const url = env['VITE_SUPABASE_URL']?.trim() ?? '';
  const anonKey = env['VITE_SUPABASE_ANON_KEY']?.trim() ?? '';
  if (!url || !anonKey) return null;
  return { url: trimSlash(url), anonKey };
};

/** Quanto si aspetta una risposta prima di dare per persa la richiesta. */
export const REQUEST_TIMEOUT_MS = 8000;
