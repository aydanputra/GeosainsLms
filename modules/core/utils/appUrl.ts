
/**
 * Resolves the canonical Application URL.
 * Order of precedence:
 * 1. process.env.APP_URL (Explicit override)
 * 2. Request headers (X-Forwarded-Host/Proto or Host)
 * 3. Fallback (http://localhost:3000)
 */
export function getAppUrl(headers?: Headers): string {
  // 1. Explicit Env (Preferred for production/canonical)
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, ''); // Normalize: remove trailing slash
  }

  // 2. Derive from headers (Fallback for dev/dynamic)
  if (headers) {
    const host = headers.get('x-forwarded-host') || headers.get('host');
    const proto = headers.get('x-forwarded-proto') || 'http';
    if (host) {
      return `${proto}://${host}`;
    }
  }

  // 3. Last resort
  return 'http://localhost:3000';
}
