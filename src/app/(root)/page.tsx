import type { Metadata } from 'next';
import { LOCALE_STORAGE_KEY, defaultLocale, localeNames, locales } from '@/i18n/config';

export const metadata: Metadata = {
  title: 'Guess the Crowd',
  robots: { index: false, follow: true },
};

// Uses the language the player picked before (localStorage — no cookies),
// otherwise English. The browser language is only *suggested* on the page.
const script = `try{var l=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});var ok=${JSON.stringify(locales)};location.replace('/'+(ok.indexOf(l)>-1?l:${JSON.stringify(defaultLocale)})+location.search)}catch(e){location.replace('/${defaultLocale}')}`;

export default function RootPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <noscript>
        <ul>
          {locales.map((l) => (
            <li key={l}>
              <a href={`/${l}`} lang={l}>
                {localeNames[l]}
              </a>
            </li>
          ))}
        </ul>
      </noscript>
    </>
  );
}
