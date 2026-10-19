'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { peekPlayerId } from '@/lib/storage';

export const PRIVACY_UPDATED = '2026-10-18';

export function PrivacyScreen({ email }: { email: string }) {
  const { t, fmt } = useI18n();
  const [playerId, setPlayerId] = useState<string | null | undefined>(undefined);
  useEffect(() => setPlayerId(peekPlayerId()), []);

  return (
    <article className="mx-auto w-full max-w-[560px] px-4 py-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t('privacy.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('privacy.updated', { date: fmt.date(PRIVACY_UPDATED, 'long') })}</p>
      <p className="mt-5 text-lg leading-relaxed">{t('privacy.intro')}</p>
      <ul className="mt-5 space-y-4 text-[16px] leading-relaxed">
        {t.list('privacy.sections').map((p, i) => (
          <li key={i} className="border-l-4 border-line pl-4">
            {p.replace('{email}', email)}
          </li>
        ))}
      </ul>
      {playerId !== undefined && (
        <p className="mt-6 rounded-xl bg-surface p-4 text-sm break-all">
          {playerId ? t('privacy.playerId', { id: playerId }) : t('privacy.noPlayerId')}
        </p>
      )}
    </article>
  );
}
