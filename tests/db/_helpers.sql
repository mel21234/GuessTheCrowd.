-- Test helpers, installed only into throwaway test databases (schema "t").
create schema if not exists t;

create or replace function t.ok(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'FAIL: %', p_msg;
  end if;
  raise notice 'ok - %', p_msg;
end $$;

create or replace function t.eq(p_got anyelement, p_want anyelement, p_msg text) returns void
language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'FAIL: % (got %, want %)', p_msg, p_got, p_want;
  end if;
  raise notice 'ok - %', p_msg;
end $$;

-- Expect p_sql to raise an error whose message matches p_pattern (ILIKE).
create or replace function t.throws(p_sql text, p_pattern text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike p_pattern then
      raise notice 'ok - %', p_msg;
      return;
    end if;
    raise exception 'FAIL: % (wrong error: %)', p_msg, sqlerrm;
  end;
  raise exception 'FAIL: % (no error raised)', p_msg;
end $$;

create or replace function t.at(p_ts text) returns void
language plpgsql as $$ begin perform set_config('app.now', p_ts, true); end $$;

create or replace function t.launch(p_date date) returns void
language sql as $$
  update public.app_config set value = to_jsonb(p_date::text) where key = 'launch_date';
$$;

-- A question with reviewed translations in every active locale.
create or replace function t.mkq(p_key text, p_date date default null, p_ready boolean default true)
returns bigint language plpgsql as $$
declare v_id bigint;
begin
  insert into public.questions (status, scheduled_date, seed_key)
  values (case when p_date is null then 'draft' else 'scheduled' end, p_date, p_key)
  returning id into v_id;
  insert into public.question_translations (question_id, locale, text, reviewed)
  select v_id, code, p_key || ' (' || code || ')?', p_ready from public.app_locales where active;
  return v_id;
end $$;

-- Cast N yes and M no votes from random players.
create or replace function t.votes(p_q bigint, p_yes int, p_no int, p_locale text default 'en')
returns void language sql as $$
  insert into public.votes (question_id, player_id, answer, locale)
  select p_q, gen_random_uuid(), true,  p_locale from generate_series(1, p_yes)
  union all
  select p_q, gen_random_uuid(), false, p_locale from generate_series(1, p_no);
$$;

create or replace function t.admin() returns uuid
language sql as $$
  insert into public.admins (user_id, email)
  values ('00000000-0000-4000-8000-00000000a0a0', 'admin@test')
  on conflict do nothing;
  select '00000000-0000-4000-8000-00000000a0a0'::uuid;
$$;

create or replace function t.p(n int) returns uuid
language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
