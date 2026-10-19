/**
 * Local, account-free statistics.
 *
 * Streaks follow the chain of DAILY puzzles as the server reports it: every
 * daily record stores the number of the daily puzzle that came before it
 * (prevDaily). This keeps streaks fair on days when no new puzzle was
 * available (a question with too few votes) — those days never break a streak.
 * Archive games count towards played/win%/distribution but never streaks.
 */
import { MAX_GUESSES } from './scoring';

export interface GameRecord {
  number: number;
  mode: 'daily' | 'archive';
  /** Previous daily puzzle number at the time this daily was played (null if none). */
  prevDaily: number | null;
  solvedIn: number | null; // null = X
  finalError: number;
  guesses: { value: number; color: string; direction: string }[];
  playedAt: string; // ISO timestamp
}

export interface Stats {
  played: number;
  wins: number;
  winPct: number; // 0..100, integer
  currentStreak: number;
  bestStreak: number;
  distribution: number[]; // index 0..2 = solved in 1..3, index 3 = X
  avgError: number | null;
}

export interface DailyContext {
  /** Today's daily puzzle number (null on launch day). */
  dailyNumber: number | null;
  /** Previous daily puzzle number as reported by the server. */
  prevDailyNumber: number | null;
}

function streakFrom(start: number | null, daily: Map<number, GameRecord>): number {
  let n = 0;
  const seen = new Set<number>();
  let cur = start;
  while (cur !== null && !seen.has(cur)) {
    seen.add(cur);
    const r = daily.get(cur);
    if (!r || r.solvedIn === null) break;
    n++;
    cur = r.prevDaily;
  }
  return n;
}

export function computeStats(records: GameRecord[], ctx: DailyContext): Stats {
  const distribution = new Array(MAX_GUESSES + 1).fill(0);
  let wins = 0;
  let errSum = 0;
  for (const r of records) {
    if (r.solvedIn === null) distribution[MAX_GUESSES]++;
    else {
      distribution[r.solvedIn - 1]++;
      wins++;
    }
    errSum += r.finalError;
  }

  const daily = new Map<number, GameRecord>();
  for (const r of records) if (r.mode === 'daily') daily.set(r.number, r);

  // Current streak: from today's daily if played, else from the previous daily
  // (still alive until today's puzzle is lost or skipped).
  let start: number | null = null;
  if (ctx.dailyNumber !== null && daily.has(ctx.dailyNumber)) start = ctx.dailyNumber;
  else if (ctx.prevDailyNumber !== null && daily.has(ctx.prevDailyNumber)) start = ctx.prevDailyNumber;
  const currentStreak = streakFrom(start, daily);

  let bestStreak = currentStreak;
  for (const num of daily.keys()) bestStreak = Math.max(bestStreak, streakFrom(num, daily));

  const played = records.length;
  return {
    played,
    wins,
    winPct: played ? Math.round((wins / played) * 100) : 0,
    currentStreak,
    bestStreak,
    distribution,
    avgError: played ? Math.round((errSum / played) * 10) / 10 : null,
  };
}
