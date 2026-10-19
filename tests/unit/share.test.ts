import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareText, shareTiles } from '@/lib/share';

test('share text matches the documented format', () => {
  const text = buildShareText({
    title: 'Guess the Crowd',
    number: 47,
    solvedIn: 2,
    finalError: 2,
    guesses: [
      { color: 'close', direction: 'up' },
      { color: 'correct', direction: 'none' },
    ],
    host: 'guessthecrowd.com',
  });
  assert.equal(text, 'Guess the Crowd #47 2/3\n🟨⬆️ 🟩\n±2 · guessthecrowd.com');
});

test('unsolved games show X and all three tiles', () => {
  const text = buildShareText({
    title: 'Mida rahvas arvab?',
    number: 3,
    solvedIn: null,
    finalError: 14,
    guesses: [
      { color: 'miss', direction: 'down' },
      { color: 'miss', direction: 'up' },
      { color: 'close', direction: 'down' },
    ],
    host: 'guessthecrowd.com',
  });
  assert.equal(text, 'Mida rahvas arvab? #3 X/3\n⬜⬇️ ⬜⬆️ 🟨⬇️\n±14 · guessthecrowd.com');
});

test('share text never contains the question or the percentage', () => {
  const text = buildShareText({
    title: 'Guess the Crowd',
    number: 12,
    solvedIn: 1,
    finalError: 0,
    guesses: [{ color: 'correct', direction: 'none' }],
    host: 'guessthecrowd.com',
  });
  assert.ok(!text.includes('%'));
  assert.ok(!/\?/.test(text.split('\n')[0].replace('Guess the Crowd', '')));
  assert.equal(text.split('\n').length, 3);
});

test('high contrast uses orange/blue squares', () => {
  assert.equal(
    shareTiles([{ color: 'close', direction: 'up' }, { color: 'correct', direction: 'none' }], true),
    '🟦⬆️ 🟧',
  );
});

test('archive games are labelled', () => {
  const text = buildShareText({
    title: '¿Qué dice la gente?',
    number: 5,
    solvedIn: 3,
    finalError: 1,
    guesses: [
      { color: 'miss', direction: 'up' },
      { color: 'close', direction: 'up' },
      { color: 'correct', direction: 'none' },
    ],
    host: 'guessthecrowd.com',
    archive: true,
    archiveLabel: 'archivo',
  });
  assert.equal(text.split('\n')[0], '¿Qué dice la gente? #5 3/3 (archivo)');
});
