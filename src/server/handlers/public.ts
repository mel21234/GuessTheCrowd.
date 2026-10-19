/**
 * Public API route handlers (plain Web Request -> Response, so they run in
 * Next.js route handlers and in tests without any framework).
 */
import { getDb } from '../db';
import { clientIp, errorJson, handler, ipHash, json, readBody, readQuery } from '../http';
import {
  archiveQuery,
  guessBody,
  puzzleQuery,
  suggestBody,
  SUGGESTION_MAX,
  SUGGESTION_MIN,
  todayQuery,
  voteBody,
} from '../schemas';
import { turnstileEnabled, turnstileSiteKey, verifyTurnstile } from '../turnstile';
import { containsProfanity } from '@/lib/profanity';
import type {
  ArchiveResponse,
  GuessResponse,
  PuzzleResponse,
  SuggestResponse,
  TodayResponse,
  VoteResponse,
} from '@/lib/types';

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const db = await getDb();
  const { data, error } = await db.rpc<T>(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** GET /api/today?locale=en&player=<uuid> — today's question text, never any counts. */
export const getToday = handler(async (req) => {
  const q = readQuery(req, todayQuery);
  if (!q.ok) return q.res;
  const data = await call<TodayResponse>('get_today', { p_locale: q.data.locale, p_player: q.data.player ?? null });
  return json(data);
});

/** GET /api/puzzle?locale=en&player=<uuid>[&number=12] — the puzzle; the answer only once finished. */
export const getPuzzle = handler(async (req) => {
  const q = readQuery(req, puzzleQuery);
  if (!q.ok) return q.res;
  const data = await call<PuzzleResponse>('get_puzzle', {
    p_locale: q.data.locale,
    p_player: q.data.player,
    p_number: q.data.number ?? null,
  });
  return json(data);
});

/** POST /api/vote — one vote per player for today's question. */
export const postVote = handler(async (req) => {
  const b = await readBody(req, voteBody);
  if (!b.ok) return b.res;
  const { questionId, playerId, answer, locale, turnstileToken } = b.data;

  const challengeEnabled = turnstileEnabled();
  let verified = false;
  if (challengeEnabled && turnstileToken) {
    verified = await verifyTurnstile(turnstileToken, clientIp(req));
    if (!verified) return json({ status: 'challenge_failed', siteKey: turnstileSiteKey() ?? undefined } satisfies VoteResponse);
  }

  const data = await call<VoteResponse>('submit_vote', {
    p_question_id: questionId,
    p_player: playerId,
    p_answer: answer,
    p_locale: locale,
    p_ip_hash: ipHash(req),
    p_verified: verified,
    p_challenge_enabled: challengeEnabled,
  });

  if (data.status === 'rate_limited') return json(data, 429);
  if (data.status === 'challenge_required') return json({ ...data, siteKey: turnstileSiteKey() ?? undefined });
  return json(data);
});

/** POST /api/guess — one attempt. Feedback each time; the full result only after the last guess. */
export const postGuess = handler(async (req) => {
  const b = await readBody(req, guessBody);
  if (!b.ok) return b.res;
  const data = await call<GuessResponse>('submit_guess', {
    p_question_id: b.data.questionId,
    p_player: b.data.playerId,
    p_value: b.data.value,
    p_locale: b.data.locale,
    p_ip_hash: ipHash(req),
  });
  if (data.status === 'rate_limited') return json(data, 429);
  if (data.status === 'invalid') return json(data, 400);
  if (data.status === 'not_playable') return json(data, 404);
  return json(data);
});

/** GET /api/archive?locale=en&player=<uuid>[&before=40] */
export const getArchive = handler(async (req) => {
  const q = readQuery(req, archiveQuery);
  if (!q.ok) return q.res;
  const data = await call<ArchiveResponse>('get_archive', {
    p_locale: q.data.locale,
    p_player: q.data.player,
    p_before: q.data.before ?? null,
    p_limit: 30,
  });
  return json(data);
});

/** POST /api/suggest — community question into the moderation queue. */
export const postSuggest = handler(async (req) => {
  const b = await readBody(req, suggestBody);
  if (!b.ok) return b.res;
  const text = b.data.text.replace(/\s+/g, ' ').trim();
  const nickname = b.data.nickname.replace(/\s+/g, ' ').trim().slice(0, 30);

  // Honeypot filled in: pretend success so bots learn nothing.
  if (b.data.website.trim() !== '') return json({ status: 'ok' } satisfies SuggestResponse);

  const fail = (error: SuggestResponse['error'], status = 400) => json({ status: 'error', error } satisfies SuggestResponse, status);
  if (text.length < SUGGESTION_MIN) return fail('too_short');
  if (text.length > SUGGESTION_MAX) return fail('too_long');
  if (containsProfanity(text) || containsProfanity(nickname)) return fail('profanity');

  const data = await call<{ status: 'ok' | 'rate_limited' }>('submit_suggestion', {
    p_text: text,
    p_locale: b.data.locale,
    p_nickname: nickname,
    p_ip_hash: ipHash(req),
  });
  if (data.status === 'rate_limited') return fail('rate_limited', 429);
  return json({ status: 'ok' } satisfies SuggestResponse);
});

/**
 * GET /api/cron/close — Vercel Cron at 00:00 UTC (sends `Authorization: Bearer $CRON_SECRET`).
 * Closing is also done lazily on every read, so a late cron never shows a stale puzzle.
 */
export const getCronClose = handler(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return errorJson('unauthorized', 401);
  }
  const data = await call<Record<string, unknown>>('run_daily_close', {});
  return json(data);
});
