/**
 * Generates favicon, PWA icons and spoiler-free Open Graph images per language.
 *   npm run assets
 * The icon is three guess tiles (grey / yellow / green) — the game in one glance.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (...p) => join(root, 'public', ...p);

const icon = (size, pad) => {
  const s = 512, p = pad ?? 0;
  const inner = s - p * 2, w = inner * 0.24, gap = inner * 0.06, h = inner * 0.5;
  const x0 = p + (inner - (w * 3 + gap * 2)) / 2, y = p + (inner - h) / 2;
  const tiles = ['#DADDE0', '#F2E2A0', '#A8D5A2']
    .map((c, i) => `<rect x="${x0 + i * (w + gap)}" y="${y + (2 - i) * h * 0.18}" width="${w}" height="${h - (2 - i) * h * 0.18}" rx="${w * 0.22}" fill="${c}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#1A1A1B"/>${tiles}</svg>`;
};

writeFileSync(pub('favicon.svg'), icon(64));
await sharp(Buffer.from(icon(192))).png().toFile(pub('icons', 'icon-192.png'));
await sharp(Buffer.from(icon(512))).png().toFile(pub('icons', 'icon-512.png'));
await sharp(Buffer.from(icon(512, 64))).png().toFile(pub('icons', 'icon-maskable-512.png'));
await sharp(Buffer.from(icon(180, 0))).png().toFile(pub('icons', 'apple-touch-icon.png'));
await sharp(Buffer.from(icon(48))).resize(48, 48).png().toFile(pub('icons', 'favicon-48.png'));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
for (const l of ['en', 'et', 'es']) {
  const m = JSON.parse(readFileSync(join(root, 'locales', `${l}.json`), 'utf8'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#FFFFFF"/>
  <g transform="translate(90,150)">
    <rect x="0" y="70" width="150" height="110" rx="22" fill="#DADDE0"/>
    <rect x="170" y="40" width="150" height="140" rx="22" fill="#F2E2A0"/>
    <rect x="340" y="0" width="150" height="180" rx="22" fill="#A8D5A2"/>
  </g>
  <text x="90" y="430" font-family="Figtree, Inter, Arial, sans-serif" font-size="76" font-weight="800" fill="#1A1A1B" letter-spacing="2">${esc(m.app.logo)}</text>
  <text x="90" y="500" font-family="Figtree, Inter, Arial, sans-serif" font-size="34" fill="#6B6F72">${esc(m.puzzle.prompt)}</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(pub('og', `${l}.png`));
}

writeFileSync(
  pub('manifest.webmanifest'),
  JSON.stringify(
    {
      name: 'Guess the Crowd',
      short_name: 'Guess the Crowd',
      description: 'One yes/no question for the whole world every day. Guess what percent said yes.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#FFFFFF',
      theme_color: '#FFFFFF',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log('assets written to public/');
