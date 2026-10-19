import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Figtree } from 'next/font/google';
import '../globals.css';
import { isLocale, locales } from '@/i18n/config';
import { loadMessages } from '@/i18n/messages';
import { I18nProvider } from '@/i18n/I18nProvider';
import { AppShell } from '@/components/AppShell';
import { SETTINGS_BOOT_SCRIPT } from '@/lib/storage';
import { localeFromParams, pageMetadata } from '../metadata';

// Latin Extended covers Estonian (õ ä ö ü š ž) and Spanish (ñ á ¿ ¡).
const figtree = Figtree({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-figtree',
});

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(await localeFromParams(params), '');
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#141415' },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} className={figtree.variable} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SETTINGS_BOOT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider locale={locale} messages={loadMessages(locale)}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
