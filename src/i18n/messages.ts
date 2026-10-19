import en from '../../locales/en.json';
import et from '../../locales/et.json';
import es from '../../locales/es.json';
import type { Locale } from './config';
import type { Messages } from './translate';

const all: Record<Locale, Messages> = { en, et, es };

export function loadMessages(locale: Locale): Messages {
  return all[locale];
}

export const fallbackMessages: Messages = en;
