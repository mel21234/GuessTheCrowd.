/**
 * Tiny, dependency-free translator.
 *   t('game.guess')                         -> "Guess"
 *   t('result.players', { count: 12840 })   -> "12,840 players" (plural + Intl number)
 *   t('vote.youSaid', { answer: 'Yes' })    -> "You answered Yes."
 * Plural entries are objects keyed by Intl.PluralRules categories (one, other, …).
 */
import { intlLocale, type Locale } from './config';

export type Messages = { [key: string]: string | string[] | Messages };
export type Vars = Record<string, string | number>;
export type Translator = ((key: string, vars?: Vars) => string) & {
  list: (key: string) => string[];
  has: (key: string) => boolean;
  locale: Locale;
};

function lookup(messages: Messages, key: string): unknown {
  let cur: unknown = messages;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as object)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

export function createTranslator(locale: Locale, messages: Messages, fallback?: Messages): Translator {
  const tag = intlLocale[locale];
  const plural = new Intl.PluralRules(tag);
  const number = new Intl.NumberFormat(tag);

  const resolve = (key: string): unknown => {
    const v = lookup(messages, key);
    return v === undefined && fallback ? lookup(fallback, key) : v;
  };

  const interpolate = (template: string, vars?: Vars) =>
    template.replace(/\{(\w+)\}/g, (m, name: string) => {
      if (!vars || !(name in vars)) return m;
      const v = vars[name];
      return typeof v === 'number' ? number.format(v) : v;
    });

  const t = ((key: string, vars?: Vars) => {
    let v = resolve(key);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const count = typeof vars?.count === 'number' ? vars.count : 0;
      const forms = v as Record<string, string>;
      v = forms[plural.select(count)] ?? forms.other;
    }
    if (typeof v !== 'string') return key;
    return interpolate(v, vars);
  }) as Translator;

  t.list = (key: string) => {
    const v = resolve(key);
    return Array.isArray(v) ? v : [];
  };
  t.has = (key: string) => resolve(key) !== undefined;
  t.locale = locale;
  return t;
}

/** All leaf keys of a messages object, e.g. ["game.guess", "result.players", …]. */
export function flattenKeys(messages: Messages, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(messages)) {
    const key = prefix ? `${prefix}.${k}` : k;
    const isPlural = v && typeof v === 'object' && !Array.isArray(v) && 'other' in v;
    if (typeof v === 'string' || Array.isArray(v) || isPlural) out.push(key);
    else out.push(...flattenKeys(v as Messages, key));
  }
  return out;
}
