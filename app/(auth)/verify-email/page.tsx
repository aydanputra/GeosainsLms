"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);
  const emailParam = useMemo(() => (searchParams.get('email') || '').trim().toLowerCase(), [searchParams]);
  const provider = useMemo(() => (searchParams.get('provider') || '').trim().toLowerCase(), [searchParams]);
  const verifiedHint = useMemo(() => (searchParams.get('verified') || '').trim() === '1', [searchParams]);
  const redirect = useMemo(() => {
    const raw = (searchParams.get('redirect') || '').trim();
    if (!raw) return null;
    if (!raw.startsWith('/')) return null;
    if (raw.startsWith('//')) return null;
    if (raw.includes('://')) return null;
    return raw;
  }, [searchParams]);

  const [email, setEmail] = useState(emailParam);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'VERIFYING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [resendLoading, setResendLoading] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  useEffect(() => {
    if (token) return;
    if (provider !== 'google') return;
    if (!verifiedHint) return;
    setStatus('SUCCESS');
    setError('');
  }, [provider, token, verifiedHint]);

  useEffect(() => {
    if (!emailParam) return;
    setEmail(emailParam);
  }, [emailParam]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setStatus('VERIFYING');
    setError('');
    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) throw new Error(data?.error || 'Gagal verifikasi email');
        setStatus('SUCCESS');
        try {
          window.sessionStorage.removeItem('devVerifyUrl');
        } catch {
        }
      } catch (e: any) {
        if (!active) return;
        setStatus('ERROR');
        setError(e?.message || 'Gagal verifikasi email');
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    try {
      const v = window.sessionStorage.getItem('devVerifyUrl');
      if (v && v.trim()) setDevUrl(v.trim());
    } catch {
    }
  }, []);

  const resend = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      setError('Email tidak valid');
      return;
    }
    setResendLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal mengirim ulang verifikasi');
      if (typeof data?.devVerifyUrl === 'string' && data.devVerifyUrl.trim()) {
        setDevUrl(data.devVerifyUrl.trim());
        try {
          window.sessionStorage.setItem('devVerifyUrl', data.devVerifyUrl.trim());
        } catch {
        }
      }
      setStatus('IDLE');
    } catch (e: any) {
      setError(e?.message || 'Gagal mengirim ulang verifikasi');
    } finally {
      setResendLoading(false);
    }
  };

  const loginHref = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';
  const dashboardHref = redirect || '/dashboard';
  const isGoogleVerifiedLanding = !token && provider === 'google' && verifiedHint;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 sm:px-6 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 sm:p-8">
          <div className="space-y-2">
            <div className="text-2xl font-extrabold text-slate-900">Verifikasi Email</div>
            <div className="text-sm text-slate-600">
              {token ? 'Sedang memverifikasi token…' : 'Masukkan email untuk kirim ulang link verifikasi.'}
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 text-sm font-semibold flex gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="min-w-0">{error}</div>
            </div>
          ) : null}

          {status === 'VERIFYING' ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 text-sm font-semibold inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memverifikasi…
            </div>
          ) : null}

          {status === 'SUCCESS' ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 text-sm font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div>{isGoogleVerifiedLanding ? 'Email Anda sudah terverifikasi melalui Google.' : 'Email berhasil diverifikasi.'}</div>
                <div className="mt-2">
                  {isGoogleVerifiedLanding ? (
                    <Link href={dashboardHref} className="text-indigo-700 hover:text-indigo-900 text-xs font-extrabold">
                      Lanjutkan ke Dashboard
                    </Link>
                  ) : (
                    <Link href={loginHref} className="text-indigo-700 hover:text-indigo-900 text-xs font-extrabold">
                      Lanjutkan ke Login
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {!token && !isGoogleVerifiedLanding ? (
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                  <input
                    type="email"
                    className="w-full h-12 pl-11 pr-4 rounded-2xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={resend}
                disabled={resendLoading}
                className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {resendLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Kirim Ulang Verifikasi
              </button>

              <div className="text-sm text-slate-600 text-center">
                Sudah verifikasi?{' '}
                <Link href={loginHref} className="font-extrabold text-indigo-700 hover:text-indigo-800">
                  Masuk
                </Link>
              </div>

              {devUrl && process.env.NODE_ENV !== 'production' ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 text-xs font-semibold break-words">
                  <div className="text-[11px] font-extrabold text-slate-600">Dev link:</div>
                  <a href={devUrl} className="text-indigo-700 hover:text-indigo-900">
                    {devUrl}
                  </a>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 text-sm text-slate-600 text-center">
              Tidak punya token?{' '}
              <button
                type="button"
                onClick={() => router.replace(`/verify-email${emailParam ? `?email=${encodeURIComponent(emailParam)}` : ''}`)}
                className="font-extrabold text-indigo-700 hover:text-indigo-800"
              >
                Kirim ulang verifikasi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
