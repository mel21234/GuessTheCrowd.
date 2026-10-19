'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg({ text, id: Date.now() });
    timer.current = setTimeout(() => setMsg(null), 2200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 top-0 z-50">
        {msg && (
          <div
            key={msg.id}
            className="absolute left-1/2 top-[72px] rounded-lg bg-btn px-4 py-2.5 text-sm font-semibold text-btn-fg shadow-lg"
            style={{ animation: 'toast-in 180ms ease-out both' }}
          >
            {msg.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
