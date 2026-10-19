/**
 * Spoiler-free share text. Never includes the question or the real percentage.
 *
 *   Guess the Crowd #47 2/3
 *   🟨⬆️ 🟩
 *   ±2 · guessthecrowd.com
 */
import type { Direction, TileColor } from './scoring';
import { MAX_GUESSES } from './scoring';

export interface ShareInput {
  title: string; // localized game name, e.g. "Guess the Crowd"
  number: number;
  solvedIn: number | null;
  finalError: number;
  guesses: { color: TileColor | string; direction: Direction | string }[];
  host: string; // e.g. "guessthecrowd.com"
  highContrast?: boolean;
  archive?: boolean;
  archiveLabel?: string; // localized, e.g. "archive"
}

const EMOJI: Record<string, { normal: string; contrast: string }> = {
  correct: { normal: '🟩', contrast: '🟧' },
  close: { normal: '🟨', contrast: '🟦' },
  miss: { normal: '⬜', contrast: '⬜' },
};

const ARROW: Record<string, string> = { up: '⬆️', down: '⬇️', none: '' };

export function shareTiles(guesses: ShareInput['guesses'], highContrast = false): string {
  return guesses
    .map((g) => {
      const e = EMOJI[g.color] ?? EMOJI.miss;
      return (highContrast ? e.contrast : e.normal) + (ARROW[g.direction] ?? '');
    })
    .join(' ');
}

export function buildShareText(input: ShareInput): string {
  const score = `${input.solvedIn ?? 'X'}/${MAX_GUESSES}`;
  const head = `${input.title} #${input.number} ${score}${input.archive && input.archiveLabel ? ` (${input.archiveLabel})` : ''}`;
  return [head, shareTiles(input.guesses, input.highContrast), `±${input.finalError} · ${input.host}`].join('\n');
}
