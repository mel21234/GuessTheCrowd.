'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';
import { useI18n } from '@/i18n/I18nProvider';

/** Accessible modal built on <dialog>: focus trap, Esc to close, backdrop click closes. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useI18n();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="rounded-2xl bg-bg p-5 pb-6 shadow-xl ring-1 ring-line sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id={titleId} className="text-xl font-extrabold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
              aria-label={t('nav.close')}
            >
              <CloseIcon size={22} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
