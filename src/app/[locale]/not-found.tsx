'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { localeHref } from '@/components/paths';

export default function NotFound() {
  const { t, locale } = useI18n();
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-16 text-center">
      <h1 className="text-3xl font-extrabold">{t('notFound.title')}</h1>
      <p className="mt-2 text-muted">{t('notFound.body')}</p>
      <a href={localeHref(locale)} className="mt-6 inline-block font-bold underline underline-offset-4">
        {t('nav.backToGame')}
      </a>
    </div>
  );
}
