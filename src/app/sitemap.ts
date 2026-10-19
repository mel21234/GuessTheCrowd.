import type { MetadataRoute } from 'next';
import { intlLocale, locales } from '@/i18n/config';
import { SITE_URL } from './metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/archive', '/suggest', '/privacy'];
  return paths.flatMap((p) =>
    locales.map((l) => ({
      url: `${SITE_URL}/${l}${p}`,
      changeFrequency: p === '' || p === '/archive' ? ('daily' as const) : ('monthly' as const),
      alternates: { languages: Object.fromEntries(locales.map((x) => [intlLocale[x], `${SITE_URL}/${x}${p}`])) },
    })),
  );
}
