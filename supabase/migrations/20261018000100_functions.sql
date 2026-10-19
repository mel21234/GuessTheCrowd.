-- Guess the Crowd: game logic as SQL functions.
--
-- All functions are SECURITY DEFINER with a fixed search_path and are only
-- executable by service_role (the Next.js server). They are the single source
-- of truth for: which question is live, closing a day, scoring guesses and
-- deciding WHEN an answer may be revealed.

-- ---------------------------------------------------------------------------
-- Time helpers
-- ---------------------------------------------------------------------------

-- Current time. Tests can travel in time with `set app.now = '...'`, but only
-- on a database where `app.allow_time_travel = 'on'` (never set in production).
create or replace function public.app_now()
returns timestamptz
language sql stable
set search_path = public, pg_temp
as $$
  select case
    when coalesce(current_setting('app.allow_time_travel', true), '') = 'on'
     and coalesce(current_setting('app.now', true), '') <> ''
    then current_setting('app.now', true)::timestamptz
    else now()
  end
$$;

create or replace function public.utc_today()
returns date
language sql stable
set search_path = public, pg_temp
as $$ select (public.app_now() at time zone 'utc')::date $$;

create or replace function public.config_int(p_key text)
returns int
language sql stable
set search_path = public, pg_temp
as $$ select (value #>> '{}')::int from public.app_config where key = p_key $$;

create or replace function public.launch_date()
returns date
language sql stable
set search_path = public, pg_temp
as $$ select (value #>> '{}')::date from public.app_config where key = 'launch_date' $$;

create or replace function public.puzzle_number(p_date date)
returns int
language sql stable
set search_path = public, pg_temp
as $$ select (p_date - public.launch_date()) + 1 $$;

create or replace function public.normalize_locale(p_locale text)
returns text
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select code from public.app_locales where code = p_locale and active),
    'en')
$$;

create or replace function public.question_text(p_question_id bigint, p_locale text)
returns text
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select text from public.question_translations
      where question_id = p_question_id and locale = p_locale),
    (select text from public.question_translations
      where question_id = p_question_id and locale = 'en'),
    (select text from public.question_translations
      where question_id = p_question_id order by locale limit 1))
$$;

-- A question may be scheduled only when every active locale has a reviewed translation.
create or replace function public.question_ready(p_question_id bigint)
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.app_locales l
    where l.active
      and not exists (
        select 1 from public.question_translations t
        where t.question_id = p_question_id and t.locale = l.code and t.reviewed))
$$;

-- ---------------------------------------------------------------------------
-- Scoring (mirrors src/lib/scoring.ts; both are unit-tested)
-- ---------------------------------------------------------------------------

create or replace function public.tile_color(p_guess int, p_answer int)
returns text
language sql immutable
as $$
  select case
    when abs(p_guess - p_answer) <= 3  then 'correct'
    when abs(p_guess - p_answer) <= 10 then 'close'
    else 'miss'
  end
$$;

create or replace function public.tile_direction(p_guess int, p_answer int)
returns text
language sql immutable
as $$
  select case
    when abs(p_guess - p_answer) <= 3 then 'none'
    when p_answer > p_guess then 'up'
    else 'down'
  end
$$;

-- ---------------------------------------------------------------------------
-- Closing days
-- ---------------------------------------------------------------------------

create or replace function public.close_question(p_question_id bigint)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.results (question_id, yes_count, no_count, total, yes_pct, per_locale, closed_at)
  select
    p_question_id,
    count(*) filter (where v.answer),
    count(*) filter (where not v.answer),
    count(*),
    case when count(*) > 0
         then round(100.0 * count(*) filter (where v.answer) / count(*), 2)
    end,
    coalesce((
      select jsonb_object_agg(s.locale, jsonb_build_object('yes', s.yes, 'total', s.total))
      from (
        select locale,
               count(*) filter (where answer) as yes,
               count(*) as total
        from public.votes
        where question_id = p_question_id
        group by locale
      ) s), '{}'::jsonb),
    public.app_now()
  from public.votes v
  where v.question_id = p_question_id
  on conflict (question_id) do nothing;   -- never overwrite a seeded/closed result

  update public.questions set status = 'closed' where id = p_question_id;
end
$$;

