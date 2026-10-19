-- Row-level security and function permissions: browser roles can read nothing.
begin;

select t.launch('2026-04-01');
select t.mkq('s1', '2026-04-01');
select t.votes((select id from questions where seed_key = 's1'), 10, 5);

-- RLS is enabled on every table in public.
do $$
begin
  perform t.eq(
    (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
    0::bigint, 'RLS enabled on every public table');
end $$;

-- anon cannot select votes/results/questions, nor call any function.
do $$
declare
  v_tables text[] := array['votes', 'results', 'questions', 'question_translations',
                           'guesses', 'submissions', 'admins', 'rate_events', 'app_config'];
  v_t text;
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_t in array v_tables loop
      perform t.ok(not has_table_privilege(v_role, 'public.' || v_t, 'select'),
                   v_role || ' has no SELECT on ' || v_t);
      perform t.ok(not has_table_privilege(v_role, 'public.' || v_t, 'insert'),
                   v_role || ' has no INSERT on ' || v_t);
    end loop;
    perform t.ok(not has_function_privilege(v_role, 'public.get_puzzle(text, uuid, int)', 'execute'),
                 v_role || ' cannot execute get_puzzle');
    perform t.ok(not has_function_privilege(v_role,
                 'public.submit_vote(bigint, uuid, boolean, text, text, boolean, boolean)', 'execute'),
                 v_role || ' cannot execute submit_vote');
    perform t.ok(not has_function_privilege(v_role, 'public.result_payload(bigint)', 'execute'),
                 v_role || ' cannot execute result_payload');
    perform t.ok(not has_function_privilege(v_role, 'public.admin_dashboard(uuid, date, int)', 'execute'),
                 v_role || ' cannot execute admin_dashboard');
  end loop;

  perform t.ok(has_function_privilege('service_role', 'public.get_puzzle(text, uuid, int)', 'execute'),
               'service_role can execute get_puzzle');
end $$;

-- Even with a table grant, RLS (no policies) returns zero rows to anon.
grant select on public.votes to anon;
set local role anon;
select count(*) as anon_votes from public.votes \gset
reset role;
select t.eq(:anon_votes::bigint, 0::bigint, 'anon sees zero votes even with a grant (RLS)');
select t.ok((select count(*) from public.votes) = 15, 'superuser sees the 15 votes');

-- Direct attempts as anon fail.
set local role anon;
do $$
begin
  begin
    perform public.get_today('en', null);
    raise exception 'FAIL: anon executed get_today';
  exception when insufficient_privilege then
    raise notice 'ok - anon get_today denied';
  end;
end $$;
reset role;

-- Every SECURITY DEFINER function pins its search_path.
select t.eq(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0::bigint, 'all security definer functions set search_path');

-- Time travel is ignored unless explicitly allowed on the database.
do $$
begin
  perform set_config('app.allow_time_travel', 'off', true);
  perform set_config('app.now', '2000-01-01 00:00:00+00', true);
  perform t.ok(app_now() > '2020-01-01'::timestamptz, 'app.now ignored when time travel is off');
  perform set_config('app.allow_time_travel', 'on', true);
end $$;

rollback;
