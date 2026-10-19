/**
 * A DbClient that runs the real SQL functions through `psql` as the
 * service_role, exactly like Supabase's RPC would. Test/dev use only.
 */
import type { DbClient } from '@/server/db';
import { psql } from './testdb';

function literal(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('non-finite number');
    return String(v);
  }
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
}

export interface PgClientOptions {
  /** Fake "now" (ISO string) for time travel; undefined = real time. */
  now?: () => string | undefined;
  /** Access token -> user id, standing in for Supabase Auth. */
  users?: Record<string, string>;
}

export function pgClient(url: string, opts: PgClientOptions = {}): DbClient {
  return {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      if (!/^[a-z_]+$/.test(fn)) throw new Error('bad function name');
      const named = Object.entries(args)
        .map(([k, v]) => {
          if (!/^p_[a-z_]+$/.test(k)) throw new Error(`bad arg ${k}`);
          return `${k} => ${literal(v)}`;
        })
        .join(', ');
      const now = opts.now?.();
      const sql =
        (now ? `select set_config('app.now', ${literal(now)}, false);` : '') +
        `set role service_role; select public.${fn}(${named})::text;`;
      try {
        const out = psql(url, sql).trim().split('\n').filter(Boolean);
        const last = out[out.length - 1] ?? 'null';
        return { data: JSON.parse(last) as T, error: null };
      } catch (e) {
        const msg = String((e as Error).message);
        const m = msg.match(/ERROR:\s+(.*)/);
        return { data: null, error: { message: (m ? m[1] : msg).trim() } };
      }
    },
    async getUserId(token: string) {
      return opts.users?.[token] ?? null;
    },
  };
}
