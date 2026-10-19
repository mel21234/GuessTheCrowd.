-- Day boundaries, the midnight close, puzzle numbering and fallbacks.
begin;

select t.launch('2026-01-01');
select t.mkq('q1', '2026-01-01') \gset q1_
select t.mkq('q2', '2026-01-02') \gset q2_
select t.mkq('q3', '2026-01-03') \gset q3_
select t.mkq('q4', '2026-01-04') \gset q4_

do $$
declare
  q1 bigint := (select id from questions where seed_key = 'q1');
  q2 bigint := (select id from questions where seed_key = 'q2');
  q3 bigint := (select id from questions where seed_key = 'q3');
  r  jsonb;
begin
  -- Launch day, one second before midnight UTC.
  perform t.at('2026-01-01 23:59:59+00');
  r := get_today('en', t.p(1));
  perform t.eq((r #>> '{question,id}')::bigint, q1, 'launch day: today''s question is q1');
  perform t.eq((r #>> '{question,number}')::int, 1, 'launch day question is puzzle #1');
  perform t.eq(r ->> 'closesAt', '2026-01-02T00:00:00Z', 'closes at next 00:00 UTC');
  perform t.eq((select status from questions where id = q1), 'live', 'q1 marked live lazily');
  perform t.eq(get_puzzle('en', t.p(1)) ->> 'status', 'launch', 'no puzzle on launch day');

  perform t.eq(submit_vote(q1, t.p(1), true, 'en', 'ip-a') ->> 'status', 'ok', 'vote accepted before midnight');
  perform t.votes(q1, 89, 60);       -- 90 yes / 60 no in total = 60.00 %

  -- Different time zones do not matter: it is the same UTC day for everybody.
  perform t.at('2026-01-01 22:30:00-05');   -- = 2026-01-02 03:30 UTC
  perform t.eq(utc_today(), '2026-01-02'::date, 'UTC date used regardless of offset');

  -- Just after midnight UTC.
  perform t.at('2026-01-02 00:00:00+00');
  r := get_today('et', t.p(1));
  perform t.eq((r #>> '{question,id}')::bigint, q2, 'day 2: today''s question is q2');
  perform t.eq(r #>> '{question,text}', 'q2 (et)?', 'question text served in requested locale');
  perform t.eq(r -> 'myVote', 'null'::jsonb, 'has not voted on q2');
  perform t.eq((select status from questions where id = q1), 'closed', 'q1 closed at midnight');
  perform t.eq((select total from results where question_id = q1), 150, 'q1 result total');
  perform t.eq((select yes_pct from results where question_id = q1), 60.00::numeric, 'q1 yes %');
  perform t.eq(submit_vote(q1, t.p(2), true, 'en', 'ip-b') ->> 'status', 'closed', 'late vote for q1 rejected');

  r := get_puzzle('en', t.p(1));
  perform t.eq(r ->> 'status', 'ok', 'day 2 has a puzzle');
  perform t.eq((r #>> '{puzzle,id}')::bigint, q1, 'day 2 puzzle is q1 (yesterday)');
  perform t.eq((r #>> '{puzzle,number}')::int, 1, 'puzzle number is #1 for everyone');
  perform t.eq(r ->> 'mode', 'daily', 'daily mode');
  perform t.eq(r -> 'fallback', 'null'::jsonb, 'no fallback when yesterday qualified');

  -- q2 gets too few votes -> day 3 falls back to q1 and says so.
  perform t.votes(q2, 3, 2);
  perform t.at('2026-01-03 00:00:05+00');
  r := get_puzzle('en', t.p(1));
  perform t.eq((r #>> '{puzzle,id}')::bigint, q1, 'day 3 falls back to most recent qualifying (q1)');
  perform t.eq(r #>> '{fallback,reason}', 'too_few_votes', 'fallback reason is too_few_votes');
  perform t.eq((r #>> '{fallback,votes}')::int, 5, 'fallback shows real vote count');
  perform t.eq((r #>> '{fallback,needed}')::int, 100, 'fallback shows the threshold');
  perform t.eq((r ->> 'prevDailyNumber')::int, 1, 'previous daily puzzle number reported');

  -- close_due is idempotent and never rewrites results.
  perform t.eq((close_due() ->> 'closed')::int, 0, 'second close_due closes nothing');
  perform t.eq((select total from results where question_id = q2), 5, 'q2 result kept');

  -- Day 4: q3 qualifies.
  perform t.votes(q3, 30, 70);
  perform t.at('2026-01-04 06:00:00+00');
  r := get_puzzle('en', t.p(1));
  perform t.eq((r #>> '{puzzle,id}')::bigint, q3, 'day 4 puzzle is q3');
  perform t.eq((r #>> '{puzzle,number}')::int, 3, 'q3 is puzzle #3');
  perform t.eq((r ->> 'prevDailyNumber')::int, 1, 'previous daily was #1 (fallback day)');
  perform t.eq(run_daily_close() ->> 'today', '2026-01-04', 'cron entry point reports UTC date');

  -- Missed cron for several days: everything still closes correctly on first read.
  perform t.at('2026-01-09 12:00:00+00');
  r := get_today('en', null);
  perform t.eq(r -> 'question', 'null'::jsonb, 'no question scheduled for day 9');
  perform t.eq((select count(*) from questions where status in ('scheduled', 'live')), 0::bigint,
               'all past days closed after missed cron');
end
$$;

rollback;
