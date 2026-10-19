-- One vote per player, rate limits, challenge flow.
begin;

select t.launch('2026-02-01');
select t.mkq('v1', '2026-02-01');

do $$
declare
  q bigint := (select id from questions where seed_key = 'v1');
begin
  perform t.at('2026-02-01 10:00:00+00');

  perform t.eq(submit_vote(q, t.p(1), true, 'es', 'ip-1') ->> 'status', 'ok', 'first vote ok');
  perform t.eq(submit_vote(q, t.p(1), false, 'es', 'ip-2') ->> 'status', 'duplicate', 'same player cannot vote twice');
  perform t.eq((select count(*) from votes where question_id = q), 1::bigint, 'only one row stored');
  perform t.eq((select answer from votes where question_id = q), true, 'original answer kept');
  perform t.eq((get_today('en', t.p(1)) -> 'myVote'), 'true'::jsonb, 'player sees own vote');
  perform t.eq((select locale from votes where question_id = q), 'es', 'vote locale stored');

  perform t.throws(
    format('insert into votes (question_id, player_id, answer, locale) values (%s, %L, true, ''en'')', q, t.p(1)),
    '%votes_one_per_player%', 'unique constraint enforced at table level');

  perform t.eq(submit_vote(q, t.p(5), true, 'xx', null) ->> 'status', 'ok', 'unknown locale accepted');
  perform t.eq((select locale from votes where player_id = t.p(5)), 'en', 'unknown locale normalized to en');

  perform t.eq(submit_vote(999999, t.p(9), true, 'en', null) ->> 'status', 'closed', 'unknown question rejected');

  -- Rate limit: hard cap
  update app_config set value = '2' where key = 'vote_hourly_limit';
  perform t.eq(submit_vote(q, t.p(10), true, 'en', 'ip-x') ->> 'status', 'ok', 'rate: 1st');
  perform t.eq(submit_vote(q, t.p(11), true, 'en', 'ip-x') ->> 'status', 'ok', 'rate: 2nd');
  perform t.eq(submit_vote(q, t.p(12), true, 'en', 'ip-x') ->> 'status', 'rate_limited', 'rate: 3rd blocked');
  perform t.eq(submit_vote(q, t.p(12), true, 'en', 'ip-y') ->> 'status', 'ok', 'other IP hash unaffected');
  perform t.at('2026-02-01 11:00:01+00');
  perform t.eq(submit_vote(q, t.p(13), true, 'en', 'ip-x') ->> 'status', 'ok', 'limit resets after an hour');

  -- Challenge only when enabled and above threshold
  update app_config set value = '100' where key = 'vote_hourly_limit';
  update app_config set value = '1' where key = 'vote_challenge_threshold';
  perform t.eq(submit_vote(q, t.p(20), true, 'en', 'ip-c', false, false) ->> 'status', 'ok', 'challenge disabled: ok');
  perform t.eq(submit_vote(q, t.p(21), true, 'en', 'ip-c', false, true) ->> 'status', 'challenge_required',
               'above threshold: challenge required');
  perform t.eq(submit_vote(q, t.p(21), true, 'en', 'ip-c', true, true) ->> 'status', 'ok',
               'verified token passes');

  -- Voided question stops accepting votes.
  update questions set status = 'void' where id = q;
  perform t.eq(submit_vote(q, t.p(30), true, 'en', null) ->> 'status', 'closed', 'void question rejects votes');
  perform t.eq(get_today('en', null) -> 'question', 'null'::jsonb, 'void question not served as today''s');
end
$$;

rollback;
