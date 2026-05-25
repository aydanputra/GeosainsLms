"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, Mail, ShieldCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams();
  const emailParam = useMemo(() => (searchParams.get('email') || '').trim().toLowerCase(), [searchParams]);

  const [email, setEmail] = useState(emailParam);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  const submit = async () => {
    const normalized = email.trim().toLowerCase();
    setLoading(true);
    setError('');
    setDevUrl(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal memproses permintaan');
      setSent(true);
      if (typeof data?.devResetUrl === 'string' && data.devResetUrl.trim()) {
        setDevUrl(data.devResetUrl.trim());
      }
    } catch (e: any) {
      setError(e?.message || 'Gagal memproses permintaan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 sm:px-6 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 sm:p-8">
          <div className="space-y-2">
            <div className="text-2xl font-extrabold text-slate-900">Lupa Password</div>
            <div className="text-sm text-slate-600">
              Masukkan email Anda. Jika akun ditemukan, kami akan mengirim link reset password.
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 text-sm font-semibold flex gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="min-w-0">{error}</div>
            </div>
          ) : null}

          {sent ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 text-sm font-semibold flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div>Jika email terdaftar, link reset sudah dikirim.</div>
                <div className="mt-2 text-xs font-bold">
                  <Link href="/login" className="text-indigo-700 hover:text-indigo-900">
                    Kembali ke Login
                  </Link>
                </div>
              </div>
            </div>
          ) : (
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
                onClick={submit}
                disabled={loading}
                className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Kirim Link Reset
              </button>

              <div className="text-sm text-slate-600 text-center">
                Ingat password?{' '}
                <Link href="/login" className="font-extrabold text-indigo-700 hover:text-indigo-800">
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
          )}
        </div>
      </div>
    </div>
  );
}

