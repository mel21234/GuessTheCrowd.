'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { addDays, parseUtcDate } from '@/lib/time';
import type { AdminDashboard, AdminQuestion } from '@/lib/types';
import type { AdminCall } from './adminApi';
import { adminErrorText } from './AdminApp';
import { QuestionEditor, QuestionStatsModal, ReadyBadge, StatusBadge, questionText } from './shared';

const DAYS = 42;

function mondayOnOrBefore(dateStr: string): string {
  const dow = (parseUtcDate(dateStr).getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(dateStr, -dow);
}

export function ScheduleTab({ call }: { call: AdminCall }) {
  const { t, fmt, locale } = useI18n();
  const [from, setFrom] = useState<string | null>(null);
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [ready, setReady] = useState<AdminQuestion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [statsId, setStatsId] = useState<number | null>(null);
  const [assignId, setAssignId] = useState('');
  const [moveDate, setMoveDate] = useState('');

  const load = useCallback(
    async (start: string | null) => {
      setError(null);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const f = start ?? addDays(mondayOnOrBefore(today), -7);
        const [d, drafts] = await Promise.all([
          call<AdminDashboard>({ action: 'dashboard', from: f, days: DAYS }),
          call<AdminQuestion[]>({ action: 'questions', status: 'draft' }),
        ]);
        setFrom(f);
        setData(d);
        setReady(drafts.filter((q) => q.ready));
      } catch (e) {
        setError(adminErrorText(t, e));
      }
    },
    [call, t],
  );

  useEffect(() => {
    load(null);
  }, [load]);

  const act = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    try {
      await call(body);
      await load(from);
    } catch (e) {
      setError(adminErrorText(t, e));
    }
  };

  if (!data || !from) return <p>{error ?? t('common.loading')}</p>;

  const day = selected ? data.calendar.find((c) => c.date === selected) : null;
  const q = day?.question ?? null;
  const future = selected ? selected > data.today : false;
  const locales = data.locales.filter((l) => l.active);

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl p-4 font-semibold ${data.scheduledAhead < 14 ? 'bg-close text-tile-ink' : 'bg-surface'}`}
        role={data.scheduledAhead < 14 ? 'alert' : undefined}
      >
        {data.scheduledAhead < 14
          ? t('admin.warningSchedule', { count: data.scheduledAhead, date: data.firstGap ? fmt.date(data.firstGap) : '—' })
          : t('admin.scheduledOk')}
        {data.pendingSubmissions > 0 && (
          <span className="block text-sm font-normal">{t('admin.pendingSubmissions', { count: data.pendingSubmissions })}</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => load(addDays(from, -28))} className="rounded-full px-3 py-1.5 font-bold hover:bg-surface">
          ‹ {t('admin.prevWeeks')}
        </button>
        <span className="text-sm text-muted">
          {t('admin.today')}: {fmt.date(data.today)}
        </span>
        <button type="button" onClick={() => load(addDays(from, 28))} className="rounded-full px-3 py-1.5 font-bold hover:bg-surface">
          {t('admin.nextWeeks')} ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {data.calendar.map((c) => {
          const isToday = c.date === data.today;
          const past = c.date < data.today;
          const status = c.question?.status;
          return (
            <button
              key={c.date}
              type="button"
              onClick={() => {
                setSelected(c.date);
                setMoveDate('');
                setAssignId('');
              }}
              aria-pressed={selected === c.date}
              className={[
                'flex min-h-20 flex-col rounded-lg p-1.5 text-left text-xs ring-1 transition',
                selected === c.date ? 'ring-2 ring-fg' : 'ring-line',
                past ? 'opacity-60' : '',
                isToday ? 'bg-surface' : '',
              ].join(' ')}
            >
              <span className={`font-bold tnum ${isToday ? 'underline' : ''}`}>
                {fmt.date(c.date).replace(/,?\s*\d{4}\.?$/, '')}
              </span>
              {c.question ? (
                <>
                  <span className="mt-0.5 line-clamp-2 leading-tight">{questionText(c.question, locale)}</span>
                  <span className="mt-auto pt-1">{status && <StatusBadge status={status} />}</span>
                </>
              ) : (
                !past && <span className="mt-auto text-muted">{t('admin.empty')}</span>
              )}
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="rounded-xl bg-surface p-3 font-semibold">{error}</p>}

      <section className="rounded-2xl border border-line p-4">
        {!selected && <p className="text-muted">{t('admin.selectDay')}</p>}
        {selected && (
          <>
            <h2 className="font-extrabold">{fmt.date(selected, 'long')}</h2>
            {q ? (
              <div className="mt-2 space-y-3">
                <p className="text-lg font-bold leading-snug">{questionText(q, locale)}</p>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusBadge status={q.status} /> <ReadyBadge ready={q.ready} />
                  {q.number !== null && <span className="text-muted">#{q.number}</span>}
                  <span className="text-muted">{t('admin.votes')}: {fmt.number(q.votes)}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {q.status === 'scheduled' && (
                    <button type="button" onClick={() => setEditing(q)} className="rounded-full border-2 border-fg px-4 py-1.5 font-bold">
                      {t('admin.edit')}
                    </button>
                  )}
                  <button type="button" onClick={() => setStatsId(q.id)} className="rounded-full border-2 border-fg px-4 py-1.5 font-bold">
                    {t('admin.stats')}
                  </button>
                  {q.status === 'scheduled' && future && (
                    <button type="button" onClick={() => act({ action: 'unschedule', id: q.id })} className="rounded-full border-2 border-fg px-4 py-1.5 font-bold">
                      {t('admin.unschedule')}
                    </button>
                  )}
                  {q.status !== 'void' && (
                    <button type="button" onClick={() => act({ action: 'void', id: q.id }, t('admin.voidConfirm'))} className="rounded-full border-2 border-fg px-4 py-1.5 font-bold">
                      {t('admin.void')}
                    </button>
                  )}
                </div>
                {q.status === 'scheduled' && future && (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-sm font-bold">
                      {t('admin.moveTo')}
                      <input
                        type="date"
                        min={addDays(data.today, 1)}
                        value={moveDate}
                        onChange={(e) => setMoveDate(e.target.value)}
                        className="mt-1 block rounded-xl border-2 border-line bg-bg px-3 py-1.5"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!moveDate}
                      onClick={() => act({ action: 'schedule', id: q.id, date: moveDate })}
                      className="rounded-full bg-btn px-5 py-2 font-bold text-btn-fg disabled:opacity-50"
                    >
                      {t('admin.move')}
                    </button>
                  </div>
                )}
              </div>
            ) : selected >= data.today ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                {ready.length === 0 ? (
                  <p className="text-muted">{t('admin.noReady')}</p>
                ) : (
                  <>
                    <label className="min-w-0 flex-1 text-sm font-bold">
                      {t('admin.assign')}
                      <select
                        value={assignId}
                        onChange={(e) => setAssignId(e.target.value)}
                        className="mt-1 block w-full rounded-xl border-2 border-line bg-bg px-3 py-2"
                      >
                        <option value="">{t('admin.assignPlaceholder')}</option>
                        {ready.map((r) => (
                          <option key={r.id} value={r.id}>
                            #{r.id} — {questionText(r, locale)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={!assignId}
                      onClick={() => act({ action: 'schedule', id: Number(assignId), date: selected })}
                      className="rounded-full bg-btn px-5 py-2.5 font-bold text-btn-fg disabled:opacity-50"
                    >
                      {t('admin.assignButton')}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <p className="mt-2 text-muted">{t('admin.noData')}</p>
            )}
          </>
        )}
      </section>

      <QuestionEditor
        call={call}
        question={editing}
        locales={locales}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={() => load(from)}
      />
      <QuestionStatsModal call={call} id={statsId} onClose={() => setStatsId(null)} />
    </div>
  );
}
