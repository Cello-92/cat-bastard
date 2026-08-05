-- ===========================================================================
-- Cat Bastard — backend Supabase
--
-- Da eseguire A MANO nel SQL Editor del progetto Supabase, tutto in una volta.
-- È idempotente: rilanciarlo non distrugge niente e non duplica niente.
--
-- Cosa c'è dentro:
--   1. le tabelle (giocatori, sessioni, record)
--   2. RLS attiva ovunque e nessuna policy: dal client non si legge e non si
--      scrive NIENTE direttamente. Si passa solo dalle funzioni qui sotto.
--   3. le funzioni RPC, tutte SECURITY DEFINER: sono l'unica superficie
--      pubblica, e ognuna decide da sé cosa può fare chi chiama.
--
-- Perché così: la chiave `anon` finisce dentro al JavaScript pubblicato, quindi
-- è pubblica per costruzione. Non è un segreto e non va trattata come tale:
-- l'unica difesa vera è che con quella chiave si possano chiamare solo le sette
-- funzioni qui sotto, e nient'altro.
--
-- Niente email, niente recupero password, niente dato personale: il nickname è
-- un'etichetta scelta dal giocatore e la password serve solo a rivendicare
-- quell'etichetta. Password persa = account perso, ed è dichiarato nel gioco.
-- ===========================================================================

create extension if not exists pgcrypto with schema extensions;

-- --------------------------------------------------------------- tabelle ---

-- Un giocatore: il nickname, la password (bcrypt) e tutto ciò che nel gioco
-- non è legato a un livello singolo (morti totali, gomitoli trovati).
create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null,
  password_hash text not null,
  total_deaths  integer not null default 0,
  -- Id dei livelli in cui il gomitolo nascosto è stato trovato. I gatti si
  -- sbloccano contando questi, quindi sincronizzare i gomitoli sincronizza già
  -- i gatti: non c'è nessuna lista di gatti da farsi mandare e da credere.
  secrets       text[] not null default '{}',
  -- Difesa minima contro chi prova password a raffica: la chiave anon è
  -- pubblica, quindi l'endpoint di login è pubblico per definizione.
  failed_logins integer not null default 0,
  locked_until  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Il nickname è unico senza distinzione di maiuscole: "Diamond" e "diamond"
-- sono la stessa persona, altrimenti la classifica diventa un gioco di sosia.
create unique index if not exists players_nickname_key
  on public.players (lower(nickname));

