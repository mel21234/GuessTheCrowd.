/**
 * Supported languages. To add one:
 *   1. add locales/<code>.json (copy en.json and translate),
 *   2. register it below (and in loadMessages),
 *   3. insert it into app_locales in the database and translate questions.
 */
export const locales = ['en', 'et', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Endonyms shown in the language switcher. */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  et: 'Eesti',
  es: 'Español',
};

/** BCP-47 tags used for Intl formatting and hreflang. */
export const intlLocale: Record<Locale, string> = {
  en: 'en',
  et: 'et-EE',
  es: 'es',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Best match for navigator.languages, or null if none is supported. */
export function matchBrowserLocale(languages: readonly string[]): Locale | null {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return null;
}

export const LOCALE_STORAGE_KEY = 'gtc:locale';
