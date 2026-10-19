'use client';

import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Tile } from './game/Tile';
import { useI18n } from '@/i18n/I18nProvider';
import { nextUtcMidnight } from '@/lib/time';
import { useMounted } from './hooks';

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const mounted = useMounted();
  const steps = [t('help.step1'), t('help.step2'), t('help.step3')];

  return (
    <Modal open={open} onClose={onClose} title={t('help.title')}>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-snug">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-sm font-bold tnum">
              {i + 1}
            </span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 space-y-2.5 rounded-xl bg-surface p-4">
        <Legend tile={<Tile size="sm" value={60} color="correct" direction="none" />} text={t('help.legendCorrect')} />
        <Legend tile={<Tile size="sm" value={52} color="close" direction="up" />} text={t('help.legendClose')} />
        <Legend tile={<Tile size="sm" value={85} color="miss" direction="down" />} text={t('help.legendMiss')} />
        <p className="pt-1 text-sm text-muted">{t('help.arrows')}</p>
      </div>

      {mounted && (
        <p className="mt-4 text-sm text-muted">
          {t('help.newDaily', { time: fmt.localTime(nextUtcMidnight(new Date())) })}
        </p>
      )}

      <button
        type="button"
        autoFocus
        onClick={onClose}
        className="mt-5 h-12 w-full rounded-full bg-btn text-base font-bold text-btn-fg hover:opacity-90"
      >
        {t('help.play')}
      </button>
    </Modal>
  );
}

function Legend({ tile, text }: { tile: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-[84px] shrink-0">{tile}</div>
      <span className="text-sm leading-snug">{text}</span>
    </div>
  );
}
