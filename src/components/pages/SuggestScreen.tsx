'use client';

import { useId, useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api';
import { containsProfanity } from '@/lib/profanity';
import type { SuggestError } from '@/lib/types';

const MIN = 8;
const MAX = 120;

export function SuggestScreen() {
  const { t, locale } = useI18n();
  const [text, setText] = useState('');
  const [nickname, setNickname] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<SuggestError | 'generic' | 'offline' | null>(null);
  const ids = { text: useId(), hint: useId(), nick: useId(), err: useId(), hp: useId() };

  const errorText = (e: NonNullable<typeof error>) => {
    switch (e) {
      case 'too_short':
        return t('suggest.errors.tooShort');
      case 'too_long':
        return t('suggest.errors.tooLong', { max: MAX });
      case 'profanity':
        return t('suggest.errors.profanity');
      case 'rate_limited':
        return t('suggest.errors.rateLimited');
      case 'offline':
        return t('common.offline');
      default:
        return t('suggest.errors.generic');
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length < MIN) return setError('too_short');
    if (clean.length > MAX) return setError('too_long');
    if (containsProfanity(clean) || containsProfanity(nickname)) return setError('profanity');
    setError(null);
    setState('sending');
    try {
      const r = await api.suggest(clean, nickname, locale, website);
      if (r.status === 'ok') {
        setState('done');
        return;
      }
      setError(r.error ?? 'generic');
    } catch (err) {
      setError(err instanceof ApiError && err.offline ? 'offline' : 'generic');
    }
    setState('idle');
  };

  if (state === 'done') {
    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-10 text-center" aria-live="polite">
        <h1 className="text-2xl font-extrabold">{t('suggest.success')}</h1>
        <button
          type="button"
          onClick={() => {
            setText('');
            setState('idle');
          }}
          className="mt-6 h-12 rounded-full border-2 border-fg px-6 font-bold"
        >
          {t('suggest.another')}
        </button>
      </div>
    );
  }

  const field = 'w-full rounded-xl border-2 border-line bg-bg px-4 py-3 text-[17px] focus:border-fg focus:outline-none';

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t('suggest.title')}</h1>
      <p className="mt-2 text-muted">{t('suggest.intro')}</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor={ids.text} className="font-bold">
              {t('suggest.label')}
            </label>
            <span className={`text-sm tnum ${text.length > MAX ? 'font-bold' : 'text-muted'}`} aria-hidden="true">
              {t('suggest.counter', { count: text.length, max: MAX })}
            </span>
          </div>
          <textarea
            id={ids.text}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={MAX + 20}
            placeholder={t('suggest.placeholder')}
            aria-describedby={`${ids.hint} ${error ? ids.err : ''}`}
            aria-invalid={error === 'too_short' || error === 'too_long' || error === 'profanity'}
            className={`${field} mt-1.5 resize-none`}
          />
          <p id={ids.hint} className="mt-1.5 text-sm text-muted">
            {t('suggest.hint')}
          </p>
        </div>

        <div>
          <label htmlFor={ids.nick} className="font-bold">
            {t('suggest.nickname')}
          </label>
          <input
            id={ids.nick}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            autoComplete="nickname"
            className={`${field} mt-1.5`}
          />
        </div>

        {/* Honeypot: hidden from people and screen readers, irresistible to bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor={ids.hp}>{t('suggest.honeypot')}</label>
          <input id={ids.hp} tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
        </div>

        {error && (
          <p id={ids.err} role="alert" className="rounded-xl bg-surface px-4 py-3 font-semibold">
            {errorText(error)}
          </p>
        )}

        <button
          type="submit"
          disabled={state === 'sending'}
          className="h-14 w-full rounded-full bg-btn text-lg font-extrabold text-btn-fg hover:opacity-90 disabled:opacity-60"
        >
          {state === 'sending' ? t('suggest.sending') : t('suggest.submit')}
        </button>
      </form>
    </div>
  );
}
