/** Locale-aware formatting via Intl. */
import { intlLocale, type Locale } from '@/i18n/config';

export interface Formatter {
  number(n: number): string;
  /** 62 -> "62%" / "62 %" depending on locale. */
  percent(pct: number, maxFractionDigits?: number): string;
  /** A UTC calendar date ("2026-10-18") in the reader's language. */
  date(dateStr: string, style?: 'long' | 'medium'): string;
  /** A wall-clock time in the reader's own time zone. */
  localTime(d: Date): string;
}

export function createFormatter(locale: Locale): Formatter {
  const tag = intlLocale[locale];
  const num = new Intl.NumberFormat(tag);
  const pctCache = new Map<number, Intl.NumberFormat>();
  return {
    number: (n) => num.format(n),
    percent(pct, digits = 0) {
      let f = pctCache.get(digits);
      if (!f) {
        f = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: digits });
        pctCache.set(digits, f);
      }
      return f.format(pct / 100);
    },
    date(dateStr, style = 'medium') {
      const d = new Date(`${dateStr}T12:00:00Z`);
      return new Intl.DateTimeFormat(tag, {
        timeZone: 'UTC',
        dateStyle: style,
      }).format(d);
    },
    localTime(d) {
      return new Intl.DateTimeFormat(tag, { hour: 'numeric', minute: '2-digit' }).format(d);
    },
  };
}
