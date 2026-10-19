-- Guess the Crowd: admin functions. Every function takes the admin's Supabase
-- Auth user id (verified by the Next.js server from the access token) and
-- re-checks it against the admins table.

create or replace function public.is_admin(p_user uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select exists (select 1 from public.admins where user_id = p_user) $$;

create or replace function public.assert_admin(p_user uuid)
returns void
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null or not public.is_admin(p_user) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end
$$;

create or replace function public.admin_question_json(p_question_id bigint)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id',           q.id,
    'status',       q.status,
    'date',         q.scheduled_date,
    'number',       case when q.scheduled_date is not null then public.puzzle_number(q.scheduled_date) end,
    'source',       q.source,
    'minVotes',     q.min_votes,
    'ready',        public.question_ready(q.id),
    'createdAt',    q.created_at,
    'translations', coalesce((
       select jsonb_object_agg(t.locale, jsonb_build_object(
                'text', t.text, 'reviewed', t.reviewed, 'reviewedAt', t.reviewed_at))
       from public.question_translations t where t.question_id = q.id), '{}'::jsonb),
    'votes',        (select count(*) from public.votes v where v.question_id = q.id),
    'result',       (select jsonb_build_object('yesPct', r.yes_pct, 'total', r.total, 'seeded', r.seeded)
                     from public.results r where r.question_id = q.id)
  )
  from public.questions q
  where q.id = p_question_id
$$;

-- Calendar + warnings.
create or replace function public.admin_dashboard(p_admin uuid, p_from date, p_days int default 42)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_today date;
  v_days  int := least(greatest(coalesce(p_days, 42), 1), 120);
begin
  perform public.assert_admin(p_admin);
  perform public.close_due();
  v_today := public.utc_today();

  return jsonb_build_object(
    'today',      v_today,
    'launchDate', public.launch_date(),
    'locales',    (select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'active', active) order by sort)
                   from public.app_locales),
    'scheduledAhead', (select count(*) from public.questions
                       where status in ('scheduled', 'live')
                         and scheduled_date between v_today and v_today + 13),
    'firstGap',   (select min(d)::date
                   from generate_series(v_today, v_today + 365, interval '1 day') d
                   where not exists (select 1 from public.questions q
                                     where q.scheduled_date = d::date and q.status <> 'void')),
    'pendingSubmissions', (select count(*) from public.submissions where status = 'pending'),
    'calendar', (
      select jsonb_agg(jsonb_build_object(
               'date', d::date,
               'question', (select public.admin_question_json(q.id)
                            from public.questions q
                            where q.scheduled_date = d::date
                            order by (q.status = 'void'), q.id
                            limit 1))
             order by d)
      from generate_series(p_from, p_from + (v_days - 1), interval '1 day') d)
  );
end
$$;

