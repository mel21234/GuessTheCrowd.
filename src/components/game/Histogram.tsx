'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { histogramBucket } from '@/lib/scoring';

/** Everyone's final guesses in 5-point buckets, with the real answer marked. */
export function Histogram({ buckets, answer, mine }: { buckets: number[]; answer: number; mine: number | null }) {
  const { t, fmt } = useI18n();
  const max = Math.max(1, ...buckets);
  const mineBucket = mine === null ? -1 : histogramBucket(mine);

  return (
    <figure>
      <figcaption className="mb-6 text-sm font-bold">{t('result.histogramTitle')}</figcaption>
      <div className="relative">
        <ol className="flex h-20 items-end gap-[3px]">
          {buckets.map((n, i) => {
            const from = i * 5;
            const to = i === 19 ? 100 : i * 5 + 4;
            return (
              <li key={i} className="flex h-full flex-1 items-end">
                <span className="sr-only">
                  {n > 0 ? t('result.histogramLabel', { count: n, from: fmt.percent(from), to: fmt.percent(to) }) : ''}
                </span>
                <span
                  aria-hidden="true"
                  className={`block w-full rounded-t-[3px] ${i === mineBucket ? 'bg-fg' : 'bg-miss'}`}
                  style={{ height: n === 0 ? '2px' : `${Math.max(6, (n / max) * 100)}%` }}
                />
              </li>
            );
          })}
        </ol>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 bottom-0 w-0.5 -translate-x-1/2 bg-correct-ink"
          style={{ left: `${answer}%` }}
        >
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-correct-ink tnum">
            {fmt.percent(answer)}
          </span>
        </div>
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted tnum" aria-hidden="true">
        <span>{fmt.percent(0)}</span>
        <span>{fmt.percent(100)}</span>
      </div>
    </figure>
  );
}
