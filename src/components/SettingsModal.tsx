'use client';

import { useId } from 'react';
import { Modal } from './Modal';
import { useI18n } from '@/i18n/I18nProvider';
import { setSettings } from '@/lib/storage';
import { useSettings } from './hooks';
import { localeHref } from './paths';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const s = useSettings();

  return (
    <Modal open={open} onClose={onClose} title={t('settings.title')}>
      <div className="divide-y divide-line">
        <Toggle
          label={t('settings.dark')}
          hint={t('settings.darkHint')}
          checked={s.dark}
          onChange={(v) => setSettings({ ...s, dark: v })}
        />
        <Toggle
          label={t('settings.contrast')}
          hint={t('settings.contrastHint')}
          checked={s.highContrast}
          onChange={(v) => setSettings({ ...s, highContrast: v })}
        />
      </div>
      <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-sm font-semibold">
        <a onClick={onClose} className="underline-offset-4 hover:underline" href={localeHref(locale, '/archive')}>
          {t('nav.archive')}
        </a>
        <a onClick={onClose} className="underline-offset-4 hover:underline" href={localeHref(locale, '/suggest')}>
          {t('nav.suggest')}
        </a>
        <a onClick={onClose} className="underline-offset-4 hover:underline" href={localeHref(locale, '/privacy')}>
          {t('nav.privacy')}
        </a>
      </nav>
    </Modal>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm leading-snug text-muted">{hint}</span>
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-btn' : 'bg-track'}`}
      >
        <span
          className={`absolute top-1 left-1 size-5 rounded-full bg-bg shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}
