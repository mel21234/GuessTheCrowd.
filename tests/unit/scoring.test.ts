import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerFromPct,
  clampGuess,
  feedback,
  histogramBucket,
  scoreGame,
  tileColor,
  tileDirection,
} from '@/lib/scoring';

test('tile colors: ±3 green, ±10 yellow, else grey', () => {
  assert.equal(tileColor(50, 50), 'correct');
  assert.equal(tileColor(53, 50), 'correct');
  assert.equal(tileColor(47, 50), 'correct');
  assert.equal(tileColor(54, 50), 'close');
  assert.equal(tileColor(40, 50), 'close');
  assert.equal(tileColor(60, 50), 'close');
  assert.equal(tileColor(39, 50), 'miss');
  assert.equal(tileColor(61, 50), 'miss');
  assert.equal(tileColor(0, 100), 'miss');
});

test('directions point towards the answer; green has none', () => {
  assert.equal(tileDirection(20, 54), 'up');
  assert.equal(tileDirection(80, 54), 'down');
  assert.equal(tileDirection(52, 54), 'none');
  assert.equal(tileDirection(57, 54), 'none');
  assert.deepEqual(feedback(62, 54), { value: 62, color: 'close', direction: 'down' });
});

test('answer is the real percentage rounded half up', () => {
  assert.equal(answerFromPct(53.68), 54);
  assert.equal(answerFromPct(53.5), 54);
  assert.equal(answerFromPct(53.49), 53);
  assert.equal(answerFromPct(0), 0);
  assert.equal(answerFromPct(100), 100);
});

test('scoring: solved in 1/2/3, X after three misses', () => {
  assert.deepEqual(scoreGame([54], 54), { finished: true, solvedIn: 1, finalError: 0 });
  assert.deepEqual(scoreGame([20, 56], 54), { finished: true, solvedIn: 2, finalError: 2 });
  assert.deepEqual(scoreGame([20, 70, 51], 54), { finished: true, solvedIn: 3, finalError: 3 });
  assert.deepEqual(scoreGame([0, 100, 90], 54), { finished: true, solvedIn: null, finalError: 36 });
  assert.deepEqual(scoreGame([0, 100], 54), { finished: false, solvedIn: null, finalError: null });
  assert.deepEqual(scoreGame([], 54), { finished: false, solvedIn: null, finalError: null });
});

test('guess input is clamped to whole numbers 0..100', () => {
  assert.equal(clampGuess(-5), 0);
  assert.equal(clampGuess(105), 100);
  assert.equal(clampGuess(42.6), 43);
  assert.equal(clampGuess(Number.NaN), 50);
});

test('histogram buckets are 5 points wide, 100 goes to the last bucket', () => {
  assert.equal(histogramBucket(0), 0);
  assert.equal(histogramBucket(4), 0);
  assert.equal(histogramBucket(5), 1);
  assert.equal(histogramBucket(54), 10);
  assert.equal(histogramBucket(95), 19);
  assert.equal(histogramBucket(100), 19);
});
