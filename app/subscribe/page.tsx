import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { Check, Crown } from 'lucide-react';

export const dynamic = 'force-dynamic';

function safeParseSettings(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toMoney(v: unknown) {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

export default async function SubscribePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect('/login?redirect=/subscribe');
  const user = await verifyToken(token);
  if (!user) redirect('/login?redirect=/subscribe');

  const page = await prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true } });
  const settings = safeParseSettings(page?.content);

  const monthlyPrice = toMoney((settings as any).subscriptionMonthlyPrice) ?? 99000;
  const yearlyPrice = toMoney((settings as any).subscriptionYearlyPrice) ?? 990000;

  const formatIdr = (n: number) => `IDR ${Math.round(n).toLocaleString('id-ID')}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-extrabold">
              <Crown className="w-4 h-4" />
              Paket Langganan
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-900 tracking-tight">Berlangganan</h1>
            <p className="mt-2 text-slate-600 font-medium">
              Akses kursus yang bertanda “Termasuk Langganan” selama masa langganan aktif.
            </p>
          </div>
          <Link href="/courses" className="text-sm font-bold text-slate-700 hover:text-slate-900">
            Lihat Katalog Kursus →
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold text-slate-900">Bulanan</div>
                <div className="mt-1 text-slate-600 font-semibold">Akses 30 hari</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold text-indigo-700">{formatIdr(monthlyPrice)}</div>
                <div className="text-xs text-slate-500 font-semibold">per 30 hari</div>
              </div>
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-700">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>Akses kursus eligible selama aktif</div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>Langsung putus saat langganan berakhir</div>
              </div>
            </div>

            <form action="/api/subscriptions/checkout" method="post" className="mt-6">
              <input type="hidden" name="plan" value="MONTHLY" />
              <button
                type="submit"
                className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
              >
                Berlangganan Bulanan
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold text-slate-900">Tahunan</div>
                <div className="mt-1 text-slate-600 font-semibold">Akses 365 hari</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold text-indigo-700">{formatIdr(yearlyPrice)}</div>
                <div className="text-xs text-slate-500 font-semibold">per tahun</div>
              </div>
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-700">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>Akses kursus eligible selama aktif</div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>Langsung putus saat langganan berakhir</div>
              </div>
            </div>

            <form action="/api/subscriptions/checkout" method="post" className="mt-6">
              <input type="hidden" name="plan" value="YEARLY" />
              <button
                type="submit"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-sm hover:bg-slate-800"
              >
                Berlangganan Tahunan
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <div className="font-extrabold text-slate-900">Catatan</div>
          <div className="mt-2">
            Langganan hanya berlaku untuk kursus yang diaktifkan “Termasuk Langganan” oleh admin. Kursus yang dibeli satuan tetap mengikuti
            aturan kursus (mis. validity days).
          </div>
        </div>
      </div>
    </div>
  );
}