-- Closes every past day that is still open and marks today's question live.
-- Called by the midnight cron AND lazily by every read, so a late or missed
-- cron run can never show a stale puzzle.
create or replace function public.close_due()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_today  date := public.utc_today();
  v_closed int  := 0;
  v_q      record;
begin
  if not exists (
    select 1 from public.questions
    where (status in ('scheduled', 'live') and scheduled_date < v_today)
       or (status = 'scheduled' and scheduled_date = v_today)
  ) then
    return jsonb_build_object('closed', 0);
  end if;

  -- Serialize concurrent closers; re-check inside the lock.
  perform pg_advisory_xact_lock(hashtext('guess-the-crowd:close_due'));

  for v_q in
    select id from public.questions
    where status in ('scheduled', 'live') and scheduled_date < v_today
    order by scheduled_date
    for update
  loop
    perform public.close_question(v_q.id);
    v_closed := v_closed + 1;
  end loop;

  update public.questions
     set status = 'live'
   where status = 'scheduled' and scheduled_date = v_today;

  delete from public.rate_events where created_at < public.app_now() - interval '2 days';

  return jsonb_build_object('closed', v_closed);
end
$$;

-- A closed question is playable when it got enough votes (or carries a cited survey result).
create or replace function public.is_playable(p_question_id bigint)
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.questions q
    join public.results r on r.question_id = q.id
    where q.id = p_question_id
      and q.status = 'closed'
      and r.yes_pct is not null
      and (r.seeded or r.total >= q.min_votes))
$$;

-- The daily puzzle shown on UTC day p_day: yesterday's question if it
-- qualifies, otherwise the most recent qualifying closed question.
create or replace function public.daily_question_for(p_day date)
returns bigint
language sql stable
set search_path = public, pg_temp
as $$
  select q.id
  from public.questions q
  join public.results r on r.question_id = q.id
  where q.status = 'closed'
    and q.scheduled_date < p_day
    and r.yes_pct is not null
    and (r.seeded or r.total >= q.min_votes)
  order by q.scheduled_date desc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Game state and the result payload (the payload is only ever built for a
-- player whose game is finished)
-- ---------------------------------------------------------------------------

create or replace function public.result_payload(p_question_id bigint)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_r          public.results;
  v_answer     int;
  v_hist       int[] := array_fill(0, array[20]);
  v_finished   int;
  v_within3    int;
  v_breakdown  jsonb;
  v_min_bd     int := coalesce(public.config_int('breakdown_min_votes'), 50);
  v_row        record;
begin
  select * into v_r from public.results where question_id = p_question_id;
  v_answer := round(v_r.yes_pct)::int;

  for v_row in
    select least(coalesce(g.guess_3, g.guess_2, g.guess_1) / 5, 19) as bucket, count(*) as n
    from public.guesses g
    where g.question_id = p_question_id and g.finished
    group by 1
  loop
    v_hist[v_row.bucket + 1] := v_row.n;
  end loop;

  select count(*), count(*) filter (where final_error <= 3)
    into v_finished, v_within3
  from public.guesses
  where question_id = p_question_id and finished;

  select coalesce(jsonb_agg(jsonb_build_object(
           'locale', key,
           'total', (value ->> 'total')::int,
           'yesPct', round(100.0 * (value ->> 'yes')::int / nullif((value ->> 'total')::int, 0), 1))
           order by (value ->> 'total')::int desc), '[]'::jsonb)
    into v_breakdown
  from jsonb_each(v_r.per_locale)
  where (value ->> 'total')::int >= v_min_bd;

  return jsonb_build_object(
    'yesPct',        v_r.yes_pct,
    'answer',        v_answer,
    'total',         v_r.total,
    'seeded',        v_r.seeded,
    'sourceUrl',     v_r.source_url,
    'histogram',     to_jsonb(v_hist),
    'finishedCount', v_finished,
    'within3Count',  v_within3,
    'perLocale',     v_breakdown,
    'breakdownMin',  v_min_bd
  );
end
$$;

