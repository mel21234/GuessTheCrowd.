/**
 * Very small multilingual profanity filter for community suggestions.
 * It only blocks obvious cases; every suggestion is still human-moderated.
 * Matching is done on whole words after lower-casing and stripping accents
 * and common character substitutions (e.g. "sh1t").
 */
const WORDS = [
  // English
  // (Words with common innocent meanings — e.g. "cock" (rooster), Spanish
  // "cono" (cone), Estonian "kepp" (walking stick) — are deliberately left out.)
  'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'cunt', 'pussy', 'asshole',
  'bastard', 'slut', 'whore', 'nigger', 'nigga', 'faggot', 'retard', 'porn',
  // Spanish
  'mierda', 'puta', 'puto', 'putas', 'putos', 'cabron', 'cabrona', 'pendejo', 'pendeja', 'gilipollas',
  'verga', 'chinga', 'chingada', 'maricon', 'culero',
  // Estonian
  'perse', 'persse', 'türa', 'vittu', 'raisk', 'lits', 'munn', 'pede', 'nikkuma', 'sitt',
];

const NORMALIZED = new Set(WORDS.map(normalize));

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0@]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't');
}

export function containsProfanity(text: string): boolean {
  const words = normalize(text).split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => NORMALIZED.has(w))) return true;
  // Catch spaced-out spellings like "f u c k".
  const joined = words.filter((w) => w.length === 1).join('');
  return joined.length >= 4 && [...NORMALIZED].some((w) => w.length >= 4 && joined.includes(w));
}
