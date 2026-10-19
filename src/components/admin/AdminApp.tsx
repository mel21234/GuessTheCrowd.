'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { getAdminAuth, type AdminAuth, type AdminSession } from '@/lib/adminAuth';
import { AdminApiError, makeAdminCall, type AdminCall } from './adminApi';
import { ScheduleTab } from './ScheduleTab';
import { QuestionsTab } from './QuestionsTab';
import { ModerationTab } from './ModerationTab';

type Tab = 'schedule' | 'questions' | 'moderation';

export function AdminApp() {
  const { t } = useI18n();
  const [auth, setAuth] = useState<AdminAuth | null | undefined>(undefined);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<Tab>('schedule');

  useEffect(() => {
    getAdminAuth().then(async (a) => {
      setAuth(a);
      if (a) setSession(await a.getSession());
    });
  }, []);

  const signOut = useCallback(async () => {
    await auth?.signOut();
    setSession(null);
    setForbidden(false);
  }, [auth]);

  const call: AdminCall | null = useMemo(() => {
    if (!session) return null;
    const raw = makeAdminCall(session.token);
    return async <T,>(body: Record<string, unknown>) => {
      try {
        return await raw<T>(body);
      } catch (e) {
        if (e instanceof AdminApiError && e.status === 403) setForbidden(true);
        if (e instanceof AdminApiError && e.status === 401) setSession(null);
        throw e;
      }
    };
  }, [session]);

  const wrap = 'mx-auto w-full max-w-[1000px] px-4 py-6';

  if (auth === undefined) return <div className={wrap}>{t('common.loading')}</div>;
  if (auth === null) return <div className={wrap}><p className="rounded-xl bg-surface p-4">{t('admin.notConfigured')}</p></div>;
  if (!session) return <SignIn auth={auth} onSession={setSession} />;
  if (forbidden)
    return (
      <div className={wrap}>
        <p className="rounded-xl bg-surface p-4 font-semibold">{t('admin.forbidden')}</p>
        <button type="button" onClick={signOut} className="mt-4 font-bold underline">{t('admin.signOut')}</button>
      </div>
    );

  return (
    <div className={wrap}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('admin.title')}</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{session.email}</span>
          <button type="button" onClick={signOut} className="font-bold underline underline-offset-4">
            {t('admin.signOut')}
          </button>
        </div>
      </div>
      <div role="tablist" className="mt-5 flex gap-1 border-b border-line">
        {(['schedule', 'questions', 'moderation'] as Tab[]).map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-[3px] px-4 py-2.5 font-bold ${tab === k ? 'border-fg' : 'border-transparent text-muted hover:text-fg'}`}
          >
            {t(`admin.tabs.${k}`)}
          </button>
        ))}
      </div>
      <div className="pt-5" role="tabpanel">
        {call && tab === 'schedule' && <ScheduleTab call={call} />}
        {call && tab === 'questions' && <QuestionsTab call={call} />}
        {call && tab === 'moderation' && <ModerationTab call={call} />}
      </div>
    </div>
  );
}

function SignIn({ auth, onSession }: { auth: AdminAuth; onSession: (s: AdminSession) => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = 'mt-1 w-full rounded-xl border-2 border-line bg-bg px-4 py-3 focus:border-fg focus:outline-none';
  return (
    <form
      className="mx-auto w-full max-w-[380px] px-4 py-10"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const s = await auth.signIn(email, password);
        setBusy(false);
        if (s) onSession(s);
        else setError(true);
      }}
    >
      <h1 className="text-2xl font-extrabold">{t('admin.signInTitle')}</h1>
      <label className="mt-6 block font-bold">
        {t('admin.email')}
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </label>
      <label className="mt-4 block font-bold">
        {t('admin.password')}
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      </label>
      {error && <p role="alert" className="mt-4 font-semibold">{t('admin.signInError')}</p>}
      <button type="submit" disabled={busy} className="mt-6 h-12 w-full rounded-full bg-btn font-bold text-btn-fg disabled:opacity-60">
        {t('admin.signIn')}
      </button>
    </form>
  );
}

export function adminErrorText(t: (k: string) => string, e: unknown): string {
  const code = e instanceof AdminApiError ? e.code : 'generic';
  const key = `admin.errors.${code}`;
  const msg = t(key);
  return msg === key ? t('admin.errors.generic') : msg;
}
