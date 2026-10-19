/**
 * Admin sign-in via Supabase Auth (email + password), browser side.
 * Only the public anon key is used here; it grants no data access by itself
 * (RLS + revoked grants). Admin rights are checked on the server.
 */
export interface AdminSession {
  email: string;
  token: string;
}

export interface AdminAuth {
  getSession(): Promise<AdminSession | null>;
  signIn(email: string, password: string): Promise<AdminSession | null>;
  signOut(): Promise<void>;
}

let instance: Promise<AdminAuth | null> | null = null;

export function getAdminAuth(): Promise<AdminAuth | null> {
  instance ??= (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return null;
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'gtc-admin-auth' },
    });
    const toSession = (s: { access_token: string; user: { email?: string } } | null): AdminSession | null =>
      s ? { token: s.access_token, email: s.user.email ?? '' } : null;
    return {
      async getSession() {
        const { data } = await supabase.auth.getSession();
        return toSession(data.session);
      },
      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return null;
        return toSession(data.session);
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    };
  })();
  return instance;
}
