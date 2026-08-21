import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import VerifyEmailClient from './VerifyEmailClient';

export const dynamic = 'force-dynamic';

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 sm:px-6 py-10">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuat verifikasi…
          </div>
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
