'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { LOCALE_STORAGE_KEY, localeNames, matchBrowserLocale, type Locale } from '@/i18n/config';
import { flags, getSavedLocale } from '@/lib/storage';
import { switchLocale } from './LanguageSwitcher';

/**
 * Suggests (never forces) the browser's language on a first visit, when the
 * player hasn't chosen a language yet.
 */
export function LanguageSuggestion() {
  const { t, locale } = useI18n();
  const [suggest, setSuggest] = useState<Locale | null>(null);

  useEffect(() => {
    if (getSavedLocale(LOCALE_STORAGE_KEY) || flags.langSuggestDismissed()) return;
    const match = matchBrowserLocale(navigator.languages ?? [navigator.language]);
    if (match && match !== locale) setSuggest(match);
  }, [locale]);

  if (!suggest) return null;
  return (
    <div lang={suggest} className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[480px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <span>{t('langSuggest.text', { language: localeNames[suggest] })}</span>
        <span className="flex gap-1">
          <button
            type="button"
            onClick={() => switchLocale(suggest)}
            className="rounded-full bg-btn px-3 py-1 font-bold text-btn-fg"
          >
            {t('langSuggest.switch')}
          </button>
          <button
            type="button"
            onClick={() => {
              flags.dismissLangSuggest();
              setSuggest(null);
            }}
            className="rounded-full px-3 py-1 font-semibold text-muted hover:text-fg"
          >
            {t('langSuggest.dismiss')}
          </button>
        </span>
      </div>
    </div>
  );
}
