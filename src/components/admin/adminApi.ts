'use client';

export class AdminApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export type AdminCall = <T>(body: Record<string, unknown>) => Promise<T>;

export function makeAdminCall(token: string): AdminCall {
  return async <T,>(body: Record<string, unknown>) => {
    let res: Response;
    try {
      res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
    } catch {
      throw new AdminApiError(0, 'offline');
    }
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) throw new AdminApiError(res.status, data?.error ?? 'generic');
    return data as T;
  };
}
