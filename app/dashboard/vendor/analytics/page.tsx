import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const role = payload?.role ? String(payload.role) : null;
  if (role !== 'VENDOR' && role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Pantau performa penjualan, order, dan operasional toko.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-2">
          <div className="text-sm font-extrabold text-slate-900">Sales Overview</div>
          <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
            <li>GMV &amp; jumlah order</li>
            <li>Produk terlaris</li>
            <li>Tren harian/mingguan</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-2">
          <div className="text-sm font-extrabold text-slate-900">Operasional</div>
          <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
            <li>Distribusi status order</li>
            <li>SLA proses &amp; pengiriman</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-2">
          <div className="text-sm font-extrabold text-slate-900">Funnel Produk</div>
          <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
            <li>View → cart → checkout → paid</li>
            <li>Drop-off per langkah</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-2">
          <div className="text-sm font-extrabold text-slate-900">Customer</div>
          <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
            <li>Repeat purchase</li>
            <li>Top pembeli</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
