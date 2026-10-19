'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { applySettings, flags, getSettings } from '@/lib/storage';
import { HelpIcon, StatsIcon, GearIcon } from './icons';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LanguageSuggestion } from './LanguageSuggestion';
import { HelpModal } from './HelpModal';
import { StatsModal } from './StatsModal';
import { SettingsModal } from './SettingsModal';
import { ToastProvider } from './Toast';
import { localeHref } from './paths';
import { currentPath } from './nav';

type ModalName = 'help' | 'stats' | 'settings' | null;
const ShellContext = createContext<{ open: (m: Exclude<ModalName, null>) => void }>({ open: () => {} });
export const useShell = () => useContext(ShellContext);

export function AppShell({ children }: { children: ReactNode }) {
  const { t, locale } = useI18n();
  const [modal, setModal] = useState<ModalName>(null);

  useEffect(() => {
    applySettings(getSettings());
    // First visit to the game: explain the rules once.
    const onGame = /^\/[a-z]{2}\/?$/.test(currentPath());
    if (onGame && !flags.helpSeen()) setModal('help');
  }, []);

  const close = useCallback(() => {
    if (modal === 'help') flags.markHelpSeen();
    setModal(null);
  }, [modal]);

  const iconBtn = 'grid size-10 place-items-center rounded-full hover:bg-surface';

  return (
    <ShellContext.Provider value={{ open: setModal }}>
      <ToastProvider>
        <div className="flex min-h-dvh flex-col">
          <LanguageSuggestion />
          <header className="border-b border-line">
            <div className="mx-auto flex h-14 max-w-[600px] items-center gap-1 px-2 sm:px-3">
              <div className="flex shrink-0 sm:w-[150px]">
                <button type="button" className={iconBtn} aria-label={t('nav.help')} onClick={() => setModal('help')}>
                  <HelpIcon size={23} />
                </button>
              </div>
              <a
                href={localeHref(locale)}
                className="min-w-0 flex-1 px-1 text-center text-[clamp(14px,4.4vw,24px)] font-extrabold leading-[1.05] tracking-[0.03em] balance"
              >
                {t('app.logo')}
              </a>
              <div className="flex shrink-0 items-center justify-end sm:w-[150px]">
                <button type="button" className={iconBtn} aria-label={t('nav.stats')} onClick={() => setModal('stats')}>
                  <StatsIcon size={23} />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={t('nav.settings')}
                  onClick={() => setModal('settings')}
                >
                  <GearIcon size={22} />
                </button>
                <LanguageSwitcher />
              </div>
            </div>
          </header>
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
        <HelpModal open={modal === 'help'} onClose={close} />
        <StatsModal open={modal === 'stats'} onClose={close} />
        <SettingsModal open={modal === 'settings'} onClose={close} />
      </ToastProvider>
    </ShellContext.Provider>
  );
}
