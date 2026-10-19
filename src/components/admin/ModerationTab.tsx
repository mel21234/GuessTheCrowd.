'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import type { AdminSubmission } from '@/lib/types';
import type { AdminCall } from './adminApi';
import { adminErrorText } from './AdminApp';

export function ModerationTab({ call }: { call: AdminCall }) {
  const { t, fmt } = useI18n();
  const [items, setItems] = useState<AdminSubmission[] | null>(null);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [done, setDone] = useState<Record<number, 'approved' | 'rejected'>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await call<AdminSubmission[]>({ action: 'submissions', status: 'pending' }));
    } catch (e) {
      setError(adminErrorText(t, e));
    }
  }, [call, t]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (s: AdminSubmission, decision: 'approve' | 'reject') => {
    setError(null);
    try {
      await call({ action: 'reviewSubmission', id: s.id, decision, text: edits[s.id] ?? s.text });
      setDone((d) => ({ ...d, [s.id]: decision === 'approve' ? 'approved' : 'rejected' }));
    } catch (e) {
      setError(adminErrorText(t, e));
    }
  };

  if (!items) return <p>{error ?? t('common.loading')}</p>;
  const pending = items.filter((s) => !done[s.id]);

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-xl bg-surface p-3 font-semibold">{error}</p>}
      {Object.values(done).includes('approved') && <p className="rounded-xl bg-surface p-3 text-sm">{t('admin.approvedNote')}</p>}
      {pending.length === 0 && <p className="py-6 text-center text-muted">{t('admin.moderationEmpty')}</p>}
      {pending.map((s) => (
        <article key={s.id} className="rounded-2xl border border-line p-4">
          <p className="text-xs text-muted">
            <span className="font-bold uppercase">{s.locale}</span> · {fmt.date(s.createdAt.slice(0, 10))} ·{' '}
            {t('admin.submittedBy', { name: s.nickname || t('admin.anonymous') })}
          </p>
          <textarea
            lang={s.locale}
            rows={2}
            maxLength={200}
            value={edits[s.id] ?? s.text}
            onChange={(e) => setEdits((x) => ({ ...x, [s.id]: e.target.value }))}
            className="mt-2 w-full resize-none rounded-xl border-2 border-line bg-bg px-3 py-2 font-semibold focus:border-fg focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => review(s, 'approve')} className="rounded-full bg-btn px-4 py-2 text-sm font-bold text-btn-fg">
              {t('admin.approve')}
            </button>
            <button type="button" onClick={() => review(s, 'reject')} className="rounded-full border-2 border-fg px-4 py-2 text-sm font-bold">
              {t('admin.reject')}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
