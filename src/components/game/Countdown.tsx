'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { formatCountdown, nextUtcMidnight } from '@/lib/time';
import { useCountdown } from '../hooks';

export function Countdown({ onZero }: { onZero?: () => void }) {
  const { t, fmt } = useI18n();
  const ms = useCountdown(onZero);
  return (
    <div>
      <p className="text-sm font-semibold">{t('result.nextPuzzle')}</p>
      <p className="text-3xl font-extrabold leading-tight tnum" role="timer" aria-live="off">
        {ms === null ? '––:––:––' : formatCountdown(ms)}
      </p>
      {ms !== null && (
        <p className="text-xs text-muted">{t('result.nextAt', { time: fmt.localTime(nextUtcMidnight(new Date())) })}</p>
      )}
    </div>
  );
}
