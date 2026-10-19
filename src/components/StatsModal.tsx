'use client';

import { Modal } from './Modal';
import { useI18n } from '@/i18n/I18nProvider';
import { useStats } from './hooks';

export function StatsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const s = useStats();
  const max = Math.max(1, ...s.distribution);
  const labels = ['1', '2', '3', 'X'];

  return (
    <Modal open={open} onClose={onClose} title={t('stats.title')}>
      {s.played === 0 ? (
        <p className="py-4 text-[15px] text-muted">{t('stats.empty')}</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-y-4 text-center">
            <Stat value={fmt.number(s.played)} label={t('stats.played')} />
            <Stat value={fmt.number(s.winPct)} label={t('stats.winPct')} />
            <Stat value={s.avgError === null ? '–' : fmt.number(s.avgError)} label={t('stats.avgError')} />
            <Stat value={fmt.number(s.currentStreak)} label={t('stats.currentStreak')} />
            <Stat value={fmt.number(s.bestStreak)} label={t('stats.bestStreak')} />
          </dl>

          <h3 className="mb-2 mt-6 text-sm font-bold">{t('stats.distribution')}</h3>
          <ul className="space-y-1.5">
            {s.distribution.map((n, i) => (
              <li
                key={i}
                className="flex items-center gap-2"
                aria-label={t('stats.distributionRow', { label: labels[i], count: n })}
              >
                <span className="w-4 text-sm font-bold tnum" aria-hidden="true">
                  {labels[i]}
                </span>
                <span className="flex-1" aria-hidden="true">
                  <span
                    className={`flex h-6 min-w-7 items-center justify-end rounded-md px-2 text-sm font-bold tnum text-tile-ink ${
                      i === 3 ? 'bg-miss' : 'bg-correct'
                    }`}
                    style={{ width: `${Math.max(8, (n / max) * 100)}%` }}
                  >
                    {n}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-5 text-xs text-muted">{t('stats.localOnly')}</p>
    </Modal>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse items-center px-1">
      <dt className="text-xs leading-tight text-muted">{label}</dt>
      <dd className="text-3xl font-extrabold tnum">{value}</dd>
    </div>
  );
}
