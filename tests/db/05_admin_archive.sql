-- Admin scheduling rules, void, moderation, archive and the seeded launch puzzle.
begin;

select t.launch('2026-05-01');

do $$
declare
  a    uuid := t.admin();
  qa   bigint;
  qb   bigint;
  qc   bigint;
  r    jsonb;
  sid  bigint;
begin
  perform t.at('2026-05-01 09:00:00+00');

  perform t.throws(format('select admin_dashboard(%L, ''2026-05-01'')', t.p(77)), '%forbidden%',
                   'non-admin rejected');

  -- Create a draft with only English, unreviewed.
  r := admin_save_question(a, null, '{"en": {"text": "Do you sing in the shower?", "reviewed": false}}');
  qa := (r ->> 'id')::bigint;
  perform t.eq(r ->> 'status', 'draft', 'new question is draft');
  perform t.eq((r ->> 'ready')::boolean, false, 'not ready without translations');
  perform t.throws(format('select admin_schedule(%L, %s, ''2026-05-03'')', a, qa), '%not_ready%',
                   'cannot schedule with missing translations');

  -- Translations present but one unreviewed.
  perform admin_save_question(a, qa, '{
     "en": {"text": "Do you sing in the shower?", "reviewed": true},
     "et": {"text": "Kas sa laulad duši all?", "reviewed": true},
     "es": {"text": "¿Cantas en la ducha?", "reviewed": false}}');
  perform t.throws(format('select admin_schedule(%L, %s, ''2026-05-03'')', a, qa), '%not_ready%',
                   'cannot schedule with an unreviewed translation');
  perform t.eq((select reviewed_by from question_translations where question_id = qa and locale = 'et'), a,
               'reviewer recorded');

  r := admin_save_question(a, qa, '{"es": {"text": "¿Cantas en la ducha?", "reviewed": true}}');
  perform t.eq((r ->> 'ready')::boolean, true, 'ready when all reviewed');
  perform t.throws(format('select admin_schedule(%L, %s, ''2026-04-30'')', a, qa), '%date_in_past%',
                   'cannot schedule in the past');
  r := admin_schedule(a, qa, '2026-05-03');
  perform t.eq(r ->> 'status', 'scheduled', 'scheduled');
  perform t.eq((r ->> 'number')::int, 3, 'number derived from date');

  -- Un-reviewing a scheduled question is blocked.
  perform t.throws(format(
    'select admin_save_question(%L, %s, ''{"es": {"text": "¿Cantas en la ducha?", "reviewed": false}}'')', a, qa),
    '%not_ready%', 'scheduled question must stay reviewed');

  qb := t.mkq('b');
  qc := t.mkq('c');
  perform admin_schedule(a, qb, '2026-05-04');
  perform t.throws(format('select admin_schedule(%L, %s, ''2026-05-03'')', a, qc), '%date_taken%',
                   'draft cannot take an occupied date');

  -- Moving a scheduled question onto another scheduled one swaps them.
  perform admin_schedule(a, qb, '2026-05-03');
  perform t.eq((select scheduled_date from questions where id = qb), '2026-05-03'::date, 'swap: b moved');
  perform t.eq((select scheduled_date from questions where id = qa), '2026-05-04'::date, 'swap: a took b''s day');

  -- Scheduling for today makes it live immediately.
  r := admin_schedule(a, qc, '2026-05-01');
  perform t.eq(r ->> 'status', 'live', 'scheduled for today -> live');
  perform t.eq((get_today('en', null) #>> '{question,id}')::bigint, qc, 'served as today''s question');
  perform t.throws(format('select admin_save_question(%L, %s, ''{"en": {"text": "x y z?", "reviewed": true}}'')', a, qc),
                   '%locked%', 'live question cannot be reworded');
  perform t.throws(format('select admin_unschedule(%L, %s)', a, qc), '%locked%', 'live question cannot be unscheduled');

  -- Dashboard warning: fewer than 14 days scheduled.
  r := admin_dashboard(a, '2026-05-01', 7);
  perform t.eq((r ->> 'scheduledAhead')::int, 3, 'three of the next 14 days scheduled');
  perform t.eq(r ->> 'firstGap', '2026-05-02', 'first gap found');
  perform t.eq(jsonb_array_length(r -> 'calendar'), 7, 'calendar length');

  -- Unschedule & delete future.
  perform admin_unschedule(a, qa);
  perform t.eq((select status from questions where id = qa), 'draft', 'unscheduled to draft');
  perform t.eq(admin_delete(a, qa) ->> 'deleted', qa::text, 'draft deleted');

  -- Void today's live question: it stops being today's question.
  perform t.votes(qc, 3, 3);
  perform t.throws(format('select admin_delete(%L, %s)', a, qc), '%has_votes%', 'cannot delete a question with votes');
  perform admin_void(a, qc);
  perform t.eq(get_today('en', null) -> 'question', 'null'::jsonb, 'voided live question disappears');

  -- Stats come from real rows.
  r := admin_question_stats(a, qc);
  perform t.eq((r ->> 'votes')::int, 6, 'stats: vote count');
  perform t.eq((r ->> 'yesPct')::numeric, 50.00, 'stats: yes %');

  -- Moderation
  perform submit_suggestion('Have you ever slept in a tent?', 'et', 'Mari', 'ip-s');
  sid := (select id from submissions order by id desc limit 1);
  r := admin_review_submission(a, sid, 'approve', 'Kas oled kunagi telgis maganud?');
  perform t.eq(r ->> 'status', 'approved', 'submission approved');
  perform t.eq(r #>> '{question,status}', 'draft', 'approved submission becomes a draft');
  perform t.eq(r #>> '{question,source}', 'community', 'source community');
  perform t.eq(r #>> '{question,translations,et,text}', 'Kas oled kunagi telgis maganud?', 'edited text kept');
  perform t.throws(format('select admin_review_submission(%L, %s, ''reject'')', a, sid), '%already_reviewed%',
                   'cannot review twice');

  -- Suggestion rate limit (5/hour)
  perform submit_suggestion('Question number one?', 'en', null, 'ip-z');
  perform submit_suggestion('Question number two?', 'en', null, 'ip-z');
  perform submit_suggestion('Question number three?', 'en', null, 'ip-z');
  perform submit_suggestion('Question number four?', 'en', null, 'ip-z');
  perform submit_suggestion('Question number five?', 'en', null, 'ip-z');
  perform t.eq(submit_suggestion('Question number six?', 'en', null, 'ip-z') ->> 'status', 'rate_limited',
               'suggestion rate limit');
end
$$;

-- Seeded launch puzzle from a cited survey + archive rules.
do $$
declare
  s  bigint := t.mkq('survey');
  d1 bigint := t.mkq('d1', '2026-05-10');
  d2 bigint := t.mkq('d2', '2026-05-11');
  d3 bigint := t.mkq('d3', '2026-05-12');
  r  jsonb;
begin
  perform t.launch('2026-05-10');
  perform t.at('2026-05-10 01:00:00+00');
  perform t.throws(format('select seed_launch_puzzle(%s, 10, 10, null)', s), '%source_url_required%',
                   'seeded result needs a source');
  perform seed_launch_puzzle(s, 410, 590, 'https://example.org/survey');
  r := get_puzzle('en', t.p(1));
  perform t.eq((r #>> '{puzzle,number}')::int, 0, 'launch day plays seeded puzzle #0');
  r := submit_guess(s, t.p(1), 41, 'en', null);
  perform t.eq(r #>> '{game,result,sourceUrl}', 'https://example.org/survey', 'source shown with result');
  perform t.eq((r #>> '{game,result,seeded}')::boolean, true, 'marked as seeded');

  perform t.votes(d1, 70, 30);
  perform t.votes(d2, 20, 80);
  perform t.at('2026-05-12 01:00:00+00');
  r := get_archive('en', t.p(1));
  perform t.eq(jsonb_array_length(r -> 'items'), 2, 'archive excludes today''s daily puzzle');
  perform t.eq((r #>> '{items,0,number}')::int, 1, 'archive newest first (#1)');
  perform t.eq((r #>> '{items,1,number}')::int, 0, 'then #0');
  perform t.eq((r #>> '{items,1,played}')::boolean, true, 'played flag from guesses');
  perform t.ok(position('"d2' in r::text) = 0, 'current daily (d2) not in archive');

  r := get_puzzle('en', t.p(2), 1);
  perform t.eq(r ->> 'mode', 'archive', 'archive mode by number');
  perform t.eq(get_puzzle('en', t.p(2), 2) ->> 'mode', 'daily', 'current daily via number is daily');
  perform t.eq(get_puzzle('en', t.p(2), 3) ->> 'status', 'not_found', 'today''s live question not playable by number');
  perform t.eq(get_puzzle('en', t.p(2), 99) ->> 'status', 'not_found', 'unknown number');

  -- Voiding the current daily puzzle falls back to the previous one.
  update questions set status = 'void' where id = d2;
  perform t.eq((get_puzzle('en', t.p(2)) #>> '{puzzle,id}')::bigint, d1, 'void daily falls back');
end
$$;

rollback;
