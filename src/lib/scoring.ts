/**
 * Scoring rules. The server (SQL: tile_color / tile_direction) is the source
 * of truth; this mirror is used for share text, stats and tests.
 */
export const MAX_GUESSES = 3;
export const CORRECT_WITHIN = 3;
export const CLOSE_WITHIN = 10;

export type TileColor = 'correct' | 'close' | 'miss';
export type Direction = 'up' | 'down' | 'none';

export interface GuessFeedback {
  value: number;
  color: TileColor;
  direction: Direction;
}

export function clampGuess(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** The answer players must hit: the real yes-percentage rounded to a whole number. */
export function answerFromPct(yesPct: number): number {
  return Math.round(yesPct);
}

export function tileColor(guess: number, answer: number): TileColor {
  const d = Math.abs(guess - answer);
  if (d <= CORRECT_WITHIN) return 'correct';
  if (d <= CLOSE_WITHIN) return 'close';
  return 'miss';
}

export function tileDirection(guess: number, answer: number): Direction {
  if (Math.abs(guess - answer) <= CORRECT_WITHIN) return 'none';
  return answer > guess ? 'up' : 'down';
}

export function feedback(guess: number, answer: number): GuessFeedback {
  return { value: guess, color: tileColor(guess, answer), direction: tileDirection(guess, answer) };
}

export interface GameOutcome {
  finished: boolean;
  solvedIn: number | null; // 1..3, null = X
  finalError: number | null;
}

/** Outcome of a sequence of guesses against an answer. */
export function scoreGame(guesses: number[], answer: number): GameOutcome {
  for (let i = 0; i < guesses.length && i < MAX_GUESSES; i++) {
    const err = Math.abs(guesses[i] - answer);
    if (err <= CORRECT_WITHIN) return { finished: true, solvedIn: i + 1, finalError: err };
  }
  if (guesses.length >= MAX_GUESSES) {
    return { finished: true, solvedIn: null, finalError: Math.abs(guesses[MAX_GUESSES - 1] - answer) };
  }
  return { finished: false, solvedIn: null, finalError: null };
}

/** Index (0..19) of the 5-point histogram bucket a guess falls into. */
export function histogramBucket(value: number): number {
  return Math.min(Math.floor(clampGuess(value) / 5), 19);
}
