/**
 * Everything the game keeps on the player's device. localStorage only — no
 * cookies. Every access is wrapped: storage may be unavailable (private mode,
 * blocked site data) and the game must still work.
 */
import type { GameRecord } from './stats';
import type { DailyContext } from './stats';

const KEYS = {
  player: 'gtc:player',
  settings: 'gtc:settings',
  records: 'gtc:records',
  daily: 'gtc:daily',
  helpSeen: 'gtc:help-seen',
  langDismissed: 'gtc:lang-suggest-dismissed',
} as const;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: ignore */
  }
}

function readJson<T>(key: string, fallback: T): T {
  const raw = read(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---- change notifications (for useSyncExternalStore) ------------------------

const listeners = new Set<() => void>();
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn();
}

// ---- player id ---------------------------------------------------------------

let memoryPlayerId: string | null = null;

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Anonymous random id, created on first use. */
export function getPlayerId(): string {
  const existing = read(KEYS.player);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  memoryPlayerId ??= uuid();
  write(KEYS.player, memoryPlayerId);
  return memoryPlayerId;
}

export function peekPlayerId(): string | null {
  return read(KEYS.player);
}

// ---- settings ----------------------------------------------------------------

export interface Settings {
  dark: boolean;
  highContrast: boolean;
}
const DEFAULT_SETTINGS: Settings = { dark: false, highContrast: false };
let settingsCache: Settings | null = null;

export function getSettings(): Settings {
  settingsCache ??= { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(KEYS.settings, {}) };
  return settingsCache;
}

export function setSettings(next: Settings): void {
  settingsCache = next;
  write(KEYS.settings, JSON.stringify(next));
  applySettings(next);
  emit();
}

export function applySettings(s: Settings): void {
  const el = document.documentElement;
  el.dataset.theme = s.dark ? 'dark' : 'light';
  if (s.highContrast) el.dataset.contrast = 'high';
  else delete el.dataset.contrast;
}

/** Inline script for <head>: applies saved settings before first paint (no flash). */
export const SETTINGS_BOOT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem('${KEYS.settings}')||'{}');var d=document.documentElement;d.dataset.theme=s.dark?'dark':'light';if(s.highContrast)d.dataset.contrast='high'}catch(e){}`;

// ---- game records & daily context -------------------------------------------

let recordsCache: GameRecord[] | null = null;

export function getRecords(): GameRecord[] {
  recordsCache ??= readJson<GameRecord[]>(KEYS.records, []);
  return recordsCache;
}

/** Saves a finished game once (the first result for a puzzle number wins). */
export function saveRecord(r: GameRecord): void {
  const all = getRecords();
  if (all.some((x) => x.number === r.number)) return;
  recordsCache = [...all, r];
  write(KEYS.records, JSON.stringify(recordsCache));
  emit();
}

let dailyCache: DailyContext | null = null;
export function getDailyContext(): DailyContext {
  dailyCache ??= readJson<DailyContext>(KEYS.daily, { dailyNumber: null, prevDailyNumber: null });
  return dailyCache;
}
export function setDailyContext(ctx: DailyContext): void {
  const cur = getDailyContext();
  if (cur.dailyNumber === ctx.dailyNumber && cur.prevDailyNumber === ctx.prevDailyNumber) return;
  dailyCache = ctx;
  write(KEYS.daily, JSON.stringify(ctx));
  emit();
}

// ---- flags -------------------------------------------------------------------

export const flags = {
  helpSeen: () => read(KEYS.helpSeen) === '1',
  markHelpSeen: () => write(KEYS.helpSeen, '1'),
  langSuggestDismissed: () => read(KEYS.langDismissed) === '1',
  dismissLangSuggest: () => write(KEYS.langDismissed, '1'),
};

// ---- locale preference -------------------------------------------------------

export function getSavedLocale(key: string): string | null {
  return read(key);
}
export function saveLocale(key: string, locale: string): void {
  write(key, locale);
}
