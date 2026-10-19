'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import type { AdminDashboard, AdminQuestion, QuestionStatus } from '@/lib/types';
import type { AdminCall } from './adminApi';
import { adminErrorText } from './AdminApp';
import { QuestionEditor, QuestionStatsModal, ReadyBadge, StatusBadge, questionText } from './shared';

const STATUSES: QuestionStatus[] = ['draft', 'scheduled', 'live', 'closed', 'void'];

export function QuestionsTab({ call }: { call: AdminCall }) {
  const { t, fmt, locale } = useI18n();
  const [status, setStatus] = useState<QuestionStatus | ''>('draft');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<AdminQuestion[] | null>(null);
  const [locales, setLocales] = useState<{ code: string; name: string }[]>([]);
  const [editing, setEditing] = useState<AdminQuestion | 'new' | null>(null);
  const [statsId, setStatsId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [list, dash] = await Promise.all([
        call<AdminQuestion[]>({ action: 'questions', status: status || undefined, search: search.trim() || undefined }),
        locales.length ? Promise.resolve(null) : call<AdminDashboard>({ action: 'dashboard', from: today, days: 1 }),
      ]);
      setItems(list);
      if (dash) setLocales(dash.locales.filter((l) => l.active));
    } catch (e) {
      setError(adminErrorText(t, e));
    }
  }, [call, status, search, locales.length, t]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const act = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await call(body);
      await load();
    } catch (e) {
      setError(adminErrorText(t, e));
    }
  };

  const btn = 'rounded-full border-2 border-fg px-3 py-1 text-sm font-bold';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm font-bold">
          <span className="sr-only">{t('admin.statusFilter')}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as QuestionStatus | '')}
            className="rounded-xl border-2 border-line bg-bg px-3 py-2"
          >
            <option value="">{t('admin.filterAll')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`admin.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.search')}
          aria-label={t('admin.search')}
          className="min-w-0 flex-1 rounded-xl border-2 border-line bg-bg px-3 py-2"
        />
        <button type="button" onClick={() => setEditing('new')} className="rounded-full bg-btn px-5 py-2.5 font-bold text-btn-fg">
          {t('admin.newQuestion')}
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-surface p-3 font-semibold">{error}</p>}
      {!items && !error && <p>{t('common.loading')}</p>}

      {items && (
        <ul className="divide-y divide-line border-y border-line">
          {items.length === 0 && <li className="py-6 text-center text-muted">{t('admin.noData')}</li>}
          {items.map((q) => (
            <li key={q.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="tnum">#{q.id}</span>
                  <StatusBadge status={q.status} />
                  <ReadyBadge ready={q.ready} />
                  {q.date && <span className="tnum">{fmt.date(q.date)}</span>}
                  {q.source === 'community' && <span>{t('admin.sourceCommunity')}</span>}
                </p>
                <p className="mt-1 font-semibold leading-snug">{questionText(q, locale)}</p>
                <p className="mt-1 flex gap-1.5">
                  {locales.map((l) => {
                    const tr = q.translations[l.code];
                    return (
                      <span
                        key={l.code}
                        title={tr ? (tr.reviewed ? t('admin.reviewed') : t('admin.notReady')) : t('admin.translationMissing')}
                        className={`rounded px-1.5 text-[11px] font-bold uppercase ${
                          !tr ? 'text-muted ring-1 ring-line' : tr.reviewed ? 'bg-correct text-tile-ink' : 'bg-close text-tile-ink'
                        }`}
                      >
                        {l.code}
                        {tr ? (tr.reviewed ? ' ✓' : ' ?') : ' –'}
                      </span>
                    );
                  })}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {(q.status === 'draft' || q.status === 'scheduled') && (
                  <button type="button" className={btn} onClick={() => setEditing(q)}>
                    {t('admin.edit')}
                  </button>
                )}
                <button type="button" className={btn} onClick={() => setStatsId(q.id)}>
                  {t('admin.stats')}
                </button>
                {(q.status === 'draft' || q.status === 'void') && q.votes === 0 && (
                  <button type="button" className={btn} onClick={() => act({ action: 'delete', id: q.id }, t('admin.deleteConfirm'))}>
                    {t('admin.delete')}
                  </button>
                )}
                {q.status !== 'void' && q.status !== 'draft' && (
                  <button type="button" className={btn} onClick={() => act({ action: 'void', id: q.id }, t('admin.voidConfirm'))}>
                    {t('admin.void')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <QuestionEditor
        call={call}
        question={editing === 'new' ? null : editing}
        locales={locales}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={() => load()}
      />
      <QuestionStatsModal call={call} id={statsId} onClose={() => setStatsId(null)} />
    </div>
  );
}
