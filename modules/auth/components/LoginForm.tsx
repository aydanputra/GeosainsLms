"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleInitializedRef = useRef(false);
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [googleClientId, setGoogleClientId] = useState('');
  const googleClientIdHint =
    googleClientId && googleClientId.length > 18
      ? `${googleClientId.slice(0, 8)}…${googleClientId.slice(-10)}`
      : googleClientId;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/google', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        const cid = typeof data?.clientId === 'string' ? data.clientId.trim() : '';
        setGoogleClientId(cid);
        googleInitializedRef.current = false;
      } catch {
        if (!active) return;
        setGoogleClientId('');
        googleInitializedRef.current = false;
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const w = window as any;
    if (w?.google?.accounts?.id) setGoogleReady(true);
  }, [googleClientId]);

  const redirectTarget = useMemo(() => {
    const raw = searchParams.get('redirect') || '';
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith('/')) return null;
    if (trimmed.startsWith('//')) return null;
    if (trimmed.includes('://')) return null;
    return trimmed;
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUnverifiedEmail(null);

    try {
      if (step === 'totp') {
        const token = tempToken;
        if (!token) throw new Error('Token login tidak valid');
        const res = await fetch('/api/auth/2fa/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempToken: token, code: totpCode }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Verifikasi 2 langkah gagal');
        const user = data?.user;
        if (redirectTarget) {
          router.push(redirectTarget);
          return;
        }
        if (user?.role === 'ADMIN') router.push('/dashboard/admin');
        else if (user?.role === 'MENTOR') router.push('/dashboard/mentor');
        else if (user?.role === 'VENDOR' || user?.role === 'VENDOR_STAFF') router.push('/dashboard/vendor');
        else router.push('/dashboard/student');
        return;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.code === 'EMAIL_NOT_VERIFIED') {
          const email = formData.email.trim().toLowerCase();
          setUnverifiedEmail(email || null);
        }
        throw new Error(data?.error || 'Login failed');
      }

      const data = await res.json().catch(() => ({}));
      if (data?.code === 'TOTP_REQUIRED') {
        const t = typeof data?.tempToken === 'string' ? data.tempToken : '';
        if (!t) throw new Error('Token login tidak valid');
        setTempToken(t);
        setTotpCode('');
        setStep('totp');
        return;
      }

      const { user } = data;
      
      if (redirectTarget) {
        router.push(redirectTarget);
        return;
      }

      if (user.role === 'ADMIN') router.push('/dashboard/admin');
      else if (user.role === 'MENTOR') router.push('/dashboard/mentor');
      else if (user.role === 'VENDOR' || user.role === 'VENDOR_STAFF') router.push('/dashboard/vendor');
      else router.push('/dashboard/student');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePostLoginRedirect = (user: any) => {
    if (redirectTarget) {
      router.push(redirectTarget);
      return;
    }
    if (user?.role === 'ADMIN') router.push('/dashboard/admin');
    else if (user?.role === 'MENTOR') router.push('/dashboard/mentor');
    else if (user?.role === 'VENDOR' || user?.role === 'VENDOR_STAFF') router.push('/dashboard/vendor');
    else router.push('/dashboard/student');
  };

  useEffect(() => {
    if (!googleReady) return;
    if (!googleClientId) return;
    if (!googleButtonRef.current) return;
    const w = window as any;
    if (!w?.google?.accounts?.id) return;

    try {
      try {
        w.google.accounts.id.cancel();
      } catch {
      }

      w.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: any) => {
          const credential = typeof response?.credential === 'string' ? response.credential : '';
          if (!credential) return;
          setGoogleLoading(true);
          setError('');
          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Google login gagal');
            if (data?.code === 'TOTP_REQUIRED') {
              const t = typeof data?.tempToken === 'string' ? data.tempToken : '';
              if (!t) throw new Error('Token login tidak valid');
              setTempToken(t);
              setTotpCode('');
              setStep('totp');
              return;
            }
            if (data?.createdNew) {
              const email = typeof data?.user?.email === 'string' ? data.user.email.trim().toLowerCase() : '';
              const next =
                `/verify-email?provider=google&verified=1` +
                (email ? `&email=${encodeURIComponent(email)}` : '') +
                (redirectTarget ? `&redirect=${encodeURIComponent(redirectTarget)}` : '');
              router.push(next);
              return;
            }
            handlePostLoginRedirect(data?.user);
          } catch (e: any) {
            setError(e?.message || 'Google login gagal');
          } finally {
            setGoogleLoading(false);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      googleButtonRef.current.innerHTML = '';
      w.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 420,
        text: 'signin_with',
      });
      googleInitializedRef.current = true;
    } catch {
    }
  }, [googleReady, googleClientId, redirectTarget]);

  return (
    <div className="min-h-screen bg-slate-50">
      {googleClientId ? (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={() => setGoogleReady(true)}
          onLoad={() => setGoogleReady(true)}
        />
      ) : null}

      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
        <div className="hidden lg:flex relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-[420px] h-[420px] rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative z-10 w-full p-12 flex flex-col justify-between">
            <div>
              <div className="text-sm font-extrabold tracking-wide text-indigo-200">GEOSAINS LMS</div>
              <div className="mt-3 text-3xl font-extrabold leading-tight">Masuk untuk melanjutkan belajar.</div>
              <div className="mt-3 text-slate-200 max-w-md">
                Akses kursus, pantau progres, dan mulai belajar dari materi terbaik.
              </div>
            </div>
            <div className="text-xs text-slate-300">© {new Date().getFullYear()} Geosains LMS</div>
          </div>
        </div>

        <div className="flex items-center justify-center px-4 sm:px-6 py-10">
          <div className="w-full max-w-md">
            <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 sm:p-8">
              <div className="space-y-2">
                <div className="text-2xl font-extrabold text-slate-900">Masuk</div>
                <div className="text-sm text-slate-600">
                  {step === 'totp' ? 'Masukkan kode dari Google Authenticator.' : 'Gunakan email dan kata sandi Anda.'}
                </div>
              </div>

              {googleClientId ? (
                <div className="mt-6 space-y-4">
                  <div className="w-full flex justify-center">
                    <div
                      ref={googleButtonRef}
                      className={googleLoading ? 'pointer-events-none opacity-60' : undefined}
                    />
                  </div>
                  {process.env.NODE_ENV !== 'production' ? (
                    <div className="text-[11px] text-slate-500 text-center">
                      Google Client ID: {googleClientIdHint || '-'}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <div className="text-xs font-bold text-slate-500">atau</div>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                </div>
              ) : null}

              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 text-sm font-semibold flex gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="min-w-0">{error}</div>
                  </div>
                ) : null}
                {unverifiedEmail ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm font-semibold">
                    <div>Email belum terverifikasi.</div>
                    <div className="mt-1 text-xs font-bold">
                      <Link
                        href={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                        className="text-indigo-700 hover:text-indigo-900"
                      >
                        Verifikasi / Kirim ulang verifikasi
                      </Link>
                    </div>
                  </div>
                ) : null}

                {step === 'totp' ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700">Kode Verifikasi</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                        <input
                          name="totp"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          className="w-full h-12 pl-11 pr-4 rounded-2xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all"
                          placeholder="6 digit"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (loading) return;
                        setStep('password');
                        setTempToken(null);
                        setTotpCode('');
                      }}
                      className="w-full h-11 rounded-2xl border border-slate-200 bg-white text-slate-700 font-extrabold hover:bg-slate-50"
                      disabled={loading}
                    >
                      Kembali
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700">Email</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                        <input
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          className="w-full h-12 pl-11 pr-4 rounded-2xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all"
                          placeholder="nama@email.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700">Kata Sandi</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                        <input
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          className="w-full h-12 pl-11 pr-12 rounded-2xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all"
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-3 p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                          aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="mt-2 text-xs font-bold">
                        <Link href="/forgot-password" className="text-slate-600 hover:text-slate-900">
                          Lupa password?
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {step === 'totp' ? 'Verifikasi' : 'Masuk'}
                </button>

                <div className="text-sm text-slate-600 text-center">
                  Belum punya akun?{' '}
                  <Link
                    href={redirectTarget ? `/register?redirect=${encodeURIComponent(redirectTarget)}` : '/register'}
                    className="font-extrabold text-indigo-700 hover:text-indigo-800"
                  >
                    Daftar
                  </Link>
                </div>
              </form>
            </div>

            <div className="mt-6 text-xs text-slate-500 text-center">
              Dengan masuk, Anda menyetujui kebijakan dan ketentuan yang berlaku.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
