-- Guess the Crowd: schema, indexes and row-level security.
--
-- Design notes
-- * Browsers never talk to these tables. Every read and write goes through the
--   Next.js server, which calls SECURITY DEFINER functions with the service-role
--   key. RLS is enabled on every table with NO policies for anon/authenticated,
--   so even a leaked anon key cannot read a single vote or result.
-- * A question's "day" is its scheduled_date in UTC. Puzzle number =
--   scheduled_date - launch_date + 1, identical for every player on Earth.

-- ---------------------------------------------------------------------------
-- Configuration
-- ---------------------------------------------------------------------------

create table public.app_locales (
  code   text primary key check (code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  name   text not null,
  active boolean not null default true,
  sort   smallint not null default 0
);

insert into public.app_locales (code, name, sort) values
  ('en', 'English', 0),
  ('et', 'Eesti', 1),
  ('es', 'Español', 2);

create table public.app_config (
  key   text primary key,
  value jsonb not null
);

insert into public.app_config (key, value) values
  -- Puzzle #1 is the question scheduled on this date. Change it before launch:
  --   update app_config set value = '"2026-11-01"' where key = 'launch_date';
  ('launch_date',              to_jsonb(((now() at time zone 'utc')::date)::text)),
  ('breakdown_min_votes',      '50'),   -- per-language "Yes %" shown only above this
  ('vote_hourly_limit',        '600'),  -- hard cap per IP hash per hour (CGNAT-friendly)
  ('vote_challenge_threshold', '60'),   -- above this, require Turnstile (if configured)
  ('guess_hourly_limit',       '3000'),
  ('suggest_hourly_limit',     '5');

-- ---------------------------------------------------------------------------
-- Questions
-- ---------------------------------------------------------------------------

create table public.questions (
  id             bigint generated always as identity primary key,
  status         text not null default 'draft'
                 check (status in ('draft', 'scheduled', 'live', 'closed', 'void')),
  scheduled_date date,
  created_at     timestamptz not null default now(),
  source         text not null default 'seed'
                 check (source in ('seed', 'community', 'survey')),
  min_votes      int not null default 100 check (min_votes >= 1),
  seed_key       text unique,
  constraint questions_dated_status
    check (status in ('draft', 'void') or scheduled_date is not null),
  constraint questions_draft_undated
    check (status <> 'draft' or scheduled_date is null)
);

-- One question per UTC day (voided questions free their day).
create unique index questions_one_per_day
  on public.questions (scheduled_date)
  where status <> 'void';

create index questions_status_date on public.questions (status, scheduled_date);

create table public.question_translations (
  question_id bigint not null references public.questions (id) on delete cascade,
  locale      text not null references public.app_locales (code),
  text        text not null check (char_length(btrim(text)) between 3 and 200),
  reviewed    boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (question_id, locale)
);

-- ---------------------------------------------------------------------------
-- Votes (today's question) and results (closed questions)
-- ---------------------------------------------------------------------------

create table public.votes (
  id          bigint generated always as identity primary key,
  question_id bigint not null references public.questions (id) on delete cascade,
  player_id   uuid not null,
  answer      boolean not null,
  locale      text not null references public.app_locales (code),
  created_at  timestamptz not null default now(),
  constraint votes_one_per_player unique (question_id, player_id)
);

create index votes_question_created on public.votes (question_id, created_at);

create table public.results (
  question_id bigint primary key references public.questions (id) on delete cascade,
  yes_count   int not null,
  no_count    int not null,
  total       int not null,
  yes_pct     numeric(5, 2),           -- null when nobody voted
  per_locale  jsonb not null default '{}'::jsonb,  -- {"en": {"yes": 10, "total": 20}, ...}
  closed_at   timestamptz not null default now(),
  seeded      boolean not null default false,       -- true only for a cited external survey
  source_url  text,
  constraint results_seeded_has_source check (not seeded or source_url is not null)
);

-- ---------------------------------------------------------------------------
-- Guesses (one row per player per puzzle, up to three attempts)
-- ---------------------------------------------------------------------------

create table public.guesses (
  id          bigint generated always as identity primary key,
  question_id bigint not null references public.questions (id) on delete cascade,
  player_id   uuid not null,
  locale      text references public.app_locales (code),
  guess_1     smallint check (guess_1 between 0 and 100),
  guess_2     smallint check (guess_2 between 0 and 100),
  guess_3     smallint check (guess_3 between 0 and 100),
  finished    boolean not null default false,
  final_error smallint,
  solved_in   smallint check (solved_in between 1 and 3),  -- null = X (not solved)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint guesses_one_per_player unique (question_id, player_id)
);

create index guesses_question_finished on public.guesses (question_id) where finished;

-- ---------------------------------------------------------------------------
-- Community submissions
-- ---------------------------------------------------------------------------

create table public.submissions (
  id          bigint generated always as identity primary key,
  text        text not null check (char_length(btrim(text)) between 8 and 120),
  locale      text not null references public.app_locales (code),
  nickname    text check (nickname is null or char_length(nickname) <= 30),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  question_id bigint references public.questions (id) on delete set null,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

create index submissions_status_created on public.submissions (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Rate limiting: salted, daily-rotated IP hashes only. Purged after 2 days.
-- ---------------------------------------------------------------------------

create table public.rate_events (
  ip_hash    text not null,
  action     text not null check (action in ('vote', 'guess', 'suggest')),
  created_at timestamptz not null default now()
);

create index rate_events_lookup on public.rate_events (ip_hash, action, created_at);

-- ---------------------------------------------------------------------------
-- Admins (Supabase Auth user ids). Add one with:
--   insert into admins (user_id, email) values ('<auth user uuid>', 'you@example.com');
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id    uuid primary key,
  email      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security: on everywhere, no policies for browser roles.
-- ---------------------------------------------------------------------------

alter table public.app_locales           enable row level security;
alter table public.app_config            enable row level security;
alter table public.questions             enable row level security;
alter table public.question_translations enable row level security;
alter table public.votes                 enable row level security;
alter table public.results               enable row level security;
alter table public.guesses               enable row level security;
alter table public.submissions           enable row level security;
alter table public.rate_events           enable row level security;
alter table public.admins                enable row level security;

-- Belt and braces: also remove table privileges Supabase grants by default.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