create or replace function public.game_state(p_question_id bigint, p_player uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_g       public.guesses;
  v_answer  int;
  v_list    jsonb := '[]'::jsonb;
  v_val     int;
begin
  select * into v_g from public.guesses
   where question_id = p_question_id and player_id = p_player;

  if not found then
    return jsonb_build_object('guesses', '[]'::jsonb, 'finished', false);
  end if;

  select round(yes_pct)::int into v_answer from public.results where question_id = p_question_id;

  foreach v_val in array array_remove(array[v_g.guess_1, v_g.guess_2, v_g.guess_3]::int[], null)
  loop
    v_list := v_list || jsonb_build_object(
      'value',     v_val,
      'color',     public.tile_color(v_val, v_answer),
      'direction', public.tile_direction(v_val, v_answer));
  end loop;

  return jsonb_build_object(
    'guesses',    v_list,
    'finished',   v_g.finished,
    'solvedIn',   v_g.solved_in,
    'finalError', case when v_g.finished then v_g.final_error end,
    'result',     case when v_g.finished then public.result_payload(p_question_id) end
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting helper (returns the number of events in the last hour BEFORE
-- recording this one)
-- ---------------------------------------------------------------------------

create or replace function public.rate_count(p_ip_hash text, p_action text)
returns int
language sql stable security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from public.rate_events
  where ip_hash = p_ip_hash and action = p_action
    and created_at > public.app_now() - interval '1 hour'
$$;

-- ---------------------------------------------------------------------------
-- Public API (called by Next.js route handlers)
-- ---------------------------------------------------------------------------

-- Today's question: text only. Never counts, never percentages.
create or replace function public.get_today(p_locale text, p_player uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_locale text := public.normalize_locale(p_locale);
  v_today  date;
  v_q      public.questions;
  v_answer boolean;
begin
  perform public.close_due();
  v_today := public.utc_today();

  select * into v_q from public.questions
   where scheduled_date = v_today and status = 'live';

  if found and p_player is not null then
    select answer into v_answer from public.votes
     where question_id = v_q.id and player_id = p_player;
  end if;

  return jsonb_build_object(
    'today',    v_today,
    'closesAt', to_char(((v_today + 1)::timestamp at time zone 'utc') at time zone 'utc',
                        'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'question', case when v_q.id is null then null else jsonb_build_object(
                  'id',     v_q.id,
                  'number', public.puzzle_number(v_q.scheduled_date),
                  'date',   v_q.scheduled_date,
                  'text',   public.question_text(v_q.id, v_locale)) end,
    'myVote',   v_answer
  );
end
$$;

-- The puzzle (question text + this player's progress). The real result is
-- included only inside game.result, which exists only once the game is finished.
create or replace function public.get_puzzle(p_locale text, p_player uuid, p_number int default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_locale     text := public.normalize_locale(p_locale);
  v_today      date;
  v_daily      bigint;
  v_prev_daily bigint;
  v_qid        bigint;
  v_q          public.questions;
  v_yday       public.questions;
  v_yday_total int;
  v_fallback   jsonb;
  v_daily_date date;
begin
  perform public.close_due();
  v_today      := public.utc_today();
  v_daily      := public.daily_question_for(v_today);
  v_prev_daily := public.daily_question_for(v_today - 1);
  select scheduled_date into v_daily_date from public.questions where id = v_daily;

  if p_number is null then
    v_qid := v_daily;
  else
    select q.id into v_qid
      from public.questions q
     where q.scheduled_date = public.launch_date() + (p_number - 1)
       and q.status = 'closed'
       and q.scheduled_date <= v_daily_date
       and public.is_playable(q.id);
  end if;

  if v_qid is null then
    return jsonb_build_object(
      'status', case when p_number is null then 'launch' else 'not_found' end,
      'today',  v_today);
  end if;

  select * into v_q from public.questions where id = v_qid;

  -- Explain plainly when the daily puzzle is not yesterday's question.
  if v_qid = v_daily and v_q.scheduled_date <> v_today - 1 then
    select * into v_yday from public.questions
     where scheduled_date = v_today - 1 and status <> 'void';
    if found then
      select total into v_yday_total from public.results where question_id = v_yday.id;
      v_fallback := jsonb_build_object(
        'reason', 'too_few_votes',
        'votes',  coalesce(v_yday_total, 0),
        'needed', v_yday.min_votes);
    else
      v_fallback := jsonb_build_object('reason', 'no_question');
    end if;
  end if;

  return jsonb_build_object(
    'status',  'ok',
    'today',   v_today,
    'mode',    case when v_qid = v_daily then 'daily' else 'archive' end,
    'puzzle',  jsonb_build_object(
                 'id',     v_q.id,
                 'number', public.puzzle_number(v_q.scheduled_date),
                 'date',   v_q.scheduled_date,
                 'text',   public.question_text(v_q.id, v_locale)),
    'dailyNumber',     (select public.puzzle_number(scheduled_date) from public.questions where id = v_daily),
    'prevDailyNumber', (select public.puzzle_number(scheduled_date) from public.questions where id = v_prev_daily),
    'fallback', v_fallback,
    'game',     public.game_state(v_q.id, p_player)
  );
end
$$;

create or replace function public.submit_vote(
  p_question_id       bigint,
  p_player            uuid,
  p_answer            boolean,
  p_locale            text,
  p_ip_hash           text,
  p_verified          boolean default false,
  p_challenge_enabled boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_recent int;
begin
  perform public.close_due();

  if not exists (
    select 1 from public.questions
    where id = p_question_id and status = 'live' and scheduled_date = public.utc_today()
  ) then
    return jsonb_build_object('status', 'closed');
  end if;

  if exists (select 1 from public.votes where question_id = p_question_id and player_id = p_player) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  if p_ip_hash is not null then
    v_recent := public.rate_count(p_ip_hash, 'vote');
    if v_recent >= coalesce(public.config_int('vote_hourly_limit'), 600) then
      return jsonb_build_object('status', 'rate_limited');
    end if;
    if p_challenge_enabled and not p_verified
       and v_recent >= coalesce(public.config_int('vote_challenge_threshold'), 60) then
      return jsonb_build_object('status', 'challenge_required');
    end if;
    insert into public.rate_events (ip_hash, action, created_at)
    values (p_ip_hash, 'vote', public.app_now());
  end if;

  insert into public.votes (question_id, player_id, answer, locale, created_at)
  values (p_question_id, p_player, p_answer, public.normalize_locale(p_locale), public.app_now())
  on conflict on constraint votes_one_per_player do nothing;

  if not found then
    return jsonb_build_object('status', 'duplicate');
  end if;
  return jsonb_build_object('status', 'ok');
end
$$;

create or replace function public.submit_guess(
  p_question_id bigint,
  p_player      uuid,
  p_value       int,
  p_locale      text,
  p_ip_hash     text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_g      public.guesses;
  v_answer int;
  v_n      int;
  v_err    int;
begin
  perform public.close_due();

  if p_value is null or p_value < 0 or p_value > 100 then
    return jsonb_build_object('status', 'invalid');
  end if;

  if not public.is_playable(p_question_id)
     or (select scheduled_date from public.questions where id = p_question_id)
        > (select scheduled_date from public.questions
            where id = public.daily_question_for(public.utc_today())) then
    return jsonb_build_object('status', 'not_playable');
  end if;

  if p_ip_hash is not null then
    if public.rate_count(p_ip_hash, 'guess') >= coalesce(public.config_int('guess_hourly_limit'), 3000) then
      return jsonb_build_object('status', 'rate_limited');
    end if;
    insert into public.rate_events (ip_hash, action, created_at)
    values (p_ip_hash, 'guess', public.app_now());
  end if;

  insert into public.guesses (question_id, player_id, locale)
  values (p_question_id, p_player, public.normalize_locale(p_locale))
  on conflict on constraint guesses_one_per_player do nothing;

  select * into v_g from public.guesses
   where question_id = p_question_id and player_id = p_player
   for update;

  if v_g.finished then
    return jsonb_build_object('status', 'finished', 'game', public.game_state(p_question_id, p_player));
  end if;

  if p_value in (v_g.guess_1, v_g.guess_2) then
    return jsonb_build_object('status', 'repeated', 'game', public.game_state(p_question_id, p_player));
  end if;

  select round(yes_pct)::int into v_answer from public.results where question_id = p_question_id;
  v_n   := case when v_g.guess_1 is null then 1 when v_g.guess_2 is null then 2 else 3 end;
  v_err := abs(p_value - v_answer);

  update public.guesses set
    guess_1     = case when v_n = 1 then p_value else guess_1 end,
    guess_2     = case when v_n = 2 then p_value else guess_2 end,
    guess_3     = case when v_n = 3 then p_value else guess_3 end,
    finished    = (v_err <= 3 or v_n = 3),
    final_error = case when v_err <= 3 or v_n = 3 then v_err end,
    solved_in   = case when v_err <= 3 then v_n end,
    updated_at  = public.app_now()
  where id = v_g.id;

  return jsonb_build_object('status', 'ok', 'game', public.game_state(p_question_id, p_player));
end
$$;

-- Past puzzles, newest first. Never includes the current daily puzzle or anything newer.
create or replace function public.get_archive(
  p_locale text, p_player uuid, p_before int default null, p_limit int default 30)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_locale     text := public.normalize_locale(p_locale);
  v_daily_date date;
  v_limit      int := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_items      jsonb;
  v_more       boolean;
begin
  perform public.close_due();
  select scheduled_date into v_daily_date
    from public.questions where id = public.daily_question_for(public.utc_today());

  if v_daily_date is null then
    return jsonb_build_object('items', '[]'::jsonb, 'hasMore', false);
  end if;

  with candidates as (
    select q.id, q.scheduled_date, r.yes_pct, r.total
    from public.questions q
    join public.results r on r.question_id = q.id
    where q.status = 'closed'
      and q.scheduled_date < v_daily_date
      and (p_before is null or q.scheduled_date < public.launch_date() + (p_before - 1))
      and r.yes_pct is not null
      and (r.seeded or r.total >= q.min_votes)
    order by q.scheduled_date desc
    limit v_limit + 1
  ), page as (
    select * from candidates order by scheduled_date desc limit v_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'number',     public.puzzle_number(p.scheduled_date),
      'date',       p.scheduled_date,
      'text',       public.question_text(p.id, v_locale),
      'yesPct',     p.yes_pct,
      'answer',     round(p.yes_pct)::int,
      'total',      p.total,
      'played',     coalesce(g.finished, false),
      'solvedIn',   g.solved_in,
      'finalError', g.final_error
    ) order by p.scheduled_date desc), '[]'::jsonb),
    (select count(*) > v_limit from candidates)
  into v_items, v_more
  from page p
  left join public.guesses g on g.question_id = p.id and g.player_id = p_player and g.finished;

  return jsonb_build_object('items', v_items, 'hasMore', v_more);
end
$$;

create or replace function public.submit_suggestion(
  p_text text, p_locale text, p_nickname text, p_ip_hash text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_ip_hash is not null then
    if public.rate_count(p_ip_hash, 'suggest') >= coalesce(public.config_int('suggest_hourly_limit'), 5) then
      return jsonb_build_object('status', 'rate_limited');
    end if;
    insert into public.rate_events (ip_hash, action, created_at)
    values (p_ip_hash, 'suggest', public.app_now());
  end if;

  insert into public.submissions (text, locale, nickname, created_at)
  values (btrim(p_text), public.normalize_locale(p_locale), nullif(btrim(p_nickname), ''), public.app_now());

  return jsonb_build_object('status', 'ok');
end
$$;

-- Optional: seed the launch-day puzzle (#0) from a real, cited public survey.
-- Run from the SQL editor. Never invent numbers.
create or replace function public.seed_launch_puzzle(
  p_question_id bigint, p_yes_count int, p_no_count int, p_source_url text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_source_url is null or p_source_url !~ '^https?://' then
    raise exception 'source_url_required';
  end if;
  if p_yes_count < 0 or p_no_count < 0 or p_yes_count + p_no_count = 0 then
    raise exception 'invalid_counts';
  end if;
  if not public.question_ready(p_question_id) then
    raise exception 'not_ready';
  end if;

  update public.questions
     set status = 'closed', scheduled_date = public.launch_date() - 1, source = 'survey'
   where id = p_question_id;

  insert into public.results (question_id, yes_count, no_count, total, yes_pct, closed_at, seeded, source_url)
  values (p_question_id, p_yes_count, p_no_count, p_yes_count + p_no_count,
          round(100.0 * p_yes_count / (p_yes_count + p_no_count), 2), public.app_now(), true, p_source_url);
end
$$;

-- Called by the cron route.
create or replace function public.run_daily_close()
returns jsonb
language sql security definer
set search_path = public, pg_temp
as $$ select public.close_due() || jsonb_build_object('today', public.utc_today()) $$;
