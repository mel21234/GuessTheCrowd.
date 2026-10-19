'use client';

import { useId } from 'react';
import { MinusIcon, PlusIcon } from '../icons';
import { useI18n } from '@/i18n/I18nProvider';
import { clampGuess } from '@/lib/scoring';

/** Big number + smooth slider + −/+ for fine control. Arrow keys, PageUp/Down, Home/End work natively. */
export function GuessInput({
  value,
  onChange,
  onSubmit,
  attemptsLeft,
  busy,
  shakeKey,
}: {
  value: number;
  onChange: (v: number) => void;
  onSubmit: () => void;
  attemptsLeft: number;
  busy: boolean;
  shakeKey: number;
}) {
  const { t, fmt } = useI18n();
  const sliderId = useId();
  const set = (v: number) => onChange(clampGuess(v));
  const step = 'grid size-12 shrink-0 place-items-center rounded-full border-2 border-line text-fg hover:border-fg disabled:opacity-40';

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) onSubmit();
      }}
    >
      <output
        htmlFor={sliderId}
        key={shakeKey}
        className={`block text-center text-[64px] font-extrabold leading-none tracking-tight tnum [@media(max-height:700px)]:text-[52px] ${shakeKey ? 'anim-shake' : ''}`}
        aria-hidden="true"
      >
        {fmt.percent(value)}
      </output>

      <div className="mt-3 flex items-center gap-3">
        <button type="button" className={step} onClick={() => set(value - 1)} disabled={value <= 0} aria-label={t('game.decrease')}>
          <MinusIcon size={20} />
        </button>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          aria-label={t('game.sliderLabel')}
          aria-valuetext={fmt.percent(value)}
          className="guess-range"
          style={{ ['--pct' as string]: `${value}%` }}
        />
        <button type="button" className={step} onClick={() => set(value + 1)} disabled={value >= 100} aria-label={t('game.increase')}>
          <PlusIcon size={20} />
        </button>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-4 h-14 w-full rounded-full bg-btn text-lg font-extrabold text-btn-fg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? t('game.sending') : t('game.guess')}
      </button>
      <p className="mt-2 text-center text-sm text-muted">{t('game.attemptsLeft', { count: attemptsLeft })}</p>
    </form>
  );
}
