'use client';

import { ShareIcon } from '../icons';
import { useToast } from '../Toast';
import { useSettings } from '../hooks';
import { useI18n } from '@/i18n/I18nProvider';
import { buildShareText } from '@/lib/share';
import { shareHost } from '@/lib/api';
import type { GuessTile } from '@/lib/types';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function ShareButton({
  number,
  solvedIn,
  finalError,
  guesses,
  archive,
}: {
  number: number;
  solvedIn: number | null;
  finalError: number;
  guesses: GuessTile[];
  archive: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { highContrast } = useSettings();

  const onShare = async () => {
    const text = buildShareText({
      title: t('app.name'),
      number,
      solvedIn,
      finalError,
      guesses,
      host: shareHost(),
      highContrast,
      archive,
      archiveLabel: t('result.archiveLabel'),
    });
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (mobile && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    toast((await copy(text)) ? t('result.copied') : t('result.copyFailed'));
  };

  return (
    <button
      type="button"
      onClick={onShare}
      className="flex h-14 items-center justify-center gap-2 rounded-full bg-btn px-7 text-lg font-extrabold text-btn-fg hover:opacity-90"
    >
      {t('result.share')}
      <ShareIcon size={20} />
    </button>
  );
}