create or replace function public.admin_questions(p_admin uuid, p_status text default null, p_search text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin(p_admin);
  return coalesce((
    select jsonb_agg(public.admin_question_json(q.id)
                     order by q.scheduled_date desc nulls first, q.id desc)
    from (
      select q.id, q.scheduled_date
      from public.questions q
      where (p_status is null or q.status = p_status)
        and (p_search is null or p_search = '' or exists (
              select 1 from public.question_translations t
              where t.question_id = q.id and t.text ilike '%' || p_search || '%'))
      order by q.scheduled_date desc nulls first, q.id desc
      limit 500
    ) q), '[]'::jsonb);
end
$$;

-- Create or edit a question. p_translations: {"en": {"text": "...", "reviewed": true}, ...}
-- An empty text removes that translation.
create or replace function public.admin_save_question(
  p_admin uuid, p_id bigint, p_translations jsonb, p_min_votes int default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_q    public.questions;
  v_id   bigint := p_id;
  v_loc  text;
  v_val  jsonb;
  v_text text;
  v_rev  boolean;
begin
  perform public.assert_admin(p_admin);
  perform public.close_due();

  if v_id is null then
    insert into public.questions (status, source, min_votes)
    values ('draft', 'seed', coalesce(p_min_votes, 100))
    returning id into v_id;
  else
    select * into v_q from public.questions where id = v_id for update;
    if not found then raise exception 'not_found'; end if;
    if v_q.status not in ('draft', 'scheduled') then
      raise exception 'locked';   -- live/closed questions are never reworded; void them instead
    end if;
    if p_min_votes is not null then
      update public.questions set min_votes = p_min_votes where id = v_id;
    end if;
  end if;

  for v_loc, v_val in select key, value from jsonb_each(coalesce(p_translations, '{}'::jsonb)) loop
    if not exists (select 1 from public.app_locales where code = v_loc) then
      raise exception 'unknown_locale';
    end if;
    v_text := btrim(coalesce(v_val ->> 'text', ''));
    v_rev  := coalesce((v_val ->> 'reviewed')::boolean, false);
    if v_text = '' then
      delete from public.question_translations where question_id = v_id and locale = v_loc;
    else
      insert into public.question_translations (question_id, locale, text, reviewed, reviewed_by, reviewed_at, updated_at)
      values (v_id, v_loc, v_text, v_rev,
              case when v_rev then p_admin end,
              case when v_rev then public.app_now() end,
              public.app_now())
      on conflict (question_id, locale) do update set
        text        = excluded.text,
        reviewed    = excluded.reviewed,
        reviewed_by = case when excluded.reviewed and not question_translations.reviewed
                           then excluded.reviewed_by
                           when excluded.reviewed then question_translations.reviewed_by end,
        reviewed_at = case when excluded.reviewed and not question_translations.reviewed
                           then excluded.reviewed_at
                           when excluded.reviewed then question_translations.reviewed_at end,
        updated_at  = excluded.updated_at;
    end if;
  end loop;

  if (select status from public.questions where id = v_id) = 'scheduled'
     and not public.question_ready(v_id) then
    raise exception 'not_ready';   -- scheduled questions must stay fully reviewed
  end if;

  if not exists (select 1 from public.question_translations where question_id = v_id) then
    raise exception 'empty_question';
  end if;

  return public.admin_question_json(v_id);
end
$$;

-- Schedule (or move) a question to a UTC date. Moving onto another future
-- scheduled question swaps them.
create or replace function public.admin_schedule(p_admin uuid, p_id bigint, p_date date)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_today date;
  v_q     public.questions;
  v_other public.questions;
begin
  perform public.assert_admin(p_admin);
  perform public.close_due();
  v_today := public.utc_today();

  select * into v_q from public.questions where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_date is null or p_date < v_today then raise exception 'date_in_past'; end if;
  if v_q.status not in ('draft', 'scheduled') then raise exception 'locked'; end if;
  if v_q.status = 'scheduled' and v_q.scheduled_date <= v_today then raise exception 'locked'; end if;
  if not public.question_ready(p_id) then raise exception 'not_ready'; end if;

  select * into v_other from public.questions
   where scheduled_date = p_date and status <> 'void' and id <> p_id
   for update;

  if found then
    if v_q.status = 'scheduled' and v_other.status = 'scheduled' and v_other.scheduled_date > v_today then
      -- swap
      update public.questions set status = 'draft', scheduled_date = null where id = v_other.id;
      update public.questions set scheduled_date = p_date where id = p_id;
      update public.questions set status = 'scheduled', scheduled_date = v_q.scheduled_date where id = v_other.id;
    else
      raise exception 'date_taken';
    end if;
  else
    update public.questions
       set scheduled_date = p_date,
           status = case when p_date = v_today then 'live' else 'scheduled' end
     where id = p_id;
  end if;

  return public.admin_question_json(p_id);
end
$$;

create or replace function public.admin_unschedule(p_admin uuid, p_id bigint)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin(p_admin);
  perform public.close_due();
  update public.questions set status = 'draft', scheduled_date = null
   where id = p_id and status = 'scheduled' and scheduled_date > public.utc_today();
  if not found then raise exception 'locked'; end if;
  return public.admin_question_json(p_id);
end
$$;

-- Void a badly worded question: it is never shown as a puzzle and voting stops.
create or replace function public.admin_void(p_admin uuid, p_id bigint)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin(p_admin);
  update public.questions set status = 'void' where id = p_id and status <> 'void';
  if not found then raise exception 'not_found'; end if;
  return public.admin_question_json(p_id);
end
$$;

create or replace function public.admin_delete(p_admin uuid, p_id bigint)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin(p_admin);
  if exists (select 1 from public.votes where question_id = p_id) then
    raise exception 'has_votes';
  end if;
  delete from public.questions
   where id = p_id
     and (status in ('draft', 'void')
          or (status = 'scheduled' and scheduled_date > public.utc_today()));
  if not found then raise exception 'locked'; end if;
  return jsonb_build_object('deleted', p_id);
end
$$;

-- Live numbers for one question, straight from the database.
create or replace function public.admin_question_stats(p_admin uuid, p_id bigint)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_total int;
  v_yes   int;
begin
  perform public.assert_admin(p_admin);
  select count(*), count(*) filter (where answer) into v_total, v_yes
    from public.votes where question_id = p_id;

  return jsonb_build_object(
    'question', public.admin_question_json(p_id),
    'votes',    v_total,
    'yesPct',   case when v_total > 0 then round(100.0 * v_yes / v_total, 2) end,
    'perLocale', coalesce((
       select jsonb_agg(jsonb_build_object(
                'locale', locale, 'total', n,
                'yesPct', round(100.0 * y / n, 1)) order by n desc)
       from (select locale, count(*) n, count(*) filter (where answer) y
             from public.votes where question_id = p_id group by locale) s), '[]'::jsonb),
    'perHour', coalesce((
       select jsonb_agg(jsonb_build_object('hour', h, 'votes', n) order by h)
       from (select date_trunc('hour', created_at at time zone 'utc') as h, count(*) n
             from public.votes where question_id = p_id group by 1) s), '[]'::jsonb),
    'guesses', (select jsonb_build_object(
                  'started',  count(*),
                  'finished', count(*) filter (where finished),
                  'solved',   count(*) filter (where solved_in is not null),
                  'avgError', round(avg(final_error) filter (where finished), 2))
                from public.guesses where question_id = p_id)
  );
end
$$;

create or replace function public.admin_submissions(p_admin uuid, p_status text default 'pending')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin(p_admin);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'text', s.text, 'locale', s.locale, 'nickname', s.nickname,
             'status', s.status, 'questionId', s.question_id, 'createdAt', s.created_at)
           order by s.created_at desc)
    from (select * from public.submissions
          where p_status is null or status = p_status
          order by created_at desc limit 300) s), '[]'::jsonb);
end
$$;

-- Approve -> creates a draft question (translation in the submitter's language,
-- unreviewed). Admins then add/review the other languages before scheduling.
create or replace function public.admin_review_submission(
  p_admin uuid, p_id bigint, p_action text, p_text text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_s   public.submissions;
  v_qid bigint;
begin
  perform public.assert_admin(p_admin);
  select * into v_s from public.submissions where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_s.status <> 'pending' then raise exception 'already_reviewed'; end if;

  if p_action = 'approve' then
    insert into public.questions (status, source) values ('draft', 'community') returning id into v_qid;
    insert into public.question_translations (question_id, locale, text, reviewed)
    values (v_qid, v_s.locale, btrim(coalesce(nullif(p_text, ''), v_s.text)), false);
    update public.submissions
       set status = 'approved', question_id = v_qid, reviewed_at = public.app_now()
     where id = p_id;
    return jsonb_build_object('status', 'approved', 'question', public.admin_question_json(v_qid));
  elsif p_action = 'reject' then
    update public.submissions set status = 'rejected', reviewed_at = public.app_now() where id = p_id;
    return jsonb_build_object('status', 'rejected');
  else
    raise exception 'invalid_action';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Execute permissions: only the server (service_role) may call anything.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on all functions in schema public to service_role;
