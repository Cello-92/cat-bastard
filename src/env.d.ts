/// <reference types="vite/client" />

/**
 * Le uniche due variabili d'ambiente del progetto.
 *
 * Vanno in `.env.local` per lo sviluppo e nei secrets del repo per il deploy
 * (vedi `.github/workflows/deploy.yml`). Se mancano, il gioco parte lo stesso
 * senza account e senza classifica: è il comportamento voluto, non un ripiego.
 *
 * La chiave `anon` finisce nel bundle pubblico ed è giusto così — è pubblica
 * per costruzione. Quella che NON deve finire qui dentro per nessun motivo è
 * la `service_role`: quella scavalca RLS.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
