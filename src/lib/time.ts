/** UTC day helpers. A "day" is always a UTC calendar date, identical worldwide. */

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" of the UTC calendar date containing `d`. */
export function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseUtcDate(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Invalid date: ${s}`);
  return new Date(`${s}T00:00:00.000Z`);
}

export function addDays(dateStr: string, days: number): string {
  return utcDateString(new Date(parseUtcDate(dateStr).getTime() + days * DAY_MS));
}

export function daysBetween(fromStr: string, toStr: string): number {
  return Math.round((parseUtcDate(toStr).getTime() - parseUtcDate(fromStr).getTime()) / DAY_MS);
}

/** Puzzle number of a question scheduled on `dateStr` (launch day = #1). Mirrors SQL puzzle_number(). */
export function puzzleNumber(dateStr: string, launchDateStr: string): number {
  return daysBetween(launchDateStr, dateStr) + 1;
}

export function nextUtcMidnight(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

export function msUntilNextUtcMidnight(now: Date): number {
  return nextUtcMidnight(now).getTime() - now.getTime();
}

/** "HH:MM:SS" countdown (never negative). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
