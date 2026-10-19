/** Browser-side API client. */
import type { Locale } from '@/i18n/config';
import type {
  ArchiveResponse,
  GuessResponse,
  PuzzleResponse,
  SuggestResponse,
  TodayResponse,
  VoteResponse,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}`);
  }
  get offline() {
    return this.status === 0;
  }
}

async function request<T>(path: string, init?: RequestInit, okStatuses: number[] = []): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
      signal: init?.signal ?? AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(0, null);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok && !okStatuses.includes(res.status)) throw new ApiError(res.status, body);
  return body as T;
}

const qs = (o: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(o).filter(([, v]) => v !== undefined) as [string, string][],
  ).toString();

export const api = {
  today: (locale: Locale, player: string) => request<TodayResponse>(`/api/today?${qs({ locale, player })}`),

  puzzle: (locale: Locale, player: string, number?: number) =>
    request<PuzzleResponse>(`/api/puzzle?${qs({ locale, player, number })}`),

  guess: (questionId: number, playerId: string, value: number, locale: Locale) =>
    request<GuessResponse>(
      '/api/guess',
      { method: 'POST', body: JSON.stringify({ questionId, playerId, value, locale }) },
      [429],
    ),

  vote: (questionId: number, playerId: string, answer: boolean, locale: Locale, turnstileToken?: string) =>
    request<VoteResponse>(
      '/api/vote',
      { method: 'POST', body: JSON.stringify({ questionId, playerId, answer, locale, turnstileToken }) },
      [429],
    ),

  archive: (locale: Locale, player: string, before?: number) =>
    request<ArchiveResponse>(`/api/archive?${qs({ locale, player, before })}`),

  suggest: (text: string, nickname: string, locale: Locale, website: string) =>
    request<SuggestResponse>(
      '/api/suggest',
      { method: 'POST', body: JSON.stringify({ text, nickname, locale, website }) },
      [400, 429],
    ),
};

/** Host shown in share text, e.g. "guessthecrowd.com". */
export function shareHost(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured).host;
    } catch {
      /* fall through */
    }
  }
  return typeof window !== 'undefined' ? window.location.host : 'guessthecrowd.com';
}
