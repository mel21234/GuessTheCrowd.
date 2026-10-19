/**
 * Integration tests: real route handlers + real SQL on a throwaway database.
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:integration
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, psql, type TestDb } from '../support/testdb';
import { pgClient } from '../support/pg-client';
import { setDbClientForTests } from '@/server/db';
import { getArchive, getCronClose, getPuzzle, getToday, postGuess, postSuggest, postVote } from '@/server/handlers/public';
import { postAdmin } from '@/server/handlers/admin';

let db: TestDb;
let now = '2026-06-01T12:00:00Z';
const ADMIN = '00000000-0000-4000-8000-00000000a0a0';
const P = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BASE = 'http://test.local';

function get(path: string): Request {
  return new Request(BASE + path, { headers: { 'x-forwarded-for': '203.0.113.7' } });
}
function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
    body: JSON.stringify(body),
  });
}
async function call(h: (r: Request) => Promise<Response>, req: Request) {
  const res = await h(req);
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}
const sql = (s: string) => psql(db.url, s);

before(() => {
  process.env.IP_HASH_SECRET = 'test-secret-test-secret';
  process.env.CRON_SECRET = 'cron-secret';
  db = createTestDb();
  setDbClientForTests(pgClient(db.url, { now: () => now, users: { 'admin-token': ADMIN, 'user-token': P(999) } }));
  sql(`
    select t.launch('2026-06-01');
    select t.admin();
    select t.mkq('first',  '2026-06-01');
    select t.mkq('second', '2026-06-02');
    select t.mkq('third',  '2026-06-03');
  `);
});

after(() => {
  setDbClientForTests(null);
  db?.drop();
});

describe('voting', () => {
  test('today returns question text only, never counts', async () => {
    const r = await call(getToday, get(`/api/today?locale=es&player=${P(1)}`));
    assert.equal(r.status, 200);
    assert.equal(r.body.question.text, 'first (es)?');
    assert.equal(r.body.question.number, 1);
    assert.equal(r.body.myVote, null);
    assert.ok(!/yes_?count|yesPct|total|votes/i.test(r.text), 'no counts in today payload');
  });

  test('duplicate votes are rejected', async () => {
    const qid = Number(sql(`select id from questions where seed_key = 'first'`).trim());
    const a = await call(postVote, post('/api/vote', { questionId: qid, playerId: P(1), answer: true, locale: 'en' }));
    assert.equal(a.body.status, 'ok');
    const b = await call(postVote, post('/api/vote', { questionId: qid, playerId: P(1), answer: false, locale: 'en' }));
    assert.equal(b.body.status, 'duplicate');
    assert.equal(sql(`select count(*) || ':' || bool_and(answer) from votes where player_id = '${P(1)}'`).trim(), '1:true');
    const t = await call(getToday, get(`/api/today?locale=en&player=${P(1)}`));
    assert.equal(t.body.myVote, true);
  });

  test('invalid input is rejected by validation', async () => {
    const bad = await call(postVote, post('/api/vote', { questionId: 1, playerId: 'not-a-uuid', answer: true }));
    assert.equal(bad.status, 400);
    const bad2 = await call(postVote, post('/api/vote', { questionId: 1, playerId: P(2), answer: 'yes' }));
    assert.equal(bad2.status, 400);
    const res = await postVote(new Request(BASE + '/api/vote', { method: 'POST', body: '{nope' }));
    assert.equal(res.status, 400);
  });

  test('raw IPs are never stored, only daily-rotating hashes', async () => {
    const hashes = sql(`select distinct ip_hash from rate_events`).trim().split('\n');
    assert.ok(hashes.length >= 1);
    for (const h of hashes) {
      assert.match(h, /^[0-9a-f]{32}$/);
      assert.ok(!h.includes('203.0.113.7'));
    }
  });
});

describe('midnight close job', () => {
  test('cron requires the secret', async () => {
    const r = await call(getCronClose, get('/api/cron/close'));
    assert.equal(r.status, 401);
  });

  test('closes yesterday at 00:00 UTC and opens today', async () => {
    sql(`select t.votes((select id from questions where seed_key = 'first'), 120, 79)`); // + P(1) yes = 121/200
    now = '2026-06-01T23:59:59Z';
    const before = await call(getPuzzle, get(`/api/puzzle?locale=en&player=${P(5)}`));
    assert.equal(before.body.status, 'launch');

    now = '2026-06-02T00:00:01Z';
    const cron = await call(
      getCronClose,
      new Request(BASE + '/api/cron/close', { headers: { authorization: 'Bearer cron-secret' } }),
    );
    assert.equal(cron.status, 200);
    assert.equal(cron.body.closed, 1);
    assert.equal(cron.body.today, '2026-06-02');
    assert.equal(sql(`select total || '/' || yes_pct from results r join questions q on q.id = r.question_id where seed_key = 'first'`).trim(), '200/60.50');

    const today = await call(getToday, get(`/api/today?locale=en`));
    assert.equal(today.body.question.text, 'second (en)?');
  });
});

describe('guess flow', () => {
  let qid = 0;

  test('the puzzle never contains the answer before the game ends', async () => {
    const r = await call(getPuzzle, get(`/api/puzzle?locale=et&player=${P(5)}`));
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
    assert.equal(r.body.puzzle.text, 'first (et)?');
    assert.equal(r.body.puzzle.number, 1);
    qid = r.body.puzzle.id;
    for (const leak of ['yesPct', 'answer', 'histogram', '60.5', 'yes_pct', 'total']) {
      assert.ok(!r.text.includes(leak), `puzzle response must not contain ${leak}`);
    }
  });

  test('each guess returns only feedback until the last one', async () => {
    const g1 = await call(postGuess, post('/api/guess', { questionId: qid, playerId: P(5), value: 30, locale: 'et' }));
    assert.equal(g1.body.status, 'ok');
    assert.deepEqual(g1.body.game.guesses, [{ value: 30, color: 'miss', direction: 'up' }]);
    assert.equal(g1.body.game.result, null);
    assert.ok(!g1.text.includes('yesPct') && !g1.text.includes('"answer"'));

    const g2 = await call(postGuess, post('/api/guess', { questionId: qid, playerId: P(5), value: 70, locale: 'et' }));
    assert.equal(g2.body.game.guesses[1].color, 'close');
    assert.equal(g2.body.game.guesses[1].direction, 'down');
    assert.equal(g2.body.game.result, null);

    // Refreshing mid-game restores progress, still without the answer
    const mid = await call(getPuzzle, get(`/api/puzzle?locale=et&player=${P(5)}`));
    assert.equal(mid.body.game.guesses.length, 2);
    assert.ok(!mid.text.includes('yesPct'));

    const g3 = await call(postGuess, post('/api/guess', { questionId: qid, playerId: P(5), value: 45, locale: 'et' }));
    assert.equal(g3.body.game.finished, true);
    assert.equal(g3.body.game.solvedIn, null);
    assert.equal(g3.body.game.finalError, 16);
    assert.equal(g3.body.game.result.answer, 61);
    assert.equal(g3.body.game.result.total, 200);
  });

  test('a fresh player solving on the first try gets the result immediately', async () => {
    const r = await call(postGuess, post('/api/guess', { questionId: qid, playerId: P(6), value: 60, locale: 'en' }));
    assert.equal(r.body.game.solvedIn, 1);
    assert.equal(r.body.game.result.finishedCount, 2);
    assert.equal(r.body.game.result.within3Count, 1);
  });

  test('today\'s open question cannot be guessed', async () => {
    const live = Number(sql(`select id from questions where seed_key = 'second'`).trim());
    const r = await call(postGuess, post('/api/guess', { questionId: live, playerId: P(5), value: 50, locale: 'en' }));
    assert.equal(r.status, 404);
    assert.equal(r.body.status, 'not_playable');
    assert.ok(!r.text.includes('result'));
  });

  test('guess validation', async () => {
    const r = await call(postGuess, post('/api/guess', { questionId: qid, playerId: P(7), value: 101 }));
    assert.equal(r.status, 400);
  });
});

describe('archive', () => {
  test('archive lists past puzzles but never the current daily one', async () => {
    sql(`select t.votes((select id from questions where seed_key = 'second'), 30, 90)`);
    now = '2026-06-03T09:00:00Z';
    const r = await call(getArchive, get(`/api/archive?locale=en&player=${P(5)}`));
    assert.equal(r.status, 200);
    assert.equal(r.body.items.length, 1);
    assert.equal(r.body.items[0].number, 1);
    assert.equal(r.body.items[0].played, true);
    assert.ok(!r.text.includes('second (en)?'));

    const p = await call(getPuzzle, get(`/api/puzzle?locale=en&player=${P(8)}&number=1`));
    assert.equal(p.body.mode, 'archive');
    assert.ok(!p.text.includes('yesPct'));
  });
});

describe('suggestions', () => {
  test('validation, profanity and honeypot', async () => {
    const short = await call(postSuggest, post('/api/suggest', { text: 'Hm?', locale: 'en' }));
    assert.equal(short.body.error, 'too_short');
    const long = await call(postSuggest, post('/api/suggest', { text: 'x'.repeat(121), locale: 'en' }));
    assert.equal(long.body.error, 'too_long');
    const rude = await call(postSuggest, post('/api/suggest', { text: 'Is this shit a question?', locale: 'en' }));
    assert.equal(rude.body.error, 'profanity');

    const bot = await call(postSuggest, post('/api/suggest', { text: 'Buy cheap watches now?', locale: 'en', website: 'spam.example' }));
    assert.equal(bot.body.status, 'ok');
    assert.equal(sql(`select count(*) from submissions where text like 'Buy cheap%'`).trim(), '0');

    const ok = await call(postSuggest, post('/api/suggest', { text: '  Kas oled kunagi   telgis maganud? ', nickname: 'Mari', locale: 'et' }));
    assert.equal(ok.body.status, 'ok');
    assert.equal(sql(`select text || '|' || locale || '|' || nickname from submissions`).trim(), 'Kas oled kunagi telgis maganud?|et|Mari');
  });
});

describe('admin', () => {
  test('requires a valid token of an admin', async () => {
    const none = await call(postAdmin, post('/api/admin', { action: 'dashboard', from: '2026-06-01' }));
    assert.equal(none.status, 401);
    const bad = await call(postAdmin, post('/api/admin', { action: 'dashboard', from: '2026-06-01' }, { authorization: 'Bearer nope' }));
    assert.equal(bad.status, 401);
    const user = await call(postAdmin, post('/api/admin', { action: 'dashboard', from: '2026-06-01' }, { authorization: 'Bearer user-token' }));
    assert.equal(user.status, 403);
  });

  test('dashboard, scheduling rules and moderation', async () => {
    const auth = { authorization: 'Bearer admin-token' };
    const d = await call(postAdmin, post('/api/admin', { action: 'dashboard', from: '2026-06-01', days: 14 }, auth));
    assert.equal(d.status, 200);
    assert.equal(d.body.scheduledAhead, 1);
    assert.equal(d.body.calendar.length, 14);
    assert.equal(d.body.pendingSubmissions, 1);

    const created = await call(
      postAdmin,
      post('/api/admin', { action: 'saveQuestion', translations: { en: { text: 'Do you whistle?', reviewed: true } } }, auth),
    );
    assert.equal(created.status, 200);
    const id = created.body.id;
    const notReady = await call(postAdmin, post('/api/admin', { action: 'schedule', id, date: '2026-06-10' }, auth));
    assert.equal(notReady.status, 409);
    assert.equal(notReady.body.error, 'not_ready');

    await call(
      postAdmin,
      post('/api/admin', {
        action: 'saveQuestion',
        id,
        translations: { et: { text: 'Kas sa vilistad?', reviewed: true }, es: { text: '¿Silbas?', reviewed: true } },
      }, auth),
    );
    const ok = await call(postAdmin, post('/api/admin', { action: 'schedule', id, date: '2026-06-10' }, auth));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, 'scheduled');

    const subs = await call(postAdmin, post('/api/admin', { action: 'submissions' }, auth));
    assert.equal(subs.body.length, 1);
    const approve = await call(postAdmin, post('/api/admin', { action: 'reviewSubmission', id: subs.body[0].id, decision: 'approve' }, auth));
    assert.equal(approve.body.question.status, 'draft');

    const stats = await call(postAdmin, post('/api/admin', { action: 'stats', id: d.body.calendar[0].question.id }, auth));
    assert.equal(stats.body.votes, 200);
    assert.equal(stats.body.guesses.finished, 2);

    const invalid = await call(postAdmin, post('/api/admin', { action: 'schedule', id, date: 'tomorrow' }, auth));
    assert.equal(invalid.status, 400);
  });
});
