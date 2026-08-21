"use client";

import { Suspense } from 'react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      if (!token) throw new Error('Token tidak ditemukan');
      if (!password || password.length < 8) throw new Error('Kata sandi minimal 8 karakter');
      if (password !== confirmPassword) throw new Error('Konfirmasi kata sandi tidak sama');

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal reset password');
      setDone(true);
      setTimeout(() => {
        router.push('/login');
      }, 400);
    } catch (e: any) {
      setError(e?.message || 'Gagal reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 sm:px-6 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 sm:p-8">
          <div className="space-y-2">
            <div className="text-2xl font-extrabold text-slate-900">Reset Password</div>
            <div className="text-sm text-slate-600">Buat kata sandi baru untuk akun Anda.</div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 text-sm font-semibold flex gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="min-w-0">{error}</div>
            </div>
          ) : null}

          {done ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 text-sm font-semibold flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div>Password berhasil diperbarui.</div>
                <div className="mt-2 text-xs font-bold">
                  <Link href="/login" className="text-indigo-700 hover:text-indigo-900">
                    Lanjutkan ke Login
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Kata Sandi Baru</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                  <input
                    type={show ? 'text' : 'password'}
                    className="w-full h-12 pl-11 pr-12 rounded-2xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-3 p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                    aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Konfirmasi Kata Sandi</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className="w-full h-12 pl-11 pr-12 rounded-2xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-3 p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                    aria-label={showConfirm ? 'Sembunyikan konfirmasi' : 'Tampilkan konfirmasi'}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={loading || !token}
                className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Simpan Password
              </button>

              {!token ? (
                <div className="text-sm text-slate-600 text-center">
                  Token tidak ditemukan.{' '}
                  <Link href="/forgot-password" className="font-extrabold text-indigo-700 hover:text-indigo-800">
                    Minta link reset
                  </Link>
                </div>
              ) : (
                <div className="text-sm text-slate-600 text-center">
                  Kembali ke{' '}
                  <Link href="/login" className="font-extrabold text-indigo-700 hover:text-indigo-800">
                    Login
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
