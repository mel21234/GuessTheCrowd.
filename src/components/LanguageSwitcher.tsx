'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { GlobeIcon, CheckIcon } from './icons';
import { useI18n } from '@/i18n/I18nProvider';
import { LOCALE_STORAGE_KEY, localeNames, locales, type Locale } from '@/i18n/config';
import { saveLocale } from '@/lib/storage';
import { swapLocaleInPath } from './paths';
import { currentPath, navigate } from './nav';

export function switchLocale(next: Locale) {
  saveLocale(LOCALE_STORAGE_KEY, next);
  navigate(swapLocaleInPath(currentPath(), next) + window.location.search);
}

export function LanguageSwitcher() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    wrap.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
    next?.focus();
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('nav.language')}: ${localeNames[locale]}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-1 rounded-full px-2 text-sm font-bold hover:bg-surface"
      >
        <GlobeIcon size={20} />
        <span className="uppercase">{locale}</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t('nav.language')}
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-40 mt-1 min-w-44 rounded-xl bg-bg p-1.5 shadow-lg ring-1 ring-line"
        >
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              role="menuitemradio"
              aria-checked={l === locale}
              lang={l}
              onClick={() => (l === locale ? setOpen(false) : switchLocale(l))}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] hover:bg-surface"
            >
              <span>
                {localeNames[l]} <span className="text-xs font-semibold uppercase text-muted">{l}</span>
              </span>
              {l === locale && <CheckIcon size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
