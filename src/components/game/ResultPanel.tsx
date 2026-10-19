'use client';

import { RevealBar } from './RevealBar';
import { Histogram } from './Histogram';
import { ShareButton } from './ShareButton';
import { Countdown } from './Countdown';
import { useI18n } from '@/i18n/I18nProvider';
import { isLocale, localeNames } from '@/i18n/config';
import { localeHref } from '../paths';
import type { GameState, ResultPayload } from '@/lib/types';

export function ResultPanel({
  game,
  result,
  number,
  archive,
  animate,
  onNewDay,
}: {
  game: GameState;
  result: ResultPayload;
  number: number;
  archive: boolean;
  animate: boolean;
  onNewDay: () => void;
}) {
  const { t, fmt, locale } = useI18n();
  const solvedIn = game.solvedIn ?? null;
  const finalError = game.finalError ?? 0;
  const lastGuess = game.guesses[game.guesses.length - 1]?.value ?? null;
  const within3Share = result.finishedCount > 0 ? (result.within3Count / result.finishedCount) * 100 : 0;
  const stagger = (ms: number) => (animate ? { animationDelay: `${ms}ms` } : undefined);
  const fade = animate ? 'anim-fade-up' : '';

  return (
    <section className="flex flex-col gap-5" aria-labelledby="result-heading">
      <h2 id="result-heading" className="text-center text-2xl font-extrabold">
        {solvedIn ? t('result.solved', { count: solvedIn }) : t('result.notSolved')}
      </h2>

      <RevealBar answer={result.answer} guesses={game.guesses} animate={animate} />

      <div className={`text-center ${fade}`} style={stagger(1500)}>
        <p className="text-xl font-bold">
          {t('result.saidYes', { pct: fmt.percent(Number(result.yesPct), 1) })}
          <span className="font-normal text-muted"> · {t('result.players', { count: result.total })}</span>
        </p>
        <p className="mt-1 text-[15px]">
          {finalError === 0 ? t('result.spotOn') : t('result.off', { count: finalError })}
        </p>
        <p className="mt-1 text-sm text-muted">
          {result.finishedCount > 1
            ? t('result.within3', { pct: fmt.percent(within3Share) })
            : t('result.firstToFinish')}
        </p>
        {result.seeded && result.sourceUrl && (
          <p className="mt-2 text-sm text-muted">
            {t('result.seededNote')}{' '}
            <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
              {t('result.source')}
            </a>
          </p>
        )}
      </div>

      <div className={`rounded-2xl border border-line p-4 ${fade}`} style={stagger(1700)}>
        <Histogram buckets={result.histogram} answer={result.answer} mine={lastGuess} />

        {result.perLocale.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-bold">{t('result.breakdownTitle')}</h3>
            <ul className="mt-2 space-y-1.5">
              {result.perLocale.map((b) => (
                <li key={b.locale} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 truncate" lang={b.locale}>
                    {isLocale(b.locale) ? localeNames[b.locale] : b.locale}
                  </span>
                  <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-track" aria-hidden="true">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-fg" style={{ width: `${b.yesPct}%` }} />
                  </span>
                  <span className="w-24 shrink-0 text-right tnum">
                    <b>{fmt.percent(Number(b.yesPct))}</b>{' '}
                    <span className="text-muted">({fmt.number(b.total)})</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">{t('result.breakdownNote', { min: result.breakdownMin })}</p>
          </div>
        )}
      </div>

      <div className={`flex items-center justify-between gap-4 ${fade}`} style={stagger(1900)}>
        {archive ? (
          <a href={localeHref(locale, '/archive')} className="text-sm font-semibold underline underline-offset-4">
            {t('archive.back')}
          </a>
        ) : (
          <Countdown onZero={onNewDay} />
        )}
        <ShareButton number={number} solvedIn={solvedIn} finalError={finalError} guesses={game.guesses} archive={archive} />
      </div>
    </section>
  );
}