-- Una sessione: il token vive nel localStorage del giocatore, qui c'è solo il
-- suo sha256. Chi legge il database non ottiene sessioni utilizzabili.
create table if not exists public.sessions (
  token_hash   text primary key,
  player_id    uuid not null references public.players(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '365 days'
);

create index if not exists sessions_player_idx on public.sessions (player_id);

-- Il record di un giocatore su un livello. `best_ms` è il tempo in
-- millisecondi: il gioco conta in tick a 60Hz, la conversione la fa il client.
create table if not exists public.scores (
  player_id   uuid not null references public.players(id) on delete cascade,
  level_id    text not null,
  best_ms     integer not null,
  best_deaths integer not null default 0,
  best_coins  integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (player_id, level_id)
);

-- L'indice della classifica: "i migliori tempi di questo livello" è l'unica
-- interrogazione che il gioco fa davvero, e la fa a ogni apertura del menu.
create index if not exists scores_leaderboard_idx
  on public.scores (level_id, best_ms);

-- ------------------------------------------------------------------- RLS ---
-- Attiva ovunque e senza policy: nessuno che arrivi con la chiave anon può
-- leggere o scrivere una riga. Le funzioni sotto girano come proprietario e
-- scavalcano RLS di proposito — sono loro il controllo di accesso.

alter table public.players  enable row level security;
alter table public.sessions enable row level security;
alter table public.scores   enable row level security;

revoke all on public.players  from anon, authenticated;
revoke all on public.sessions from anon, authenticated;
revoke all on public.scores   from anon, authenticated;

-- ------------------------------------------------------ funzioni interne ---
-- Non vengono concesse a nessuno: servono solo alle RPC pubbliche.

create or replace function public.cb_hash_token(p_token text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Token valido -> id del giocatore (e la sessione risulta "vista adesso").
-- Token assente, scaduto o inventato -> null, e chi chiama decide che dire.
create or replace function public.cb_session_player(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid;
begin
  if p_token is null or length(p_token) < 32 then
    return null;
  end if;

  update public.sessions
     set last_seen_at = now()
   where token_hash = public.cb_hash_token(p_token)
     and expires_at > now()
  returning player_id into v_player;

  return v_player;
end;
$$;

-- Lo stato completo di un giocatore, nella forma che il client si aspetta.
-- È il valore di ritorno di login, registrazione e sincronizzazione: una sola
-- forma da leggere, un solo punto da cambiare se domani si salva altro.
create or replace function public.cb_state(p_player uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'ok',           true,
    'nickname',     p.nickname,
    'total_deaths', p.total_deaths,
    'secrets',      to_jsonb(p.secrets),
    'levels', coalesce((
      select jsonb_object_agg(
        s.level_id,
        jsonb_build_object('ms', s.best_ms, 'deaths', s.best_deaths, 'coins', s.best_coins)
      )
      from public.scores s
      where s.player_id = p.id
    ), '{}'::jsonb)
  )
  from public.players p
  where p.id = p_player;
$$;

-- Apre una sessione e restituisce il token in chiaro: è l'unica volta che
-- esiste da questa parte: nel database ne resta solo l'impronta.
create or replace function public.cb_open_session(p_player uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.sessions (token_hash, player_id)
  values (public.cb_hash_token(v_token), p_player);
  return v_token;
end;
$$;

-- ------------------------------------------------------- funzioni pubbliche ---
--
-- Convenzione: NON sollevano eccezioni per gli errori previsti. Rispondono
-- sempre 200 con {"ok": false, "error": "CODICE"}, e il client traduce il
-- codice in italiano. Il motivo è concreto: un'eccezione annulla l'intera
-- transazione, e il contatore dei tentativi di login sbagliati sparirebbe
-- insieme all'errore — cioè proprio la cosa che deve sopravvivere.

create or replace function public.cb_register(p_nickname text, p_password text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid;
  v_token  text;
begin
  if p_nickname is null or p_nickname !~ '^[A-Za-z0-9_.-]{3,16}$' then
    return json_build_object('ok', false, 'error', 'NICKNAME_INVALID');
  end if;

  -- Il limite di 72 non è un capriccio: bcrypt ignora tutto ciò che eccede,
  -- e una password troncata in silenzio è peggio di una password rifiutata.
  if p_password is null or length(p_password) < 6 or length(p_password) > 72 then
    return json_build_object('ok', false, 'error', 'PASSWORD_INVALID');
  end if;

  if exists (select 1 from public.players where lower(nickname) = lower(p_nickname)) then
    return json_build_object('ok', false, 'error', 'NICKNAME_TAKEN');
  end if;

  insert into public.players (nickname, password_hash)
  values (p_nickname, extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
  returning id into v_player;

  v_token := public.cb_open_session(v_player);

  -- Lo stato appena creato, più il token: il client riceve in un colpo solo
  -- con chi sta parlando e con cosa continuare a parlarci.
  return (public.cb_state(v_player)::jsonb || jsonb_build_object('token', v_token))::json;
exception
  -- Due registrazioni identiche nello stesso istante: vince la prima, la
  -- seconda si becca la stessa risposta che avrebbe avuto un secondo dopo.
  when unique_violation then
    return json_build_object('ok', false, 'error', 'NICKNAME_TAKEN');
end;
$$;

create or replace function public.cb_login(p_nickname text, p_password text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row    public.players%rowtype;
  v_token  text;
  v_failed integer;
begin
  select * into v_row
    from public.players
   where lower(nickname) = lower(coalesce(p_nickname, ''));

  if not found then
    return json_build_object('ok', false, 'error', 'BAD_CREDENTIALS');
  end if;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    return json_build_object('ok', false, 'error', 'LOCKED');
  end if;

  if v_row.password_hash <> extensions.crypt(coalesce(p_password, ''), v_row.password_hash) then
    v_failed := v_row.failed_logins + 1;
    update public.players
       set failed_logins = case when v_failed >= 10 then 0 else v_failed end,
           locked_until  = case when v_failed >= 10 then now() + interval '15 minutes' else null end,
           updated_at    = now()
     where id = v_row.id;
    return json_build_object('ok', false, 'error', 'BAD_CREDENTIALS');
  end if;

  update public.players
     set failed_logins = 0,
         locked_until  = null,
         updated_at    = now()
   where id = v_row.id;

  v_token := public.cb_open_session(v_row.id);

  return (public.cb_state(v_row.id)::jsonb || jsonb_build_object('token', v_token))::json;
end;
$$;

create or replace function public.cb_logout(p_token text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.sessions where token_hash = public.cb_hash_token(p_token);
  return json_build_object('ok', true);
end;
$$;

-- Lo stato salvato sul server, senza toccarlo. Serve all'avvio, quando il
-- token è già nel browser e non c'è niente da spingere.
create or replace function public.cb_me(p_token text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid;
begin
  v_player := public.cb_session_player(p_token);
  if v_player is null then
    return json_build_object('ok', false, 'error', 'NO_SESSION');
  end if;
  return public.cb_state(v_player);
end;
$$;

-- ---------------------------------------------------------------------------
-- La sincronizzazione.
--
-- Il client manda tutto ciò che sa; il server tiene il meglio delle due parti
-- e restituisce il risultato, che il client adotta così com'è. Un solo giro,
-- una sola verità, e funziona identica al login e a fine livello.
--
-- Le regole di fusione, e il perché di ognuna:
--   tempo, morti  -> il minore. Sono record: il più basso ha vinto.
--   monete del livello -> la maggiore. È il massimo raccolto in un tentativo.
--   morti totali  -> la maggiore. Il contatore sale e basta, non si azzera.
--   gomitoli      -> l'unione. Uno trovato non si perde più, ed è la stessa
--                    regola che vale in locale (`recordSecret`).
--
-- Nessuna di queste è una verifica anti-imbroglio, e non finge di esserlo: i
-- controlli sui valori servono a non farsi riempire il database di spazzatura,
-- non a stabilire se un tempo è vero. Un client è un client.
-- ---------------------------------------------------------------------------
create or replace function public.cb_sync(p_token text, p_payload jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid;
  v_levels jsonb;
  v_key    text;
  v_entry  jsonb;
  v_ms      integer;
  v_deaths  integer;
  v_coins   integer;
  v_secrets text[];
begin
  v_player := public.cb_session_player(p_token);
  if v_player is null then
    return json_build_object('ok', false, 'error', 'NO_SESSION');
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return json_build_object('ok', false, 'error', 'PAYLOAD_INVALID');
  end if;

  v_levels := coalesce(p_payload -> 'levels', '{}'::jsonb);
  if jsonb_typeof(v_levels) <> 'object' then
    v_levels := '{}'::jsonb;
  end if;

  -- Il gioco ha undici livelli. Duecento è un tetto larghissimo che esiste
  -- solo perché la chiave anon è pubblica e qualcuno prima o poi proverà a
  -- mandarne centomila.
  if (select count(*) from jsonb_object_keys(v_levels)) > 200 then
    return json_build_object('ok', false, 'error', 'PAYLOAD_TOO_BIG');
  end if;

  for v_key, v_entry in select * from jsonb_each(v_levels)
  loop
    -- Un id di livello è "1-11". Tutto il resto non è roba di questo gioco.
    continue when v_key !~ '^[0-9]{1,3}-[0-9]{1,3}$';
    continue when jsonb_typeof(v_entry) <> 'object';
    continue when jsonb_typeof(v_entry -> 'ms') <> 'number';

    v_ms := floor((v_entry ->> 'ms')::numeric)::integer;
    -- Sotto il secondo non si finisce nemmeno 1-1, sopra le 24 ore non è un
    -- tempo: è qualcuno che gioca col protocollo.
    continue when v_ms < 1000 or v_ms > 86400000;

    v_deaths := 0;
    if jsonb_typeof(v_entry -> 'deaths') = 'number' then
      v_deaths := least(greatest(floor((v_entry ->> 'deaths')::numeric)::integer, 0), 1000000);
    end if;

    v_coins := 0;
    if jsonb_typeof(v_entry -> 'coins') = 'number' then
      v_coins := least(greatest(floor((v_entry ->> 'coins')::numeric)::integer, 0), 10000);
    end if;

    insert into public.scores (player_id, level_id, best_ms, best_deaths, best_coins)
    values (v_player, v_key, v_ms, v_deaths, v_coins)
    on conflict (player_id, level_id) do update
      set best_ms     = least(scores.best_ms, excluded.best_ms),
          best_deaths = least(scores.best_deaths, excluded.best_deaths),
          best_coins  = greatest(scores.best_coins, excluded.best_coins),
          updated_at  = now();
  end loop;

  -- I gomitoli: unione, e solo id di livello plausibili.
  v_secrets := '{}';
  if jsonb_typeof(p_payload -> 'secrets') = 'array' then
    select coalesce(array_agg(distinct s), '{}')
      into v_secrets
      from jsonb_array_elements_text(p_payload -> 'secrets') as t(s)
     where s ~ '^[0-9]{1,3}-[0-9]{1,3}$';
  end if;

  update public.players p
     set total_deaths = greatest(
           p.total_deaths,
           case when jsonb_typeof(p_payload -> 'total_deaths') = 'number'
                then least(greatest(floor((p_payload ->> 'total_deaths')::numeric)::integer, 0), 100000000)
                else 0 end
         ),
         secrets = (
           select coalesce(array_agg(distinct x), '{}')
             from unnest(p.secrets || v_secrets) as u(x)
         ),
         updated_at = now()
   where p.id = v_player;

  return public.cb_state(v_player);
end;
$$;

-- ---------------------------------------------------------------------------
-- "Azzera progressi", per chi ha un account.
--
-- Senza questa, il menu mentirebbe: si cancella tutto in locale, alla prima
-- sincronizzazione il server rimanda indietro ogni record e il giocatore si
-- ritrova i progressi che aveva appena buttato via. L'account resta, la
-- classifica perde le sue righe: è quello che dice il menu, ed è irreversibile
-- come promette.
-- ---------------------------------------------------------------------------
create or replace function public.cb_reset(p_token text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid;
begin
  v_player := public.cb_session_player(p_token);
  if v_player is null then
    return json_build_object('ok', false, 'error', 'NO_SESSION');
  end if;

  delete from public.scores where player_id = v_player;

  update public.players
     set total_deaths = 0,
         secrets      = '{}',
         updated_at   = now()
   where id = v_player;

  return public.cb_state(v_player);
end;
$$;

-- ---------------------------------------------------------------------------
-- La classifica di un livello. Pubblica: si guarda anche senza account, ed è
-- giusto così — vedere i tempi degli altri è metà del motivo per farsene uno.
-- Escono solo nickname e numeri: nel database non c'è nient'altro da mostrare.
-- ---------------------------------------------------------------------------
create or replace function public.cb_leaderboard(p_level_id text, p_limit integer default 20)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(r), '[]'::json)
  from (
    select p.nickname,
           s.best_ms     as ms,
           s.best_deaths as deaths,
           s.best_coins  as coins
      from public.scores s
      join public.players p on p.id = s.player_id
     where s.level_id = p_level_id
     -- A parità di millesimo vince chi l'ha fatto prima: un ordinamento
     -- stabile, così la classifica non si rimescola da sola a ogni apertura.
     order by s.best_ms asc, s.updated_at asc
     limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ) r;
$$;

-- ---------------------------------------------------------------- permessi ---
-- Prima si toglie tutto a tutti, poi si concede una per una. Le funzioni
-- interne restano fuori dall'elenco: dal client non sono raggiungibili.

revoke all on function public.cb_hash_token(text)            from public, anon, authenticated;
revoke all on function public.cb_session_player(text)        from public, anon, authenticated;
revoke all on function public.cb_state(uuid)                 from public, anon, authenticated;
revoke all on function public.cb_open_session(uuid)          from public, anon, authenticated;
revoke all on function public.cb_register(text, text)        from public, anon, authenticated;
revoke all on function public.cb_login(text, text)           from public, anon, authenticated;
revoke all on function public.cb_logout(text)                from public, anon, authenticated;
revoke all on function public.cb_me(text)                    from public, anon, authenticated;
revoke all on function public.cb_sync(text, jsonb)           from public, anon, authenticated;
revoke all on function public.cb_reset(text)                 from public, anon, authenticated;
revoke all on function public.cb_leaderboard(text, integer)  from public, anon, authenticated;

grant execute on function public.cb_register(text, text)       to anon, authenticated;
grant execute on function public.cb_login(text, text)          to anon, authenticated;
grant execute on function public.cb_logout(text)               to anon, authenticated;
grant execute on function public.cb_me(text)                   to anon, authenticated;
grant execute on function public.cb_sync(text, jsonb)          to anon, authenticated;
grant execute on function public.cb_reset(text)                to anon, authenticated;
grant execute on function public.cb_leaderboard(text, integer) to anon, authenticated;
