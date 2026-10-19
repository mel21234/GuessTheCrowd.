'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Locale } from './config';
import { createTranslator, type Messages, type Translator } from './translate';
import { createFormatter, type Formatter } from '@/lib/format';

interface I18nValue {
  locale: Locale;
  t: Translator;
  fmt: Formatter;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  fallback,
  children,
}: {
  locale: Locale;
  messages: Messages;
  fallback?: Messages;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({ locale, t: createTranslator(locale, messages, fallback), fmt: createFormatter(locale) }),
    [locale, messages, fallback],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}
