import type { Metadata } from 'next';
import { intlLocale, locales, type Locale } from '@/i18n/config';
import { loadMessages } from '@/i18n/messages';
import { createTranslator } from '@/i18n/translate';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://guessthecrowd.com';

/** Localized title/description, hreflang alternates and spoiler-free OG images. */
export function pageMetadata(locale: Locale, path: string, titleKey = 'meta.title', opts: { noindex?: boolean } = {}): Metadata {
  const t = createTranslator(locale, loadMessages(locale));
  const title = t(titleKey);
  const description = t('meta.description');
  const languages: Record<string, string> = Object.fromEntries(locales.map((l) => [intlLocale[l], `/${l}${path}`]));
  languages['x-default'] = `/en${path}`;
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: t('app.name'),
    alternates: { canonical: `/${locale}${path}`, languages },
    openGraph: {
      type: 'website',
      siteName: t('app.name'),
      title,
      description,
      url: `/${locale}${path}`,
      locale: intlLocale[locale].replace('-', '_'),
      images: [{ url: `/og/${locale}.png`, width: 1200, height: 630, alt: t('app.name') }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [`/og/${locale}.png`] },
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: '/icons/apple-touch-icon.png',
    },
    robots: opts.noindex ? { index: false, follow: false } : undefined,
  };
}

export async function localeFromParams(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  return (locales as readonly string[]).includes(locale) ? (locale as Locale) : 'en';
}
