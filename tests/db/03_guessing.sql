-- The guess flow: scoring, tiles, and that the answer is never revealed early.
begin;

select t.launch('2026-03-01');
select t.mkq('g1', '2026-03-01');
select t.mkq('g2', '2026-03-02');
select t.mkq('g3', '2026-03-03');

do $$
declare
  g1 bigint := (select id from questions where seed_key = 'g1');
  g2 bigint := (select id from questions where seed_key = 'g2');
  g3 bigint := (select id from questions where seed_key = 'g3');
  r  jsonb;
begin
  perform t.votes(g1, 62, 38);                -- 62 %
  perform t.votes(g1, 40, 10, 'et');          -- et: 80 % of 50 -> total 150, 102 yes = 68 %
  perform t.votes(g1, 10, 30, 'es');          -- es: 40 votes (below breakdown minimum of 50)
  perform t.at('2026-03-02 08:00:00+00');

  -- 112 yes of 190 = 58.95 % -> answer 59
  r := get_puzzle('en', t.p(1));
  perform t.eq(r #>> '{game,finished}', 'false', 'fresh game not finished');
  perform t.ok(position('yesPct' in r::text) = 0, 'puzzle payload has no yesPct before playing');
  perform t.ok(position('answer' in r::text) = 0, 'puzzle payload has no answer before playing');
  perform t.ok(position('histogram' in r::text) = 0, 'puzzle payload has no histogram before playing');

  -- Guess 1: 20 -> miss, higher
  r := submit_guess(g1, t.p(1), 20, 'en', 'ip-1');
  perform t.eq(r ->> 'status', 'ok', 'guess 1 accepted');
  perform t.eq(r #>> '{game,guesses,0,color}', 'miss', 'guess 1 grey');
  perform t.eq(r #>> '{game,guesses,0,direction}', 'up', 'guess 1 says higher');
  perform t.ok(r #> '{game,result}' = 'null'::jsonb, 'no result after guess 1');
  perform t.ok(position('yesPct' in r::text) = 0, 'guess 1 response does not leak yesPct');

  -- Repeat guess is rejected without using an attempt
  r := submit_guess(g1, t.p(1), 20, 'en', 'ip-1');
  perform t.eq(r ->> 'status', 'repeated', 'repeated value rejected');
  perform t.eq(jsonb_array_length(r #> '{game,guesses}'), 1, 'repeat did not use an attempt');

  -- Guess 2: 67 -> close (8 away), lower
  r := submit_guess(g1, t.p(1), 67, 'en', 'ip-1');
  perform t.eq(r #>> '{game,guesses,1,color}', 'close', 'guess 2 yellow');
  perform t.eq(r #>> '{game,guesses,1,direction}', 'down', 'guess 2 says lower');
  perform t.ok(r #> '{game,result}' = 'null'::jsonb, 'no result after guess 2');

  -- Guess 3: 56 -> correct (error 3)
  r := submit_guess(g1, t.p(1), 56, 'en', 'ip-1');
  perform t.eq(r #>> '{game,finished}', 'true', 'finished on green');
  perform t.eq((r #>> '{game,solvedIn}')::int, 3, 'solved in 3');
  perform t.eq((r #>> '{game,finalError}')::int, 3, 'final error 3');
  perform t.eq(r #>> '{game,guesses,2,color}', 'correct', 'guess 3 green');
  perform t.eq(r #>> '{game,guesses,2,direction}', 'none', 'green has no arrow');
  perform t.eq((r #>> '{game,result,answer}')::int, 59, 'answer revealed after finishing');
  perform t.eq((r #>> '{game,result,yesPct}')::numeric, 58.95, 'exact yes % revealed');
  perform t.eq((r #>> '{game,result,total}')::int, 190, 'sample size revealed');

  -- Breakdown: en (100) and et (50) shown, es (40) hidden
  perform t.eq(jsonb_array_length(r #> '{game,result,perLocale}'), 2, 'breakdown hides locales under 50 votes');
  perform t.eq(r #>> '{game,result,perLocale,0,locale}', 'en', 'largest locale first');
  perform t.eq((r #>> '{game,result,perLocale,1,yesPct}')::numeric, 80.0, 'et yes % in breakdown');

  -- Further guesses after finishing do nothing
  r := submit_guess(g1, t.p(1), 10, 'en', 'ip-1');
  perform t.eq(r ->> 'status', 'finished', 'no guesses after finishing');
  perform t.eq(jsonb_array_length(r #> '{game,guesses}'), 3, 'still three guesses');

  -- Player 2: three misses -> X
  perform submit_guess(g1, t.p(2), 0, 'en', null);
  perform submit_guess(g1, t.p(2), 100, 'en', null);
  r := submit_guess(g1, t.p(2), 90, 'en', null);
  perform t.eq(r #>> '{game,finished}', 'true', 'finished after 3rd guess');
  perform t.eq(r #> '{game,solvedIn}', 'null'::jsonb, 'unsolved = X');
  perform t.eq((r #>> '{game,finalError}')::int, 31, 'final error from last guess');

  -- Player 3: green on first try
  r := submit_guess(g1, t.p(3), 59, 'en', null);
  perform t.eq((r #>> '{game,solvedIn}')::int, 1, 'solved in 1');
  perform t.eq((r #>> '{game,finalError}')::int, 0, 'exact');

  -- Histogram & crowd stats: final guesses 56, 90, 59
  perform t.eq((r #>> '{game,result,finishedCount}')::int, 3, 'three finished players');
  perform t.eq((r #>> '{game,result,within3Count}')::int, 2, 'two within ±3');
  perform t.eq((r #>> '{game,result,histogram,11}')::int, 2, 'bucket 55-59 has two');
  perform t.eq((r #>> '{game,result,histogram,18}')::int, 1, 'bucket 90-94 has one');
  perform t.eq(jsonb_array_length(r #> '{game,result,histogram}'), 20, '20 buckets');

  -- Resuming: get_puzzle returns progress
  perform submit_guess(g1, t.p(4), 10, 'en', null);
  r := get_puzzle('en', t.p(4));
  perform t.eq(jsonb_array_length(r #> '{game,guesses}'), 1, 'progress restored');
  perform t.ok(r #> '{game,result}' = 'null'::jsonb, 'resumed game still hides result');

  -- Validation
  perform t.eq(submit_guess(g1, t.p(5), 101, 'en', null) ->> 'status', 'invalid', '101 invalid');
  perform t.eq(submit_guess(g1, t.p(5), -1, 'en', null) ->> 'status', 'invalid', '-1 invalid');

  -- Today's open question can never be guessed (its result must stay secret)
  perform t.eq(submit_guess(g2, t.p(1), 50, 'en', null) ->> 'status', 'not_playable', 'live question not guessable');
  perform t.eq(submit_guess(g3, t.p(1), 50, 'en', null) ->> 'status', 'not_playable', 'future question not guessable');
  perform t.ok(not exists (select 1 from results where question_id = g2), 'no result row for live question');

  -- Edge: exactly 10 away is yellow, 11 is grey, 4 is yellow
  perform t.eq(tile_color(44, 54), 'close', '10 away is close');
  perform t.eq(tile_color(43, 54), 'miss', '11 away is miss');
  perform t.eq(tile_color(58, 54), 'close', '4 away is close');
  perform t.eq(tile_color(57, 54), 'correct', '3 away is correct');
end
$$;

rollback;
