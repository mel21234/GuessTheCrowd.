/**
 * Server-only database access. Everything goes through SQL functions (RPC)
 * with the service-role key, which never reaches the browser.
 */
export interface RpcError {
  message: string;
  code?: string;
}

export interface DbClient {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }>;
  /** Resolve a Supabase Auth access token to a user id (null if invalid). */
  getUserId(accessToken: string): Promise<string | null>;
}

let override: DbClient | null = null;
let cached: DbClient | null = null;

/** Tests inject a client backed by a throwaway Postgres database. */
export function setDbClientForTests(client: DbClient | null): void {
  override = client;
}

export class ConfigError extends Error {}

export async function getDb(): Promise<DbClient> {
  if (override) return override;
  if (cached) return cached;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new ConfigError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see README).');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  cached = {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await supabase.rpc(fn, args);
      return {
        data: (data ?? null) as T | null,
        error: error ? { message: error.message, code: error.code } : null,
      };
    },
    async getUserId(token: string) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) return null;
      return data.user.id;
    },
  };
  return cached;
}
