'use client';

import { EmptyTile, Tile } from './Tile';
import { useI18n } from '@/i18n/I18nProvider';
import { MAX_GUESSES } from '@/lib/scoring';
import type { GuessTile } from '@/lib/types';
import type { Translator } from '@/i18n/translate';

export function tileLabel(t: Translator, n: number, g: GuessTile): string {
  const verdict = t(`game.verdict.${g.color}`, {
    direction: g.direction === 'none' ? '' : t(`game.direction.${g.direction}`),
  });
  return t('game.tileLabel', { n, value: g.value, verdict });
}

/** Three guess slots. Newly added tiles flip in. */
export function GuessTiles({ guesses, animateFrom }: { guesses: GuessTile[]; animateFrom: number }) {
  const { t } = useI18n();
  return (
    <ol className="grid grid-cols-3 gap-2.5" aria-label={t('result.yourGuesses')}>
      {Array.from({ length: MAX_GUESSES }, (_, i) => {
        const g = guesses[i];
        return (
          <li key={g ? `g${i}-${g.value}` : `e${i}`} className="[perspective:600px]">
            {g ? (
              <Tile
                value={g.value}
                color={g.color}
                direction={g.direction}
                label={tileLabel(t, i + 1, g)}
                animate={i >= animateFrom}
              />
            ) : (
              <EmptyTile label={t('game.tileEmpty', { n: i + 1 })} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
