/**
 * Cloudflare Turnstile. Only active when both keys are configured; then
 * voters above the per-IP-hash threshold must pass a challenge.
 */
export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
}

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && turnstileSiteKey());
}

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
