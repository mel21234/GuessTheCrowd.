import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  daysBetween,
  formatCountdown,
  msUntilNextUtcMidnight,
  nextUtcMidnight,
  puzzleNumber,
  utcDateString,
} from '@/lib/time';

test('UTC day boundary: 23:59:59.999Z and 00:00Z are different days', () => {
  assert.equal(utcDateString(new Date('2026-10-18T23:59:59.999Z')), '2026-10-18');
  assert.equal(utcDateString(new Date('2026-10-19T00:00:00.000Z')), '2026-10-19');
});

test('local offsets do not change the UTC day', () => {
  // 22:30 in New York (UTC-5) on the 18th is already the 19th in UTC.
  assert.equal(utcDateString(new Date('2026-10-18T22:30:00-05:00')), '2026-10-19');
  // 02:00 in Tallinn (UTC+3) on the 19th is still the 18th in UTC.
  assert.equal(utcDateString(new Date('2026-10-19T02:00:00+03:00')), '2026-10-18');
});

test('next UTC midnight and countdown', () => {
  const now = new Date('2026-10-18T21:30:15Z');
  assert.equal(nextUtcMidnight(now).toISOString(), '2026-10-19T00:00:00.000Z');
  assert.equal(msUntilNextUtcMidnight(now), (2 * 3600 + 29 * 60 + 45) * 1000);
  assert.equal(formatCountdown(msUntilNextUtcMidnight(now)), '02:29:45');
  assert.equal(msUntilNextUtcMidnight(new Date('2026-10-19T00:00:00Z')), 86_400_000);
  assert.equal(formatCountdown(-500), '00:00:00');
  assert.equal(formatCountdown(86_399_000), '23:59:59');
});

test('puzzle numbering is based on UTC dates (launch day = #1)', () => {
  assert.equal(puzzleNumber('2026-11-01', '2026-11-01'), 1);
  assert.equal(puzzleNumber('2026-11-02', '2026-11-01'), 2);
  assert.equal(puzzleNumber('2026-12-17', '2026-11-01'), 47);
  assert.equal(puzzleNumber('2026-10-31', '2026-11-01'), 0); // seeded launch puzzle
});

test('date arithmetic across months, leap years and DST changes', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // EU DST switch weekend
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
});
