import { createHmac, randomBytes } from 'node:crypto';
import type { z, ZodTypeAny } from 'zod';
import { utcDateString } from '@/lib/time';
import { ConfigError } from './db';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE, ...headers },
  });
}

export function errorJson(error: string, status: number, extra: Record<string, unknown> = {}): Response {
  return json({ error, ...extra }, status);
}

export async function readBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; res: Response }> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > 16_384) return { ok: false, res: errorJson('payload_too_large', 413) };
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: errorJson('invalid_json', 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, res: errorJson('invalid', 400, { issues: parsed.error.issues.map((i) => i.path.join('.')) }) };
  }
  return { ok: true, data: parsed.data };
}

export function readQuery<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): { ok: true; data: z.output<S> } | { ok: false; res: Response } {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return { ok: false, res: errorJson('invalid', 400, { issues: parsed.error.issues.map((i) => i.path.join('.')) }) };
  }
  return { ok: true, data: parsed.data };
}

/** Wrap a handler so configuration and unexpected errors become clean JSON responses. */
export function handler(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof ConfigError) {
        console.error(e.message);
        return errorJson('not_configured', 503);
      }
      console.error(e);
      return errorJson('server_error', 500);
    }
  };
}

// ---- IP hashing (privacy: the raw IP is never stored) -----------------------

let devSecret: string | null = null;

function ipSecret(): string {
  const s = process.env.IP_HASH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new ConfigError('IP_HASH_SECRET must be set (at least 16 characters).');
  }
  devSecret ??= randomBytes(32).toString('hex');
  return devSecret;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Salted HMAC of the IP. The UTC date is part of the input, so hashes rotate daily. */
export function ipHash(req: Request, now = new Date()): string {
  return createHmac('sha256', ipSecret())
    .update(`${utcDateString(now)}|${clientIp(req)}`)
    .digest('hex')
    .slice(0, 32);
}
