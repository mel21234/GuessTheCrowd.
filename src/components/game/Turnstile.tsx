'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('turnstile load failed'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Cloudflare Turnstile widget. Only loaded when the server asks for a challenge. */
export function Turnstile({
  siteKey,
  locale,
  onToken,
  onError,
}: {
  siteKey: string;
  locale: string;
  onToken: (token: string) => void;
  onError: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | null = null;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          language: locale,
          callback: onToken,
          'error-callback': onError,
        });
      })
      .catch(onError);
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, locale, onToken, onError]);
  return <div ref={ref} className="flex justify-center" />;
}
