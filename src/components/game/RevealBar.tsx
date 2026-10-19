'use client';

import { useEffect, useState } from 'react';
import { TileGlyph } from './Tile';
import { useI18n } from '@/i18n/I18nProvider';
import type { GuessTile } from '@/lib/types';

const MARKER_BG = { correct: 'bg-correct', close: 'bg-close', miss: 'bg-miss' } as const;

/**
 * The signature moment: the crowd bar fills to the real "yes" share, then the
 * player's guesses drop onto it as markers.
 */
export function RevealBar({ answer, guesses, animate }: { answer: number; guesses: GuessTile[]; animate: boolean }) {
  const { t, fmt } = useI18n();
  const [filled, setFilled] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setFilled(true)));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  const markersDelay = animate ? 1100 : 0;
  // Stack markers that would overlap into rows (a marker is ~15% of the bar wide).
  const rowOf = new Map<number, number>();
  const rowEnds: number[] = [];
  [...guesses.keys()]
    .sort((x, y) => guesses[x].value - guesses[y].value)
    .forEach((i) => {
      const v = guesses[i].value;
      let r = rowEnds.findIndex((end) => v - end >= 15);
      if (r === -1) r = rowEnds.length;
      rowEnds[r] = v;
      rowOf.set(i, r);
    });
  const rows = Math.max(1, rowEnds.length);
  // Keep the % label inside the fill when there is room, otherwise just outside it.
  const labelInside = answer >= 22;

  return (
    <figure className="w-full" aria-label={`${t('result.realAnswer')}: ${fmt.percent(answer)}`}>
      <div className="relative" style={{ height: `${rows * 32 + 4}px` }} aria-hidden="true">
        {guesses.map((g, i) => (
          <div
            key={i}
            className={`absolute -translate-x-1/2 ${animate ? 'anim-pop' : ''}`}
            style={{
              left: `clamp(24px, ${g.value}%, calc(100% - 24px))`,
              bottom: '4px',
              animationDelay: `${markersDelay + i * 140}ms`,
            }}
          >
            <div
              className={`flex h-7 items-center gap-0.5 rounded-md px-1.5 text-xs font-extrabold text-tile-ink tnum ring-1 ring-black/10 ${MARKER_BG[g.color]}`}
            >
              {g.value}
              <TileGlyph color={g.color} direction={g.direction} size={12} />
            </div>
            <div
              className={`mx-auto w-0.5 ${MARKER_BG[g.color]}`}
              style={{ height: `${6 + (rowOf.get(i) ?? 0) * 32}px` }}
            />
          </div>
        ))}
      </div>

      <div className="relative h-12 overflow-hidden rounded-xl bg-track" aria-hidden="true">
        <div
          className="reveal-fill absolute inset-y-0 left-0 flex items-center justify-end rounded-xl bg-fg"
          style={{ width: filled ? `${answer}%` : '0%' }}
        >
          {labelInside && (
            <span
              className={`pr-3 text-xl font-extrabold text-bg tnum transition-opacity duration-300 ${filled ? 'opacity-100 delay-700' : 'opacity-0'}`}
            >
              {fmt.percent(answer)}
            </span>
          )}
        </div>
        {!labelInside && (
          <span
            className={`absolute inset-y-0 flex items-center pl-2 text-xl font-extrabold tnum transition-opacity duration-300 ${filled ? 'opacity-100 delay-700' : 'opacity-0'}`}
            style={{ left: `${answer}%` }}
          >
            {fmt.percent(answer)}
          </span>
        )}
      </div>

      <div className="mt-1 flex justify-between text-xs text-muted tnum" aria-hidden="true">
        <span>{fmt.percent(0)}</span>
        <span>{fmt.percent(50)}</span>
        <span>{fmt.percent(100)}</span>
      </div>
    </figure>
  );
}
