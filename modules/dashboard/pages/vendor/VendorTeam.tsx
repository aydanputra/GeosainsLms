"use client";

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Users } from 'lucide-react';

type VendorOption = { id: string; name: string; slug: string; status: string };
type MemberRow = { id: string; role: string; createdAt: string; user: { id: string; name: string | null; email: string } };

export default function VendorTeam({ vendors }: { vendors: VendorOption[] }) {
  const options = useMemo(() => vendors || [], [vendors]);
  const [activeVendorId, setActiveVendorId] = useState<string>(options[0]?.id || '');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeVendorId) return;
    let active = true;
    setIsLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/shop/vendors/${encodeURIComponent(activeVendorId)}/members`, { cache: 'no-store' });
        const data = await res.json().catch(() => []);
        if (!active) return;
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat anggota');
        setMembers(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!active) return;
        setMembers([]);
        toast.error(e?.message || 'Gagal memuat anggota');
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeVendorId]);

  const addMember = async () => {
    const value = email.trim().toLowerCase();
    if (!value) {
      toast.info('Masukkan email');
      return;
    }
    if (!activeVendorId) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/shop/vendors/${encodeURIComponent(activeVendorId)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal menambah anggota');
      toast.success('Anggota ditambahkan');
      setEmail('');
      setMembers((prev) => {
        const next = [data as MemberRow, ...prev.filter((m) => m.id !== (data as MemberRow).id)];
        return next;
      });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menambah anggota');
    } finally {
      setIsAdding(false);
    }
  };

  const removeMember = async (member: MemberRow) => {
    if (!activeVendorId) return;
    if (!confirm(`Hapus akses ${member.user.email} dari vendor ini?`)) return;
    setDeletingId(member.id);
    try {
      const res = await fetch(`/api/shop/vendors/${encodeURIComponent(activeVendorId)}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus anggota');
      toast.success('Anggota dihapus');
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus anggota');
    } finally {
      setDeletingId(null);
    }
  };

  if (options.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <Users className="w-8 h-8 text-slate-300 mx-auto" />
        <div className="mt-3 text-sm font-extrabold text-slate-900">Belum ada vendor</div>
        <div className="mt-1 text-sm text-slate-600">Hubungi admin untuk membuat vendor dan menetapkan Owner.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tim Vendor</h1>
          <p className="text-slate-500 text-sm mt-1">Tambahkan akun Co Instructor untuk membantu mengelola toko.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <select
          value={activeVendorId}
          onChange={(e) => setActiveVendorId(e.target.value)}
          className="w-full lg:w-96 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium"
        >
          {options.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.slug})
            </option>
          ))}
        </select>

        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email co-instructor/vendor staff..."
            className="w-full sm:w-72 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
          />
          <button
            type="button"
            onClick={addMember}
            disabled={isAdding}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            Tambah
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-extrabold text-slate-700">Daftar Anggota</div>
          <div className="text-xs text-slate-500 font-medium">{members.length} anggota</div>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-slate-600">Memuat...</div>
        ) : members.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">Belum ada anggota.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {members.map((m) => (
              <div key={m.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900 truncate">{m.user.name || m.user.email}</div>
                  <div className="text-xs text-slate-500 truncate">{m.user.email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                    {m.role === 'CO_INSTRUCTOR' ? 'Co Instructor' : m.role}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMember(m)}
                    disabled={deletingId === m.id}
                    className="w-9 h-9 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60 inline-flex items-center justify-center"
                    title="Hapus akses"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
