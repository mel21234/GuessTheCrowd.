'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getDailyContext, getRecords, getSettings, subscribe, type Settings } from '@/lib/storage';
import { computeStats, type GameRecord, type Stats } from '@/lib/stats';
import { msUntilNextUtcMidnight } from '@/lib/time';

const EMPTY: GameRecord[] = [];
const SERVER_SETTINGS: Settings = { dark: false, highContrast: false };
const SERVER_DAILY = { dailyNumber: null, prevDailyNumber: null };

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, () => SERVER_SETTINGS);
}

export function useRecords(): GameRecord[] {
  return useSyncExternalStore(subscribe, getRecords, () => EMPTY);
}

export function useStats(): Stats {
  const records = useRecords();
  const daily = useSyncExternalStore(subscribe, getDailyContext, () => SERVER_DAILY);
  return computeStats(records, daily);
}

/** Milliseconds until the next puzzle (00:00 UTC), ticking every second. */
export function useCountdown(onZero?: () => void): number | null {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    let fired = false;
    const tick = () => {
      const left = msUntilNextUtcMidnight(new Date());
      setMs(left);
      if (left <= 1000 && !fired) {
        fired = true;
        setTimeout(() => onZero?.(), 1500);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [onZero]);
  return ms;
}

/** True once mounted in the browser (for values that only exist client-side). */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
