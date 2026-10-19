import { locales, type Locale } from '@/i18n/config';

export function localeHref(locale: Locale, path = ''): string {
  return `/${locale}${path}`;
}

/** The current path with its locale prefix swapped. */
export function swapLocaleInPath(pathname: string, next: Locale): string {
  const re = new RegExp(`^/(${locales.join('|')})(?=/|$)`);
  return re.test(pathname) ? pathname.replace(re, `/${next}`) : `/${next}${pathname === '/' ? '' : pathname}`;
}
