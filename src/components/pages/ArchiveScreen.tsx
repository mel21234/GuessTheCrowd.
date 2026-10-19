'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api';
import { getPlayerId } from '@/lib/storage';
import type { ArchiveItem } from '@/lib/types';
import { localeHref } from '../paths';

export function ArchiveScreen() {
  const { t, fmt, locale } = useI18n();
  const [items, setItems] = useState<ArchiveItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<'offline' | 'error' | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const load = useCallback(
    async (before?: number) => {
      setError(null);
      try {
        const r = await api.archive(locale, getPlayerId(), before);
        setItems((cur) => (before && cur ? [...cur, ...r.items] : r.items));
        setHasMore(r.hasMore);
      } catch (e) {
        setError(e instanceof ApiError && e.offline ? 'offline' : 'error');
      }
    },
    [locale],
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t('archive.title')}</h1>
      <p className="mt-2 text-muted">{t('archive.intro')}</p>

      {error && (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-surface p-4">
          <p className="font-semibold">{error === 'offline' ? t('common.offline') : t('common.error')}</p>
          <button type="button" onClick={() => load()} className="rounded-full bg-btn px-4 py-2 font-bold text-btn-fg">
            {t('common.retry')}
          </button>
        </div>
      )}

      {!items && !error && (
        <div className="mt-6 space-y-2" aria-busy="true">
          <span className="sr-only">{t('common.loading')}</span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      )}

      {items && items.length === 0 && <p className="mt-8 rounded-xl bg-surface p-5 text-center">{t('archive.empty')}</p>}

      {items && items.length > 0 && (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {items.map((it) => {
            const show = it.played || revealed.has(it.number);
            return (
              <li key={it.number} className="py-4">
                <div className="flex items-baseline justify-between gap-3 text-sm text-muted tnum">
                  <span>
                    {t('puzzle.number', { number: it.number })} · <time dateTime={it.date}>{fmt.date(it.date)}</time>
                  </span>
                  {it.played && (
                    <span className="font-bold text-fg">
                      {t('archive.score', { score: it.solvedIn ?? 'X' })}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-lg font-bold leading-snug balance">{it.text}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  {show ? (
                    <p className="text-[15px]">
                      <b className="tnum">{t('archive.saidYes', { pct: fmt.percent(Number(it.yesPct), 1) })}</b>{' '}
                      <span className="text-muted">· {t('result.players', { count: it.total })}</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRevealed((s) => new Set(s).add(it.number))}
                      className="text-sm font-semibold text-muted underline underline-offset-4 hover:text-fg"
                    >
                      {t('archive.reveal')}
                    </button>
                  )}
                  {!it.played && (
                    <a
                      href={localeHref(locale, `/archive/${it.number}`)}
                      className="shrink-0 rounded-full bg-btn px-5 py-2 font-bold text-btn-fg hover:opacity-90"
                    >
                      {t('archive.play')}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && items && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            await load(items[items.length - 1].number);
            setLoadingMore(false);
          }}
          className="mt-6 h-12 w-full rounded-full border-2 border-fg font-bold disabled:opacity-50"
        >
          {loadingMore ? t('common.loading') : t('archive.loadMore')}
        </button>
      )}
    </div>
  );
}
