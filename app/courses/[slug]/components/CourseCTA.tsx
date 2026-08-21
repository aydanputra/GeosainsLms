'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { Loader2, Play, FileText, Globe, Check, Award, Tag, Info, Users } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeImageUrl, toOptimizedImageUrl } from '@/modules/core/utils/image';
import { useCourseDetailAccess } from './CourseDetailAccessProvider';

interface CourseCTAProps {
  course: any;
  totalLessons: number;
  totalDuration: number;
}

export default function CourseCTA({ course, totalLessons, totalDuration }: CourseCTAProps) {
  const router = useRouter();
  const access = useCourseDetailAccess();
  const [isLoading, setIsLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authStep, setAuthStep] = useState<'FORM' | 'TOTP'>('FORM');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authTotpCode, setAuthTotpCode] = useState('');
  const [authTempToken, setAuthTempToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [postAuthIntent, setPostAuthIntent] = useState<'ENROLL' | null>(null);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleInitializedRef = useRef(false);
  const [imgError, setImgError] = useState(false);
  const thumbnailUrl = normalizeImageUrl(course?.thumbnailUrl, { fallback: '/placeholder-course.jpg' }) || '/placeholder-course.jpg';
  const cardImageSrc = imgError
    ? '/placeholder-course.jpg'
    : toOptimizedImageUrl(thumbnailUrl, { width: 720, height: 405, fit: 'fill' }) || thumbnailUrl;

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

  useEffect(() => {
    if (!authOpen) return;
    if (authTab !== 'LOGIN') return;
    if (authStep !== 'FORM') return;
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
          setAuthLoading(true);
          setAuthError('');
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
              setAuthTempToken(t);
              setAuthStep('TOTP');
              setAuthTotpCode('');
              return;
            }
            await completeAuthAndContinue();
          } catch (e: any) {
            setAuthError(e?.message || 'Google login gagal');
          } finally {
            setAuthLoading(false);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      googleButtonRef.current.innerHTML = '';
      const containerWidth = googleButtonRef.current.clientWidth || 0;
      const buttonWidth = Math.min(420, Math.max(240, Math.floor(containerWidth || 320)));
      w.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: buttonWidth,
        text: 'signin_with',
      });
      googleInitializedRef.current = true;
    } catch {
    }
  }, [authOpen, authTab, authStep, googleReady, googleClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const slugifyTag = (raw: string) =>
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

  const discountPrice = typeof course?.price === 'number' && Number.isFinite(course.price) ? course.price : Number(course?.price || 0) || 0;
  const normalPrice =
    typeof course?.normalPrice === 'number' && Number.isFinite(course.normalPrice) ? course.normalPrice : course?.normalPrice ? Number(course.normalPrice) : 0;
  const showDiscountPrice = discountPrice > 0;
  const showNormalPrice = normalPrice > 0 && (!showDiscountPrice || normalPrice > discountPrice);

  const enrollNow = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/courses/${course.id}/enroll`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mendaftar kursus');
      }

      const data = await res.json();
      toast.success(data.message || 'Berhasil mendaftar kursus!');
      router.refresh();
      if (typeof data?.paymentUrl === 'string' && data.paymentUrl.trim()) {
        router.push(data.paymentUrl.trim());
      } else {
        router.push(data.redirectUrl || `/courses/${course.slug}/learn`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openAuth = (intent: 'ENROLL') => {
    setAuthError('');
    setAuthStep('FORM');
    setAuthTotpCode('');
    setAuthTempToken(null);
    setPostAuthIntent(intent);
    setAuthTab('LOGIN');
    setAuthOpen(true);
  };

  const completeAuthAndContinue = async () => {
    setAuthOpen(false);
    setAuthLoading(false);
    setAuthError('');
    router.refresh();
    const intent = postAuthIntent;
    setPostAuthIntent(null);
    if (intent === 'ENROLL') {
      await enrollNow();
    }
  };

  const handleAuthSubmit = async () => {
    if (authLoading) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authTab === 'LOGIN') {
        if (authStep === 'TOTP') {
          const token = authTempToken;
          if (!token) throw new Error('Token login tidak valid');
          const res = await fetch('/api/auth/2fa/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempToken: token, code: authTotpCode }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || 'Verifikasi 2 langkah gagal');
          await completeAuthAndContinue();
          return;
        }

        const email = authEmail.trim().toLowerCase();
        const password = authPassword;
        if (!email || !email.includes('@')) throw new Error('Email tidak valid');
        if (!password) throw new Error('Password wajib diisi');

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Gagal login');
        if (data?.code === 'TOTP_REQUIRED') {
          const t = typeof data?.tempToken === 'string' ? data.tempToken : '';
          if (!t) throw new Error('Token login tidak valid');
          setAuthTempToken(t);
          setAuthStep('TOTP');
          setAuthTotpCode('');
          return;
        }
        await completeAuthAndContinue();
        return;
      }

      const name = authName.trim();
      const email = authEmail.trim().toLowerCase();
      const password = authPassword;
      if (name.length < 2) throw new Error('Nama minimal 2 karakter');
      if (!email || !email.includes('@')) throw new Error('Email tidak valid');
      if (!password || password.length < 8) throw new Error('Password minimal 8 karakter');
      if (password !== authConfirmPassword) throw new Error('Konfirmasi password tidak sama');

      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'STUDENT' }),
      });
      const regData = await regRes.json().catch(() => ({}));
      if (!regRes.ok) throw new Error(regData?.error || 'Gagal mendaftar');

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginData = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok) throw new Error(loginData?.error || 'Gagal login');
      if (loginData?.code === 'TOTP_REQUIRED') {
        const t = typeof loginData?.tempToken === 'string' ? loginData.tempToken : '';
        if (!t) throw new Error('Token login tidak valid');
        setAuthTempToken(t);
        setAuthStep('TOTP');
        setAuthTotpCode('');
        setAuthTab('LOGIN');
        return;
      }
      await completeAuthAndContinue();
    } catch (e: any) {
      setAuthError(e?.message || 'Gagal memproses');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!access.isLoggedIn) {
      openAuth('ENROLL');
      return;
    }
    await enrollNow();
  };

  const handleContinue = () => {
    router.push(`/courses/${course.slug}/learn`);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden sticky top-24">
      {googleClientId ? (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={() => setGoogleReady(true)}
          onLoad={() => setGoogleReady(true)}
        />
      ) : null}
      <div className="aspect-video bg-slate-100 relative">
        <Image
          src={cardImageSrc}
          alt={course.title}
          fill
          sizes="(max-width: 1024px) 100vw, 420px"
          className="object-cover"
          onError={() => setImgError(true)}
        />
      </div>

      <div className="p-6 space-y-6">
        {!access.isEnrolled && typeof course?.prePurchaseNote === 'string' && course.prePurchaseNote.trim() ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
              <Info className="w-4 h-4" />
              Catatan
            </div>
            <div className="mt-2 text-sm text-amber-900/90 whitespace-pre-line">{course.prePurchaseNote.trim()}</div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="space-y-1">
            {showNormalPrice ? (
              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-500 font-semibold">Harga Normal</div>
                <div className="text-slate-500 line-through font-bold">Rp {Math.round(normalPrice).toLocaleString('id-ID')}</div>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-slate-500 font-semibold text-sm">{showNormalPrice && showDiscountPrice ? 'Harga Diskon' : 'Harga'}</div>
              {showDiscountPrice ? (
                <div className="text-3xl font-bold text-slate-900">Rp {Math.round(discountPrice).toLocaleString('id-ID')}</div>
              ) : (
                <div className="text-3xl font-bold text-slate-900">Gratis</div>
              )}
            </div>
          </div>
          
          {!access.isEnrolled && (
             <div className="text-emerald-600 text-sm font-medium flex items-center gap-1.5">
               <Check className="w-4 h-4" /> Akses Penuh Seumur Hidup
             </div>
          )}
        </div>

        <div className="space-y-3">
          {access.isEnrolled ? (
            <button 
              onClick={handleContinue}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              Lanjut Belajar
            </button>
          ) : (
            <button 
              onClick={handleEnroll}
              disabled={isLoading}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {course.price === 0 ? 'Daftar Sekarang' : 'Beli Kursus'}
                </>
              )}
            </button>
          )}

          {!access.isEnrolled && course?.subscriptionEligible ? (
            <Link
              href="/subscribe"
              className="w-full h-12 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-extrabold rounded-xl transition-colors flex items-center justify-center"
            >
              Berlangganan untuk Akses
            </Link>
          ) : null}
          
          {!access.isEnrolled && (
            <button className="w-full h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors">
              Tambah ke Wishlist
            </button>
          )}
        </div>

        <div className="space-y-4 pt-6 border-t border-slate-100">
          <h4 className="font-semibold text-slate-900 text-sm">Kursus ini mencakup:</h4>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-center gap-3">
              <Play className="w-4 h-4 text-slate-400" />
              <span>{Math.round(totalDuration)} menit video on-demand</span>
            </li>
            <li className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>{totalLessons} materi pelajaran</span>
            </li>
            <li className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-slate-400" />
              <span>Akses seumur hidup</span>
            </li>
            <li className="flex items-center gap-3">
              <Award className="w-4 h-4 text-slate-400" />
              <span>Sertifikat penyelesaian</span>
            </li>
          </ul>
        </div>

        {Array.isArray(course?.audience) && course.audience.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
              <Users className="w-4 h-4 text-slate-500" />
              Target Audience
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {course.audience
                .map((a: any) => (typeof a === 'string' ? a.trim() : ''))
                .filter(Boolean)
                .slice(0, 10)
                .map((a: string) => (
                  <span
                    key={a}
                    className="inline-flex items-center px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-extrabold"
                  >
                    {a}
                  </span>
                ))}
            </div>
          </div>
        ) : null}

        {Array.isArray(course?.tags) && course.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {course.tags
              .map((t: any) => (typeof t === 'string' ? t.trim() : ''))
              .filter(Boolean)
              .slice(0, 10)
              .map((t: string) => {
                const tagSlug = slugifyTag(t);
                const className =
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-extrabold";
                if (!tagSlug) {
                  return (
                    <span key={t} className={className}>
                      <Tag className="w-3.5 h-3.5 text-slate-400" />
                      {t}
                    </span>
                  );
                }
                return (
                  <Link key={t} href={`/course-tag/${encodeURIComponent(tagSlug)}`} className={className}>
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    {t}
                  </Link>
                );
              })}
          </div>
        ) : null}
      </div>

      {authOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => (authLoading ? null : setAuthOpen(false))} />
          <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-slate-900">Lanjutkan Pembelian</div>
                <div className="text-xs text-slate-600 mt-1">Masuk atau daftar untuk melanjutkan proses beli kursus.</div>
              </div>
              <button
                type="button"
                onClick={() => (authLoading ? null : setAuthOpen(false))}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>

            <div className="p-5">
              {authTab === 'LOGIN' && authStep === 'FORM' && googleClientId ? (
                <div className="mb-4">
                  <div className="w-full max-w-[420px] mx-auto">
                    <div ref={googleButtonRef} className={authLoading ? 'pointer-events-none opacity-60 w-full' : 'w-full'} />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <div className="text-[11px] font-extrabold text-slate-500">atau</div>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('LOGIN');
                    setAuthError('');
                    setAuthStep('FORM');
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold border ${authTab === 'LOGIN' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('REGISTER');
                    setAuthError('');
                    setAuthStep('FORM');
                    setAuthTotpCode('');
                    setAuthTempToken(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold border ${authTab === 'REGISTER' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                >
                  Daftar
                </button>
              </div>

              {authError ? (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-semibold">
                  {authError}
                </div>
              ) : null}

              <div className="space-y-3">
                {authTab === 'REGISTER' ? (
                  <div>
                    <div className="text-xs font-extrabold text-slate-700 mb-1.5">Nama</div>
                    <input
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-medium"
                      placeholder="Nama lengkap"
                      autoComplete="name"
                    />
                  </div>
                ) : null}

                <div>
                  <div className="text-xs font-extrabold text-slate-700 mb-1.5">Email</div>
                  <input
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-medium"
                    placeholder="email@contoh.com"
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>

                {authTab === 'LOGIN' && authStep === 'TOTP' ? (
                  <div>
                    <div className="text-xs font-extrabold text-slate-700 mb-1.5">Kode 2FA</div>
                    <input
                      value={authTotpCode}
                      onChange={(e) => setAuthTotpCode(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-medium"
                      placeholder="123456"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="text-xs font-extrabold text-slate-700 mb-1.5">Password</div>
                      <input
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-medium"
                        type="password"
                        placeholder="Password"
                        autoComplete={authTab === 'REGISTER' ? 'new-password' : 'current-password'}
                      />
                    </div>
                    {authTab === 'REGISTER' ? (
                      <div>
                        <div className="text-xs font-extrabold text-slate-700 mb-1.5">Konfirmasi Password</div>
                        <input
                          value={authConfirmPassword}
                          onChange={(e) => setAuthConfirmPassword(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-medium"
                          type="password"
                          placeholder="Ulangi password"
                          autoComplete="new-password"
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="pt-5 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleAuthSubmit}
                  disabled={authLoading}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-70 inline-flex items-center gap-2"
                >
                  {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {authTab === 'LOGIN' ? (authStep === 'TOTP' ? 'Verifikasi' : 'Masuk') : 'Daftar & Lanjutkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
