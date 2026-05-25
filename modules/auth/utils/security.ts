import { createHash, randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';

type RateLimitEntry = { count: number; resetAt: number };

function getStore(): Map<string, RateLimitEntry> {
  const g = globalThis as unknown as { __geosainsRateLimit?: Map<string, RateLimitEntry> };
  if (!g.__geosainsRateLimit) g.__geosainsRateLimit = new Map<string, RateLimitEntry>();
  return g.__geosainsRateLimit;
}

export function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

export function generateOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function getClientIp(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || 'unknown';
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

export function enforceRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const store = getStore();
  const entry = store.get(opts.key);
  if (!entry || entry.resetAt <= now) {
    store.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }
  if (entry.count >= opts.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { ok: false, retryAfterSeconds };
  }
  entry.count += 1;
  store.set(opts.key, entry);
  return { ok: true };
}

export function isSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!host) return true;
  try {
    const o = new URL(origin);
    return o.host === host;
  } catch {
    return false;
  }
}

export function validatePasswordStrength(password: string, opts?: { minLength?: number; strict?: boolean }) {
  const raw = String(password || '');
  const minLength = Number.isFinite(opts?.minLength) ? Math.max(6, Number(opts?.minLength)) : 8;
  const strict = Boolean(opts?.strict);

  if (raw.length < minLength) return { ok: false as const, error: `Password minimal ${minLength} karakter` };
  if (raw.length > 128) return { ok: false as const, error: 'Password terlalu panjang' };

  const hasLower = /[a-z]/.test(raw);
  const hasUpper = /[A-Z]/.test(raw);
  const hasNumber = /[0-9]/.test(raw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(raw);

  if (strict) {
    if (!hasLower || !hasUpper || !hasNumber) return { ok: false as const, error: 'Password harus mengandung huruf kecil, huruf besar, dan angka' };
    if (!hasSymbol) return { ok: false as const, error: 'Password harus mengandung simbol' };
  } else {
    if (!(hasLower || hasUpper)) return { ok: false as const, error: 'Password harus mengandung huruf' };
    if (!hasNumber) return { ok: false as const, error: 'Password harus mengandung angka' };
  }

  const lowered = raw.toLowerCase();
  const blocked = ['password', 'qwerty', '123456', '12345678', 'admin', 'geosains'];
  if (blocked.some((b) => lowered.includes(b))) return { ok: false as const, error: 'Password terlalu mudah ditebak' };

  return { ok: true as const };
}
