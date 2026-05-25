"use client";

import { useState, useEffect } from 'react';

interface AffiliateStats {
  id: string;
  code: string;
  balance: number;
  pendingBalance?: number;
  clicks: number;
  conversions: number;
  links?: any[];
  withdrawals: any[];
  commissions: any[];
}

interface ReferralDashboardProps {
  initialStats?: AffiliateStats | null;
}

export default function ReferralDashboard({ initialStats }: ReferralDashboardProps) {
  const [stats, setStats] = useState<AffiliateStats | null>(initialStats || null);
  const [loading, setLoading] = useState(!initialStats);
  const [linkKind, setLinkKind] = useState<'COURSE' | 'PRODUCT'>('COURSE');
  const [courses, setCourses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const formatIdr = (n: number) => `IDR ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
  const formatDate = (value: any) => {
    const d = value instanceof Date ? value : new Date(String(value || ''));
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  };
  const badgeClass = (status: string) => {
    const s = String(status || '').toUpperCase();
    if (s === 'SUCCESS') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'FAILED' || s === 'REVERSED') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (s === 'EARNED') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/affiliate/stats', { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (res.ok) setStats(data as any);
      } catch (err) {
        console.error(err);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!stats?.code) return;
    let active = true;
    const load = async () => {
      try {
        if (linkKind === 'COURSE') {
          const data = await fetch('/api/courses?published=true').then((r) => r.json());
          if (!active) return;
          setCourses(Array.isArray(data) ? data : []);
        } else {
          const data = await fetch('/api/shop/products?take=100').then((r) => r.json());
          if (!active) return;
          setProducts(Array.isArray(data) ? data : []);
        }
      } catch {}
    };
    load();
    return () => {
      active = false;
    };
  }, [stats?.code, linkKind]);

  const refreshStats = async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await fetch('/api/affiliate/stats', { credentials: 'include' }).then((r) => r.json());
      setStats(refreshed);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const generateCode = async () => {
    try {
      const res = await fetch('/api/affiliate/generate', { method: 'POST' });
      await res.json().catch(() => null);
      const refreshed = await fetch('/api/affiliate/stats', { credentials: 'include' }).then((r) => r.json());
      setStats(refreshed);
    } catch (err) {
      console.error(err);
    }
  };

  const createLink = async () => {
    if (!stats?.code) return;
    setIsCreatingLink(true);
    try {
      const payload =
        linkKind === 'COURSE'
          ? { kind: 'COURSE', courseId: selectedCourseId }
          : { kind: 'PRODUCT', productId: selectedProductId };
      const res = await fetch('/api/affiliate/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal membuat link');
      await refreshStats();
      setSelectedCourseId('');
      setSelectedProductId('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingLink(false);
    }
  };

  const deactivateLink = async (id: string) => {
    try {
      const res = await fetch(`/api/affiliate/links/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus link');
      await refreshStats();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-sm text-slate-600">Memuat statistik afiliasi...</div>;

  if (!stats) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <h2 className="text-xl font-extrabold text-slate-900">Gabung Program Afiliasi</h2>
        <p className="text-sm text-slate-600 mt-2 mb-6">Dapatkan komisi dengan mengajak siswa mendaftar kursus.</p>
        <button
          onClick={generateCode}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700"
        >
          Buat Link Afiliasi
        </button>
      </div>
    );
  }

  const referralLink = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${stats.code}` : '';

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-extrabold text-slate-900 mb-4">Link Afiliasi Anda</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            readOnly
            value={referralLink}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-sm font-medium"
          />
          <button
            onClick={() => navigator.clipboard.writeText(referralLink)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
          >
            Salin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-slate-700 text-sm font-bold">Klik</h3>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">{stats.clicks}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-slate-700 text-sm font-bold">Konversi</h3>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">{stats.conversions}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-slate-700 text-sm font-bold">Saldo Tersedia</h3>
          <p className="text-3xl font-extrabold text-emerald-700 mt-2">IDR {Math.round(Number(stats.balance || 0)).toLocaleString('id-ID')}</p>
          <div className="text-xs text-slate-500 mt-2">
            Pending: <span className="font-extrabold text-slate-700">{formatIdr(Number(stats.pendingBalance || 0))}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-slate-900 text-sm font-extrabold mb-4">Komisi Terbaru</h3>
          {Array.isArray(stats.commissions) && stats.commissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4">Tanggal</th>
                    <th className="py-2 pr-4">Order</th>
                    <th className="py-2 pr-4">Jumlah</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.commissions.slice(0, 10).map((c: any) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{formatDate(c.createdAt)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{String(c.orderId || '-').slice(0, 12)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(c.amount)}</td>
                      <td className="py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${badgeClass(c.status)}`}>
                          {String(c.status || '-')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-600">Belum ada komisi.</div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-slate-900 text-sm font-extrabold mb-4">Withdraw Terbaru</h3>
          {Array.isArray(stats.withdrawals) && stats.withdrawals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4">Tanggal</th>
                    <th className="py-2 pr-4">Jumlah</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.withdrawals.slice(0, 10).map((w: any) => (
                    <tr key={w.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{formatDate(w.createdAt)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(w.amount)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${badgeClass(w.status)}`}>
                          {String(w.status || '-')}
                        </span>
                      </td>
                      <td className="py-2 text-slate-700">{w.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-600">Belum ada riwayat withdraw.</div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-slate-900 text-sm font-extrabold">Fokus Promosi</h3>
            <div className="text-xs text-slate-600 mt-1">Buat link khusus untuk produk/kursus tertentu dan pantau hasilnya.</div>
          </div>
          <button
            onClick={refreshStats}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-70"
          >
            {isRefreshing ? 'Memuat...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setLinkKind('COURSE')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold border ${linkKind === 'COURSE' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              >
                Kursus
              </button>
              <button
                onClick={() => setLinkKind('PRODUCT')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold border ${linkKind === 'PRODUCT' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              >
                Produk
              </button>
            </div>

            {linkKind === 'COURSE' ? (
              <div className="space-y-3">
                <label className="block text-xs font-extrabold text-slate-700">Pilih Kursus</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-medium"
                >
                  <option value="">-- Pilih kursus --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-extrabold text-slate-700">Pilih Produk</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-medium"
                >
                  <option value="">-- Pilih produk --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-end pt-4">
              <button
                onClick={createLink}
                disabled={isCreatingLink || (linkKind === 'COURSE' ? !selectedCourseId : !selectedProductId)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-70"
              >
                {isCreatingLink ? 'Membuat...' : 'Buat Link'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-extrabold text-slate-700 mb-3">Link Fokus Anda</div>
            {Array.isArray((stats as any).links) && (stats as any).links.length > 0 ? (
              <div className="space-y-3">
                {(stats as any).links.slice(0, 8).map((l: any) => {
                  const itemTitle = l?.course?.title || l?.product?.name || l?.title || l?.path || '-';
                  const path = String(l.path || '');
                  const shareUrl =
                    typeof window !== 'undefined'
                      ? `${window.location.origin}${path}${path.includes('?') ? '&' : '?'}ref=${encodeURIComponent(
                          stats.code
                        )}&al=${encodeURIComponent(String(l.id || ''))}`
                      : '';
                  return (
                    <div key={l.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-slate-900 truncate">{itemTitle}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            {String(l.kind || '-')} • Klik: <span className="font-extrabold text-slate-700">{Number(l.clicks || 0)}</span> • Konversi:{' '}
                            <span className="font-extrabold text-slate-700">{Number(l.conversions || 0)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => deactivateLink(String(l.id))}
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
                        >
                          Hapus
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <input
                          readOnly
                          value={shareUrl}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 text-xs font-medium"
                        />
                        <button
                          onClick={() => navigator.clipboard.writeText(shareUrl)}
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
                        >
                          Salin
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-2">
                          <div className="text-[11px] text-slate-500 font-bold">Total</div>
                          <div className="text-xs font-extrabold text-slate-900">{formatIdr(Number(l?.commission?.total || 0))}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-2">
                          <div className="text-[11px] text-slate-500 font-bold">Pending</div>
                          <div className="text-xs font-extrabold text-slate-900">{formatIdr(Number(l?.commission?.pending || 0))}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-2">
                          <div className="text-[11px] text-slate-500 font-bold">Tersedia</div>
                          <div className="text-xs font-extrabold text-slate-900">{formatIdr(Number(l?.commission?.available || 0))}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-600">Belum ada link fokus. Buat link untuk produk/kursus yang ingin dipromosikan.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
