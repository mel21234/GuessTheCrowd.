-- LOCAL DEVELOPMENT ONLY — generates SYNTHETIC votes so you can click through
-- the game on your own machine (e.g. after `supabase db reset`).
--
-- It refuses to run on any database that already contains votes, so it can
-- never mix invented numbers into a real project. Never run it in production.
--
--   psql "$LOCAL_DB_URL" -f supabase/dev/local-demo.sql

do $$
declare
  v_today date := public.utc_today();
  v_start date := v_today - 7;
  v_q     record;
  v_i     int := 0;
  v_n     int;
  v_yes   int;
begin
  if exists (select 1 from public.votes) then
    raise exception 'local-demo.sql refuses to run: this database already has votes.';
  end if;
  if not exists (select 1 from public.questions where seed_key is not null) then
    raise exception 'Load supabase/seed.sql first.';
  end if;

  perform setseed(0.42);
  update public.app_config set value = to_jsonb(v_start::text) where key = 'launch_date';
  update public.question_translations set reviewed = true, reviewed_at = now();

  for v_q in
    select id from public.questions where seed_key is not null and status = 'draft' order by id limit 22
  loop
    update public.questions
       set scheduled_date = v_start + v_i, status = 'scheduled'
     where id = v_q.id;

    if v_start + v_i <= v_today then
      -- day -3 deliberately gets too few votes to demo the fallback/archive gap
      v_n   := case when v_start + v_i = v_today - 3 then 12 else 150 + floor(random() * 900)::int end;
      v_yes := floor(v_n * (0.15 + random() * 0.7))::int;
      insert into public.votes (question_id, player_id, answer, locale, created_at)
      select v_q.id, gen_random_uuid(), g <= v_yes,
             (array['en', 'en', 'en', 'es', 'et'])[1 + floor(random() * 5)::int],
             ((v_start + v_i)::timestamp at time zone 'utc') + random() * interval '23 hours'
      from generate_series(1, v_n) g;
    end if;
    v_i := v_i + 1;
  end loop;

  perform public.close_due();
  raise notice 'Demo ready: launch date %, % days scheduled.', v_start, v_i;
end
$$;
