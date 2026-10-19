'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { useI18n } from '@/i18n/I18nProvider';
import type { AdminQuestion, AdminStats, QuestionStatus } from '@/lib/types';
import type { AdminCall } from './adminApi';
import { adminErrorText } from './AdminApp';

const STATUS_STYLE: Record<QuestionStatus, string> = {
  draft: 'bg-surface text-fg ring-1 ring-line',
  scheduled: 'bg-close text-tile-ink',
  live: 'bg-correct text-tile-ink',
  closed: 'bg-miss text-tile-ink',
  void: 'bg-transparent text-muted ring-1 ring-line line-through',
};

export function StatusBadge({ status }: { status: QuestionStatus }) {
  const { t } = useI18n();
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[status]}`}>
      {t(`admin.status.${status}`)}
    </span>
  );
}

export function ReadyBadge({ ready }: { ready: boolean }) {
  const { t } = useI18n();
  return (
    <span className={`text-xs font-bold ${ready ? 'text-correct-ink' : 'text-close-ink'}`}>
      {ready ? t('admin.ready') : t('admin.notReady')}
    </span>
  );
}

export function questionText(q: AdminQuestion, locale: string): string {
  return q.translations[locale]?.text ?? q.translations.en?.text ?? Object.values(q.translations)[0]?.text ?? '—';
}

/** Translation editor: one text + "reviewed" checkbox per active language. */
export function QuestionEditor({
  call,
  question,
  locales,
  open,
  onClose,
  onSaved,
}: {
  call: AdminCall;
  question: AdminQuestion | null; // null = new
  locales: { code: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onSaved: (q: AdminQuestion) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Record<string, { text: string; reviewed: boolean }>>({});
  const [minVotes, setMinVotes] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const d: Record<string, { text: string; reviewed: boolean }> = {};
    for (const l of locales) {
      const tr = question?.translations[l.code];
      d[l.code] = { text: tr?.text ?? '', reviewed: tr?.reviewed ?? false };
    }
    setDraft(d);
    setMinVotes(question?.minVotes ?? 100);
    setError(null);
  }, [open, question, locales]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const q = await call<AdminQuestion>({ action: 'saveQuestion', id: question?.id ?? null, translations: draft, minVotes });
      onSaved(q);
      onClose();
    } catch (e) {
      setError(adminErrorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={question ? `${t('admin.edit')} · #${question.id}` : t('admin.newQuestion')}>
      <div className="space-y-4">
        {locales.map((l) => (
          <div key={l.code}>
            <div className="flex items-center justify-between">
              <label htmlFor={`tr-${l.code}`} className="font-bold">
                {l.name} <span className="text-xs uppercase text-muted">{l.code}</span>
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={draft[l.code]?.reviewed ?? false}
                  disabled={!draft[l.code]?.text.trim()}
                  onChange={(e) => setDraft((d) => ({ ...d, [l.code]: { ...d[l.code], reviewed: e.target.checked } }))}
                  className="size-4 accent-current"
                />
                {t('admin.reviewed')}
              </label>
            </div>
            <textarea
              id={`tr-${l.code}`}
              lang={l.code}
              rows={2}
              maxLength={200}
              value={draft[l.code]?.text ?? ''}
              placeholder={t('admin.translationMissing')}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [l.code]: { text: e.target.value, reviewed: e.target.value.trim() ? d[l.code]?.reviewed ?? false : false } }))
              }
              className="mt-1 w-full resize-none rounded-xl border-2 border-line bg-bg px-3 py-2 focus:border-fg focus:outline-none"
            />
          </div>
        ))}
        <label className="block text-sm font-bold">
          {t('admin.minVotes')}
          <input
            type="number"
            min={1}
            value={minVotes}
            onChange={(e) => setMinVotes(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 block w-32 rounded-xl border-2 border-line bg-bg px-3 py-2 tnum"
          />
        </label>
        {error && <p role="alert" className="rounded-xl bg-surface p-3 text-sm font-semibold">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2.5 font-bold text-muted hover:text-fg">
            {t('admin.cancel')}
          </button>
          <button type="button" onClick={save} disabled={busy} className="rounded-full bg-btn px-6 py-2.5 font-bold text-btn-fg disabled:opacity-60">
            {t('admin.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Live numbers for one question — straight from the database. */
export function QuestionStatsModal({ call, id, onClose }: { call: AdminCall; id: number | null; onClose: () => void }) {
  const { t, fmt, locale } = useI18n();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null) return;
    setStats(null);
    setError(null);
    call<AdminStats>({ action: 'stats', id }).then(setStats, (e) => setError(adminErrorText(t, e)));
  }, [id, call, t]);

  const maxHour = Math.max(1, ...(stats?.perHour.map((h) => h.votes) ?? [1]));
  return (
    <Modal open={id !== null} onClose={onClose} title={t('admin.stats')}>
      {error && <p className="font-semibold">{error}</p>}
      {!stats && !error && <p>{t('common.loading')}</p>}
      {stats && (
        <div className="space-y-4 text-sm">
          <p className="text-base font-bold leading-snug">{questionText(stats.question, locale)}</p>
          <dl className="grid grid-cols-2 gap-3">
            <Num label={t('admin.votes')} value={fmt.number(stats.votes)} />
            <Num label={t('admin.yesPct')} value={stats.yesPct === null ? '–' : fmt.percent(Number(stats.yesPct), 1)} />
            <Num label={t('admin.guessesStarted')} value={fmt.number(stats.guesses.started)} />
            <Num label={t('admin.guessesFinished')} value={fmt.number(stats.guesses.finished)} />
            <Num label={t('admin.guessesSolved')} value={fmt.number(stats.guesses.solved)} />
            <Num label={t('admin.avgError')} value={stats.guesses.avgError === null ? '–' : fmt.number(Number(stats.guesses.avgError))} />
          </dl>
          <div>
            <h3 className="font-bold">{t('admin.perLocale')}</h3>
            {stats.perLocale.length === 0 ? (
              <p className="text-muted">{t('admin.noData')}</p>
            ) : (
              <ul className="mt-1">
                {stats.perLocale.map((p) => (
                  <li key={p.locale} className="flex justify-between tnum">
                    <span className="uppercase">{p.locale}</span>
                    <span>
                      {fmt.number(p.total)} · {fmt.percent(Number(p.yesPct), 1)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-bold">{t('admin.perHour')}</h3>
            {stats.perHour.length === 0 ? (
              <p className="text-muted">{t('admin.noData')}</p>
            ) : (
              <ol className="mt-2 flex h-20 items-end gap-px">
                {stats.perHour.map((h) => (
                  <li
                    key={h.hour}
                    title={`${h.hour.slice(0, 13).replace('T', ' ')}:00 — ${h.votes}`}
                    className="flex-1 rounded-t-sm bg-fg"
                    style={{ height: `${Math.max(4, (h.votes / maxHour) * 100)}%` }}
                  />
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Num({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xl font-extrabold tnum">{value}</dd>
    </div>
  );
}
