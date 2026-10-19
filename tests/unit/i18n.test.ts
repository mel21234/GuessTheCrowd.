import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator, flattenKeys } from '@/i18n/translate';
import { locales, matchBrowserLocale } from '@/i18n/config';
import { loadMessages } from '@/i18n/messages';
import { createFormatter } from '@/lib/format';
import { containsProfanity } from '@/lib/profanity';

test('every locale has exactly the same keys as English', () => {
  const en = new Set(flattenKeys(loadMessages('en')));
  for (const l of locales) {
    const keys = new Set(flattenKeys(loadMessages(l)));
    const missing = [...en].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !en.has(k));
    assert.deepEqual(missing, [], `${l} is missing keys`);
    assert.deepEqual(extra, [], `${l} has extra keys`);
  }
});

test('placeholders match across locales', () => {
  const enT = createTranslator('en', loadMessages('en'));
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
  for (const l of locales) {
    const t = createTranslator(l, loadMessages(l));
    for (const key of flattenKeys(loadMessages('en'))) {
      if (t.list(key).length) continue;
      assert.equal(placeholders(t(key, { count: 2 }).replace(/\d/g, '')), placeholders(enT(key, { count: 2 }).replace(/\d/g, '')), `${l}:${key}`);
    }
  }
});

test('plurals and number formatting', () => {
  const en = createTranslator('en', loadMessages('en'));
  assert.equal(en('result.players', { count: 1 }), '1 player');
  assert.equal(en('result.players', { count: 12840 }), '12,840 players');
  const et = createTranslator('et', loadMessages('et'));
  assert.equal(et('result.players', { count: 1 }), '1 mängija');
  assert.equal(et('result.players', { count: 12840 }).replace(/\s/g, ' '), '12 840 mängijat');
  const es = createTranslator('es', loadMessages('es'));
  assert.equal(es('game.attemptsLeft', { count: 1 }), 'Te queda 1 intento');
  assert.equal(es('game.attemptsLeft', { count: 3 }), 'Te quedan 3 intentos');
});

test('missing keys fall back to English, then to the key itself', () => {
  const t = createTranslator('et', { app: { name: 'X' } }, loadMessages('en'));
  assert.equal(t('nav.help'), 'How to play');
  assert.equal(t('does.not.exist'), 'does.not.exist');
});

test('Intl formatting differs per locale', () => {
  assert.equal(createFormatter('en').percent(62), '62%');
  assert.equal(createFormatter('en').number(1284), '1,284');
  // Estonian (CLDR) groups only from five digits: 1284 -> "1284", 12840 -> "12 840".
  assert.equal(createFormatter('et').number(12840).replace(/\s/g, ' '), '12 840');
  assert.match(createFormatter('es').percent(62), /^62\s?%$/);
  assert.equal(createFormatter('en').date('2026-10-18'), 'Oct 18, 2026');
});

test('browser language detection', () => {
  assert.equal(matchBrowserLocale(['et-EE', 'en-US']), 'et');
  assert.equal(matchBrowserLocale(['es-MX']), 'es');
  assert.equal(matchBrowserLocale(['fr-FR', 'de']), null);
});

test('profanity filter catches obvious words, not innocent ones', () => {
  assert.ok(containsProfanity('what the FUCK'));
  assert.ok(containsProfanity('sh1t happens'));
  assert.ok(containsProfanity('qué mierda'));
  assert.ok(containsProfanity('mine persse'));
  assert.ok(containsProfanity('f u c k this'));
  assert.ok(!containsProfanity('Have you ever eaten a raw potato?'));
  assert.ok(!containsProfanity('¿Alguna vez comiste un cono de helado?'));
  assert.ok(!containsProfanity('Kas kõnnid kepiga?'));
  assert.ok(!containsProfanity('Do you have a pet rooster or cockatoo?'));
});
