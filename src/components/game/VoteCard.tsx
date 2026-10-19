'use client';

import { useCallback, useState } from 'react';
import { Turnstile } from './Turnstile';
import { useI18n } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api';
import { getPlayerId } from '@/lib/storage';
import type { TodayResponse } from '@/lib/types';

type Problem = 'error' | 'offline' | 'closed' | 'rate_limited' | 'challenge_failed' | null;

/** "Answer today's question" — these votes become tomorrow's puzzle. */
export function VoteCard({
  today,
  compact = false,
  bare = false,
  onVoted,
}: {
  today: TodayResponse;
  compact?: boolean;
  /** Inside a dialog: no box, no heading (the dialog has its own). */
  bare?: boolean;
  onVoted?: (answer: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const q = today.question;
  const [voted, setVoted] = useState<boolean | null>(today.myVote);
  const [busy, setBusy] = useState<boolean | null>(null); // which answer is being sent
  const [problem, setProblem] = useState<Problem>(null);
  const [challenge, setChallenge] = useState<{ siteKey: string; answer: boolean } | null>(null);

  const send = useCallback(
    async (answer: boolean, token?: string) => {
      if (!q) return;
      setBusy(answer);
      setProblem(null);
      try {
        const r = await api.vote(q.id, getPlayerId(), answer, locale, token);
        setChallenge(null);
        if (r.status === 'ok' || r.status === 'duplicate') {
          setVoted(answer);
          onVoted?.(answer);
        }
        else if (r.status === 'challenge_required' && r.siteKey) setChallenge({ siteKey: r.siteKey, answer });
        else if (r.status === 'challenge_failed') setProblem('challenge_failed');
        else if (r.status === 'closed' || r.status === 'rate_limited') setProblem(r.status);
        else setProblem('error');
      } catch (e) {
        setProblem(e instanceof ApiError && e.offline ? 'offline' : 'error');
      } finally {
        setBusy(null);
      }
    },
    [q, locale, onVoted],
  );

  const onToken = useCallback((token: string) => challenge && send(challenge.answer, token), [challenge, send]);
  const onChallengeError = useCallback(() => setProblem('challenge_failed'), []);

  const box = bare ? '' : `rounded-2xl bg-surface ${compact ? 'p-4' : 'p-5'}`;
  const heading = bare ? 'sr-only' : 'text-sm font-bold text-muted';

  if (!q) {
    return (
      <section className={box}>
        <h2 className="font-bold">{t('vote.title')}</h2>
        <p className="mt-1 text-muted">{t('vote.none')}</p>
      </section>
    );
  }

  if (voted !== null) {
    return (
      <section className={box} aria-live="polite">
        <h2 className={heading}>{t('vote.title')}</h2>
        <p className="mt-1 text-lg font-bold leading-snug balance">{q.text}</p>
        <p className="mt-3 font-semibold">
          {t('vote.thanks')} {t('vote.youAnswered', { answer: voted ? t('common.yes') : t('common.no') })}
        </p>
        <p className="mt-1 text-sm text-muted">{t('vote.comeBack')}</p>
      </section>
    );
  }

  const problemText: Record<Exclude<Problem, null>, string> = {
    error: t('vote.error'),
    offline: t('common.offline'),
    closed: t('vote.closed'),
    rate_limited: t('vote.rateLimited'),
    challenge_failed: t('vote.challengeFailed'),
  };

  const answerBtn =
    'h-14 flex-1 rounded-full border-2 border-fg text-lg font-extrabold transition-colors hover:bg-fg hover:text-bg disabled:opacity-50';

  return (
    <section className={box} aria-labelledby="vote-heading">
      <h2 id="vote-heading" className={heading}>
        {t('vote.title')}
      </h2>
      <p className="mt-1 text-2xl font-extrabold leading-tight balance">{q.text}</p>
      <p className="mt-2 text-sm text-muted">{t('vote.subtitle')}</p>
      <div className="mt-4 flex gap-3">
        <button type="button" className={answerBtn} disabled={busy !== null} onClick={() => send(true)}>
          {t('common.yes')}
        </button>
        <button type="button" className={answerBtn} disabled={busy !== null} onClick={() => send(false)}>
          {t('common.no')}
        </button>
      </div>
      {challenge && (
        <div className="mt-4">
          <p className="mb-2 text-sm">{t('vote.challenge')}</p>
          <Turnstile siteKey={challenge.siteKey} locale={locale} onToken={onToken} onError={onChallengeError} />
        </div>
      )}
      {problem && (
        <p role="alert" className="mt-3 text-sm font-semibold">
          {problemText[problem]}
        </p>
      )}
    </section>
  );
}
