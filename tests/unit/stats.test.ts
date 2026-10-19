import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, type GameRecord } from '@/lib/stats';

function rec(number: number, prevDaily: number | null, solvedIn: number | null, opts: Partial<GameRecord> = {}): GameRecord {
  return {
    number,
    prevDaily,
    solvedIn,
    mode: 'daily',
    finalError: solvedIn === null ? 15 : 2,
    guesses: [],
    playedAt: '2026-01-01T00:00:00Z',
    ...opts,
  };
}

test('empty stats', () => {
  const s = computeStats([], { dailyNumber: 5, prevDailyNumber: 4 });
  assert.deepEqual(s, {
    played: 0, wins: 0, winPct: 0, currentStreak: 0, bestStreak: 0, distribution: [0, 0, 0, 0], avgError: null,
  });
});

test('consecutive daily wins form a streak', () => {
  const records = [rec(1, null, 2), rec(2, 1, 1), rec(3, 2, 3)];
  const s = computeStats(records, { dailyNumber: 3, prevDailyNumber: 2 });
  assert.equal(s.currentStreak, 3);
  assert.equal(s.bestStreak, 3);
  assert.deepEqual(s.distribution, [1, 1, 1, 0]);
  assert.equal(s.winPct, 100);
});

test('streak stays alive until today is played', () => {
  const records = [rec(1, null, 1), rec(2, 1, 1)];
  const s = computeStats(records, { dailyNumber: 3, prevDailyNumber: 2 });
  assert.equal(s.currentStreak, 2);
});

test('missing a day breaks the streak', () => {
  const records = [rec(1, null, 1), rec(2, 1, 1)];
  const s = computeStats(records, { dailyNumber: 4, prevDailyNumber: 3 });
  assert.equal(s.currentStreak, 0);
  assert.equal(s.bestStreak, 2);
});

test('a loss resets the streak', () => {
  const records = [rec(1, null, 1), rec(2, 1, null), rec(3, 2, 2)];
  const s = computeStats(records, { dailyNumber: 3, prevDailyNumber: 2 });
  assert.equal(s.currentStreak, 1);
  assert.equal(s.bestStreak, 1);
  assert.deepEqual(s.distribution, [1, 1, 0, 1]);
  assert.equal(s.winPct, 67);
});

test('days without a new puzzle (fallback) do not break the streak', () => {
  // Puzzle 6 had too few votes: the daily after #5 was #7, whose prevDaily is #5.
  const records = [rec(5, 4, 1), rec(4, null, 2), rec(7, 5, 2)];
  const s = computeStats(records, { dailyNumber: 7, prevDailyNumber: 5 });
  assert.equal(s.currentStreak, 3);
});

test('archive games count for played/win% but never for streaks', () => {
  const records = [
    rec(10, 9, 1),
    rec(3, null, 1, { mode: 'archive' }),
    rec(9, null, 2, { mode: 'archive' }), // archive game of the puzzle before #10
  ];
  const s = computeStats(records, { dailyNumber: 10, prevDailyNumber: 9 });
  assert.equal(s.played, 3);
  assert.equal(s.currentStreak, 1);
});

test('average error over all games', () => {
  const s = computeStats([rec(1, null, 1, { finalError: 0 }), rec(2, 1, null, { finalError: 11 })], {
    dailyNumber: 2,
    prevDailyNumber: 1,
  });
  assert.equal(s.avgError, 5.5);
});

test('cycles in prevDaily links cannot loop forever', () => {
  const s = computeStats([rec(1, 2, 1), rec(2, 1, 1)], { dailyNumber: 2, prevDailyNumber: 1 });
  assert.equal(s.currentStreak, 2);
});
