import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'pending_email_verification';
const PASSWORD_SETUP_COOKIE_NAME = 'pending_password_setup';
const MAX_AGE_SECONDS = 60 * 60;
const PASSWORD_SETUP_MAX_AGE_SECONDS = 60 * 60 * 24;

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return new TextEncoder().encode(secret);
}

export async function createPendingVerificationToken(
  userId: string,
  options?: { source?: 'email' | 'google'; allowPasswordSetup?: boolean }
) {
  return new SignJWT({
    purpose: 'email_verify_autologin',
    uid: String(userId),
    source: options?.source === 'google' ? 'google' : 'email',
    allowPasswordSetup: Boolean(options?.allowPasswordSetup),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export function setPendingVerificationCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });
}

export function clearPendingVerificationCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}

export async function readPendingVerificationCookie(req: NextRequest) {
  const raw = req.cookies.get(COOKIE_NAME)?.value || '';
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, getSecretKey());
    if (payload?.purpose !== 'email_verify_autologin') return null;
    const uid = typeof payload?.uid === 'string' ? payload.uid.trim() : '';
    const source = payload?.source === 'google' ? 'google' : 'email';
    const allowPasswordSetup = payload?.allowPasswordSetup === true;
    return uid ? { uid, source, allowPasswordSetup } : null;
  } catch {
    return null;
  }
}

export async function createPasswordSetupToken(
  userId: string,
  options?: { source?: 'google' | 'email_verification' }
) {
  return new SignJWT({
    purpose: 'password_setup',
    uid: String(userId),
    source: options?.source === 'google' ? 'google' : 'email_verification',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${PASSWORD_SETUP_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export function setPasswordSetupCookie(res: NextResponse, token: string) {
  res.cookies.set(PASSWORD_SETUP_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: PASSWORD_SETUP_MAX_AGE_SECONDS,
    path: '/',
  });
}

export function clearPasswordSetupCookie(res: NextResponse) {
  res.cookies.set(PASSWORD_SETUP_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}

export async function readPasswordSetupCookie(req: NextRequest) {
  const raw = req.cookies.get(PASSWORD_SETUP_COOKIE_NAME)?.value || '';
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, getSecretKey());
    if (payload?.purpose !== 'password_setup') return null;
    const uid = typeof payload?.uid === 'string' ? payload.uid.trim() : '';
    const source = payload?.source === 'google' ? 'google' : 'email_verification';
    return uid ? { uid, source } : null;
  } catch {
    return null;
  }
}

export function getDashboardPathByRole(role: unknown) {
  if (role === 'ADMIN') return '/dashboard/admin';
  if (role === 'MENTOR') return '/dashboard/mentor';
  if (role === 'VENDOR' || role === 'VENDOR_STAFF') return '/dashboard/vendor';
  return '/dashboard/student';
}

export function setAuthCookies(res: NextResponse, token: string, sessionId: string) {
  res.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  res.cookies.set('sid', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
}
