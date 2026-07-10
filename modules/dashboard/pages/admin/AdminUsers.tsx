"use client";

import { useEffect, useMemo, useState } from 'react';
import Table from '../../components/Tables';
import Cards from '../../components/Cards';
import EmptyState from '../../components/EmptyState';
import { Plus, Search, Filter, Edit2, Trash2, KeyRound, User, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useSearchParams } from 'next/navigation';

interface AdminUsersProps {
  users: any[];
}

export default function AdminUsers({ users: initialUsers }: AdminUsersProps) {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState(initialUsers);
  const [actorIsSuperAdmin, setActorIsSuperAdmin] = useState(false);
  const [filterRole, setFilterRole] = useState<'ALL' | 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR'>('ALL');
  const [searchQuery, setSearchQuery] = useState(() => (searchParams.get('q') || '').trim());
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<{ isOpen: boolean; ids: string[] }>({ isOpen: false, ids: [] });
  const [forceDeleteConfirm, setForceDeleteConfirm] = useState<{ isOpen: boolean; ids: string[]; reason?: string }>({
    isOpen: false,
    ids: [],
    reason: '',
  });
  const [isForceDeleting, setIsForceDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createValue, setCreateValue] = useState<{ name: string; email: string; password: string; role: 'STUDENT' | 'MENTOR' | 'ADMIN' | 'VENDOR'; isSuperAdmin: boolean }>({
    name: '',
    email: '',
    password: '',
    role: 'STUDENT',
    isSuperAdmin: false,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editValue, setEditValue] = useState<{ id: string; name: string; email: string; role: 'STUDENT' | 'MENTOR' | 'ADMIN' | 'VENDOR'; isSuperAdmin: boolean }>({
    id: '',
    name: '',
    email: '',
    role: 'STUDENT',
    isSuperAdmin: false,
  });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [showPasswordValue, setShowPasswordValue] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; name: string; email: string; role?: string; isSuperAdmin?: boolean } | null>(null);
  const [passwordValue, setPasswordValue] = useState<{ password: string; confirm: string }>({ password: '', confirm: '' });
  const displayRole = (value: string) => {
    if (value === 'VENDOR_STAFF') return 'STUDENT';
    return value;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store', credentials: 'include' });
        const data = await res.json().catch(() => ({ user: null }));
        if (!active) return;
        const me = data?.user;
        setActorIsSuperAdmin(Boolean(me?.isSuperAdmin));
      } catch {
        if (!active) return;
        setActorIsSuperAdmin(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesRole = filterRole === 'ALL' ? true : user.role === filterRole;
    const matchesSearch = 
      (user.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const visibleIds = useMemo(() => filteredUsers.map((u) => u.id as string), [filteredUsers]);
  const isAllVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    const set = new Set(selectedIds);
    return visibleIds.every((id) => set.has(id));
  }, [selectedIds, visibleIds]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prevSet.has(id));
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      for (const id of visibleIds) prevSet.add(id);
      return Array.from(prevSet);
    });
  };

  const metrics = [
    { label: 'Total Pengguna', value: users.length, color: 'bg-blue-500' },
    { label: 'Siswa', value: users.filter(u => u.role === 'STUDENT').length, color: 'bg-green-500' },
    { label: 'Mentor', value: users.filter(u => u.role === 'MENTOR').length, color: 'bg-indigo-500' },
    { label: 'Admin', value: users.filter(u => u.role === 'ADMIN').length, color: 'bg-purple-500' },
    { label: 'Vendor', value: users.filter(u => u.role === 'VENDOR').length, color: 'bg-amber-500' },
  ];

  const openEdit = (row: any) => {
    const id = typeof row?.id === 'string' ? row.id : '';
    if (!id) return;
    const rowRole = typeof row?.role === 'string' ? String(row.role).toUpperCase() : '';
    if (rowRole === 'ADMIN' && !actorIsSuperAdmin) {
      toast.error('Hanya Super Admin yang bisa mengubah akun admin');
      return;
    }
    setEditValue({
      id,
      name: typeof row?.name === 'string' ? row.name : '',
      email: typeof row?.email === 'string' ? row.email : '',
      role: (row?.role === 'ADMIN' || row?.role === 'MENTOR' || row?.role === 'STUDENT' || row?.role === 'VENDOR') ? row.role : 'STUDENT',
      isSuperAdmin: Boolean(row?.isSuperAdmin),
    });
    setEditOpen(true);
  };

  const renderPasswordInput = ({
    value,
    onChange,
    placeholder,
    show,
    onToggle,
    disabled = false,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    show: boolean;
    onToggle: () => void;
    disabled?: boolean;
  }) => (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-11 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={show ? 'Sembunyikan password' : 'Lihat password'}
        title={show ? 'Sembunyikan password' : 'Lihat password'}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );

  const updateUser = async () => {
    const id = editValue.id;
    const name = editValue.name.trim();
    const email = editValue.email.trim().toLowerCase();

    if (!id) return;
    if (name.length < 2) {
      toast.error('Nama minimal 2 karakter');
      return;
    }
    if (!email || !email.includes('@')) {
      toast.error('Email tidak valid');
      return;
    }

    setIsUpdating(true);
    try {
      const payload: any = { id, name, email, role: editValue.role };
      if (actorIsSuperAdmin && editValue.role === 'ADMIN') {
        payload.isSuperAdmin = Boolean(editValue.isSuperAdmin);
      }
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal mengupdate user');

      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? { ...u, name: data?.name ?? name, email: data?.email ?? email, role: data?.role ?? editValue.role, isSuperAdmin: Boolean(data?.isSuperAdmin) }
            : u
        )
      );
      toast.success('User berhasil diupdate');
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengupdate user');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const openSetPassword = (row: any) => {
    const id = typeof row?.id === 'string' ? row.id : '';
    if (!id) return;
    const name = typeof row?.name === 'string' ? row.name : '';
    const email = typeof row?.email === 'string' ? row.email : '';
    const role = typeof row?.role === 'string' ? row.role : '';
    const isSuperAdmin = Boolean(row?.isSuperAdmin) && String(role).toUpperCase() === 'ADMIN';
    setPasswordTarget({ id, name, email, role, isSuperAdmin });
    setPasswordValue({ password: '', confirm: '' });
    setShowPasswordValue(false);
    setShowPasswordConfirm(false);
    setPasswordOpen(true);
  };

  const submitSetPassword = async () => {
    const target = passwordTarget;
    if (!target?.id) return;

    const password = passwordValue.password;
    const confirm = passwordValue.confirm;
    const isTargetSuperAdmin = Boolean(target?.isSuperAdmin) && String(target?.role || '').toUpperCase() === 'ADMIN';
    const minLen = isTargetSuperAdmin ? 12 : 8;
    if (!password || password.length < minLen) {
      toast.error(`Password minimal ${minLen} karakter`);
      return;
    }
    if (password !== confirm) {
      toast.error('Konfirmasi password tidak sama');
      return;
    }

    setIsSettingPassword(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal mengganti password');

      toast.success(`Password berhasil diganti untuk ${target.email || target.name || 'user'}`);
      setPasswordOpen(false);
      setPasswordTarget(null);
      setPasswordValue({ password: '', confirm: '' });
      setShowPasswordValue(false);
      setShowPasswordConfirm(false);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengganti password');
    } finally {
      setIsSettingPassword(false);
    }
  };

  const columns = useMemo(() => {
    return [
    {
      header: (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-white/40"
            checked={isAllVisibleSelected}
            onChange={toggleAllVisible}
            disabled={visibleIds.length === 0 || isBulkDeleting}
            aria-label="Pilih semua user"
          />
        </div>
      ),
      accessorKey: 'selected',
      className: 'w-14',
      cell: (_val: unknown, row: any) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={selectedIds.includes(row.id)}
            onChange={() => toggleOne(row.id)}
            disabled={isBulkDeleting}
            aria-label={`Pilih user ${row.email}`}
          />
        </div>
      ),
    },
    { header: 'Nama Lengkap', accessorKey: 'name',
      cell: (val: string, row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
            {val.charAt(0)}
          </div>
          <div>
            <div className="font-medium text-slate-900">{val}</div>
            <div className="text-xs text-slate-500 md:hidden">{row.email}</div>
          </div>
        </div>
      )
    },
    { header: 'Email', accessorKey: 'email',
      cell: (val: string) => <div className="text-slate-600 text-sm hidden md:block">{val}</div>
    },
    { header: 'Role', accessorKey: 'role', 
      cell: (val: string, row: any) => (
        <div className="flex items-center gap-2">
          <span className={twMerge(
            "px-3 py-1 rounded-full text-xs font-medium border",
            val === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
            val === 'MENTOR' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
            val === 'VENDOR' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-green-50 text-green-700 border-green-200'
          )}>
            {displayRole(val)}
          </span>
          {val === 'ADMIN' && row?.isSuperAdmin ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
              Super Admin
            </span>
          ) : null}
        </div>
      ) 
    },
    { header: 'Status', accessorKey: 'status',
      cell: (val: string) => (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Aktif
        </span>
      )
    },
    { header: 'Aksi', accessorKey: 'id',
      cell: (id: string, row: any) => (
        <div className="flex gap-2 justify-end">
           <button
            onClick={() => openEdit(row)}
            title="Edit User"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
           <button 
            onClick={() => openSetPassword(row)}
            title="Ganti Password"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDelete(id)}
            title="Hapus User"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];
  }, [isAllVisibleSelected, isBulkDeleting, selectedIds, toggleAllVisible, visibleIds.length]);

  const confirmDelete = () => {
    (async () => {
      if (!deleteConfirm.id) {
        setDeleteConfirm({ isOpen: false, id: null });
        return;
      }
      try {
        const res = await fetch('/api/users', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: deleteConfirm.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Gagal menghapus user');

        const deletedIds = Array.isArray(data?.deletedIds) ? (data.deletedIds as string[]) : [];
        const blocked = Array.isArray(data?.blocked) ? data.blocked : [];
        if (deletedIds.includes(deleteConfirm.id)) {
          setUsers((prev) => prev.filter((u) => u.id !== deleteConfirm.id));
          setSelectedIds((prev) => prev.filter((id) => id !== deleteConfirm.id));
          toast.success('Pengguna berhasil dihapus');
        } else {
          const reason = blocked?.find?.((b: any) => b?.id === deleteConfirm.id)?.reason;
          setForceDeleteConfirm({ isOpen: true, ids: [deleteConfirm.id], reason: reason || '' });
        }
      } catch (e: any) {
        toast.error(e?.message || 'Gagal menghapus user');
      } finally {
        setDeleteConfirm({ isOpen: false, id: null });
      }
    })();
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) {
      toast.info('Pilih minimal 1 pengguna');
      return;
    }
    setBulkDeleteConfirm({ isOpen: true, ids: selectedIds });
  };

  const openCreate = () => {
    setCreateValue({ name: '', email: '', password: '', role: 'STUDENT', isSuperAdmin: false });
    setShowCreatePassword(false);
    setCreateOpen(true);
  };

  const createUser = async () => {
    const name = createValue.name.trim();
    const email = createValue.email.trim().toLowerCase();
    const password = createValue.password;

    if (name.length < 2) {
      toast.error('Nama minimal 2 karakter');
      return;
    }
    if (!email || !email.includes('@')) {
      toast.error('Email tidak valid');
      return;
    }
    const isCreateSuperAdmin = Boolean(createValue.isSuperAdmin) && String(createValue.role || '').toUpperCase() === 'ADMIN' && actorIsSuperAdmin;
    const minLen = isCreateSuperAdmin ? 12 : 8;
    if (!password || password.length < minLen) {
      toast.error(`Password minimal ${minLen} karakter`);
      return;
    }

    setIsCreating(true);
    try {
      const payload: any = { name, email, password, role: createValue.role };
      if (actorIsSuperAdmin && createValue.role === 'ADMIN') {
        payload.isSuperAdmin = Boolean(createValue.isSuperAdmin);
      }
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal membuat user');

      setUsers((prev) => [
        {
          id: data.id,
          name: data.name || name,
          email: data.email || email,
          role: data.role || createValue.role,
          isSuperAdmin: Boolean(data.isSuperAdmin),
          status: 'ACTIVE',
        },
        ...prev,
      ]);
      toast.success('User berhasil ditambahkan');
      setCreateOpen(false);
      setShowCreatePassword(false);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal membuat user');
    } finally {
      setIsCreating(false);
    }
  };

  const forceDeleteContent = (opts: { count: number; reason?: string }) => {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-red-200 flex items-center justify-center text-red-600 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-red-700">Hapus Paksa (Permanen)</div>
              <div className="text-xs text-red-700/80 mt-1">
                Akan menghapus permanen {opts.count} pengguna beserta data terkait. Tindakan ini tidak bisa dibatalkan.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-extrabold text-slate-900">Resiko</div>
          <div className="text-xs text-slate-600 mt-2">
            Data yang terkait dengan pengguna bisa ikut terhapus (kursus, progress, transaksi, konten, notifikasi, dan lain-lain).
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-xs font-extrabold text-amber-800">Jika user adalah instruktur kursus</div>
          <div className="text-xs text-amber-800/80 mt-1">
            Kursus yang dia ajar akan dipindahkan ke akun ADMIN yang sedang login agar data kursus tetap utuh.
          </div>
        </div>

        {opts.reason ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-extrabold text-slate-800">Alasan diblok</div>
            <div className="text-xs text-slate-600 mt-1 whitespace-pre-wrap break-words">{opts.reason}</div>
          </div>
        ) : null}
      </div>
    );
  };

  const bulkDeleteContent = (opts: { count: number }) => {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-extrabold text-slate-900">Hapus {opts.count} pengguna terpilih?</div>
          <div className="text-xs text-slate-600 mt-1">
            Penghapusan bersifat permanen. Pengguna yang masih punya relasi data mungkin tidak bisa dihapus.
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Jika sebagian gagal karena relasi data, kamu bisa lanjutkan dengan Hapus Paksa.
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Pengguna</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola data siswa, mentor, dan administrator.</p>
        </div>
        <button 
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> Tambah User
        </button>
      </div>

      <Cards metrics={metrics} isLoading={false} />

      {/* Search & Filter Bar - Floating Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input 
            type="text" 
            placeholder="Cari nama atau email..." 
            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white transition-colors">
            <Filter className="w-4 h-4 text-slate-500" />
            <select 
              className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer p-0 pr-6"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as any)}
            >
              <option value="ALL">Semua Role</option>
              <option value="ADMIN">Admin</option>
              <option value="MENTOR">Mentor</option>
              <option value="STUDENT">Siswa</option>
              <option value="VENDOR">Vendor</option>
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={isAllVisibleSelected}
              onChange={toggleAllVisible}
              disabled={visibleIds.length === 0 || isBulkDeleting}
            />
            Pilih semua
          </label>
          <div className="text-xs text-slate-500 font-medium">{selectedIds.length ? `${selectedIds.length} dipilih` : `${filteredUsers.length} item`}</div>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0 || isBulkDeleting}
            className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100 disabled:opacity-60"
          >
            Hapus Terpilih
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        {filteredUsers.length > 0 ? (
          <Table 
            columns={columns} 
            data={filteredUsers} 
            isLoading={false}
          />
        ) : (
          <EmptyState 
            icon={User} 
            title="Tidak ada pengguna ditemukan" 
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : "Belum ada data pengguna."}
          />
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredUsers.length === 0 ? (
          <EmptyState 
            icon={User} 
            title="Tidak ada pengguna" 
            description="Belum ada data pengguna untuk ditampilkan."
          />
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 mt-1"
                  checked={selectedIds.includes(user.id)}
                  onChange={() => toggleOne(user.id)}
                  disabled={isBulkDeleting}
                  aria-label={`Pilih user ${user.email}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{user.name}</h3>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <span
                      className={twMerge(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap",
                        user.role === 'ADMIN'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : user.role === 'MENTOR'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : user.role === 'VENDOR'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-green-50 text-green-700 border-green-200'
                      )}
                    >
                      {displayRole(user.role)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                <button
                  onClick={() => openEdit(user)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Edit
                </button>
                <button 
                  onClick={() => openSetPassword(user)}
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  Ganti Password
                </button>
                <button 
                  onClick={() => handleDelete(user.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200">
              <div className="text-lg font-extrabold text-slate-900">Edit Pengguna</div>
              <div className="text-xs text-slate-500 mt-1">Ubah nama, email, dan role pengguna.</div>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <div className="text-xs font-extrabold text-slate-700">Nama</div>
                <input
                  value={editValue.name}
                  onChange={(e) => setEditValue((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                  placeholder="Nama lengkap"
                  disabled={isUpdating}
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-extrabold text-slate-700">Email</div>
                <input
                  value={editValue.email}
                  onChange={(e) => setEditValue((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                  placeholder="Email"
                  disabled={isUpdating}
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-extrabold text-slate-700">Role</div>
                <select
                  value={editValue.role}
                  onChange={(e) => setEditValue((p) => ({ ...p, role: e.target.value as any, isSuperAdmin: e.target.value === 'ADMIN' ? p.isSuperAdmin : false }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                  disabled={isUpdating}
                >
                  {actorIsSuperAdmin ? <option value="ADMIN">Admin</option> : null}
                  <option value="MENTOR">Mentor</option>
                  <option value="STUDENT">Siswa</option>
                  <option value="VENDOR">Vendor</option>
                </select>
              </div>
              {actorIsSuperAdmin && editValue.role === 'ADMIN' ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                      checked={Boolean(editValue.isSuperAdmin)}
                      onChange={(e) => setEditValue((p) => ({ ...p, isSuperAdmin: e.target.checked }))}
                      disabled={isUpdating}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900">Jadikan Super Admin</div>
                      <div className="text-xs text-slate-500 mt-1">Akses penuh untuk fitur platform dan aksi finansial.</div>
                    </div>
                  </label>
                </div>
              ) : null}
            </div>
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => (isUpdating ? null : setEditOpen(false))}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60"
                disabled={isUpdating}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={updateUser}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                disabled={isUpdating}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200">
              <div className="text-lg font-extrabold text-slate-900">Ganti Password Pengguna</div>
              <div className="text-xs text-slate-500 mt-1">{passwordTarget?.email || '-'}</div>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <div className="text-xs font-extrabold text-slate-700">Password Baru</div>
                {renderPasswordInput({
                  value: passwordValue.password,
                  onChange: (value) => setPasswordValue((p) => ({ ...p, password: value })),
                  placeholder: passwordTarget?.isSuperAdmin ? 'Minimal 12 karakter' : 'Minimal 8 karakter',
                  show: showPasswordValue,
                  onToggle: () => setShowPasswordValue((prev) => !prev),
                  disabled: isSettingPassword,
                })}
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-extrabold text-slate-700">Konfirmasi Password</div>
                {renderPasswordInput({
                  value: passwordValue.confirm,
                  onChange: (value) => setPasswordValue((p) => ({ ...p, confirm: value })),
                  placeholder: 'Ulangi password',
                  show: showPasswordConfirm,
                  onToggle: () => setShowPasswordConfirm((prev) => !prev),
                  disabled: isSettingPassword,
                })}
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => (isSettingPassword ? null : setPasswordOpen(false))}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60"
                disabled={isSettingPassword}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitSetPassword}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white font-extrabold text-sm hover:bg-amber-700 disabled:opacity-60"
                disabled={isSettingPassword}
              >
                {isSettingPassword ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog 
        isOpen={deleteConfirm.isOpen}
        title="Hapus Pengguna"
        description="Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={confirmDelete}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={bulkDeleteConfirm.isOpen}
        title="Konfirmasi Penghapusan"
        content={bulkDeleteContent({ count: bulkDeleteConfirm.ids.length })}
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={isBulkDeleting}
        onClose={() => {
          if (isBulkDeleting) return;
          setBulkDeleteConfirm({ isOpen: false, ids: [] });
        }}
        onConfirm={() => {
          if (bulkDeleteConfirm.ids.length === 0) return;
          setIsBulkDeleting(true);
          (async () => {
            try {
              const res = await fetch('/api/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: bulkDeleteConfirm.ids }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data?.error || 'Gagal menghapus user');

              const deletedIds = Array.isArray(data?.deletedIds) ? (data.deletedIds as string[]) : [];
              const blocked = Array.isArray(data?.blocked) ? (data.blocked as any[]) : [];

              if (deletedIds.length > 0) {
                const deletedSet = new Set(deletedIds);
                setUsers((prev) => prev.filter((u) => !deletedSet.has(u.id)));
                setSelectedIds((prev) => prev.filter((id) => !deletedSet.has(id)));
                toast.success(`User dihapus: ${deletedIds.length}`);
              }

              if (blocked.length > 0) {
                const blockedIds = blocked.map((b: any) => String(b?.id || '')).filter(Boolean);
                setForceDeleteConfirm({ isOpen: true, ids: blockedIds, reason: '' });
                toast.error(`Tidak bisa dihapus: ${blocked.length} user (punya relasi data)`);
              }

              setBulkDeleteConfirm({ isOpen: false, ids: [] });
            } catch (e: any) {
              toast.error(e?.message || 'Gagal menghapus user');
            } finally {
              setIsBulkDeleting(false);
            }
          })();
        }}
      />

      <ConfirmDialog
        isOpen={forceDeleteConfirm.isOpen}
        title="Konfirmasi Hapus Paksa"
        content={forceDeleteContent({ count: forceDeleteConfirm.ids.length, reason: forceDeleteConfirm.reason })}
        confirmText="Hapus Paksa"
        cancelText="Batal"
        variant="danger"
        isLoading={isForceDeleting}
        onClose={() => {
          if (isForceDeleting) return;
          setForceDeleteConfirm({ isOpen: false, ids: [], reason: '' });
        }}
        onConfirm={() => {
          if (forceDeleteConfirm.ids.length === 0) return;
          setIsForceDeleting(true);
          (async () => {
            try {
              const res = await fetch('/api/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: forceDeleteConfirm.ids, force: true }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data?.error || 'Gagal hapus paksa');

              const deletedIds = Array.isArray(data?.deletedIds) ? (data.deletedIds as string[]) : [];
              const blocked = Array.isArray(data?.blocked) ? (data.blocked as any[]) : [];

              if (deletedIds.length > 0) {
                const deletedSet = new Set(deletedIds);
                setUsers((prev) => prev.filter((u) => !deletedSet.has(u.id)));
                setSelectedIds((prev) => prev.filter((id) => !deletedSet.has(id)));
                toast.success(`User dihapus (paksa): ${deletedIds.length}`);
              }

              if (blocked.length > 0) {
                toast.error(`Masih gagal dihapus: ${blocked.length} user`);
              }

              setForceDeleteConfirm({ isOpen: false, ids: [], reason: '' });
            } catch (e: any) {
              toast.error(e?.message || 'Gagal hapus paksa');
            } finally {
              setIsForceDeleting(false);
            }
          })();
        }}
      />

      {createOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900">Tambah User</div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Nama</label>
                <input
                  value={createValue.name}
                  onChange={(e) => setCreateValue((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Nama lengkap"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Email</label>
                <input
                  value={createValue.email}
                  onChange={(e) => setCreateValue((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="user@domain.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Role</label>
                <select
                  value={createValue.role}
                  onChange={(e) => setCreateValue((p) => ({ ...p, role: e.target.value as any, isSuperAdmin: e.target.value === 'ADMIN' ? p.isSuperAdmin : false }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="STUDENT">STUDENT</option>
                  <option value="MENTOR">MENTOR</option>
                  {actorIsSuperAdmin ? <option value="ADMIN">ADMIN</option> : null}
                  <option value="VENDOR">VENDOR</option>
                </select>
              </div>
              {actorIsSuperAdmin && createValue.role === 'ADMIN' ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                      checked={Boolean(createValue.isSuperAdmin)}
                      onChange={(e) => setCreateValue((p) => ({ ...p, isSuperAdmin: e.target.checked }))}
                      disabled={isCreating}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900">Jadikan Super Admin</div>
                      <div className="text-xs text-slate-500 mt-1">Akses penuh untuk fitur platform dan aksi finansial.</div>
                    </div>
                  </label>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Password</label>
                {renderPasswordInput({
                  value: createValue.password,
                  onChange: (value) => setCreateValue((p) => ({ ...p, password: value })),
                  placeholder: createValue.role === 'ADMIN' && createValue.isSuperAdmin ? 'Minimal 12 karakter' : 'Minimal 8 karakter',
                  show: showCreatePassword,
                  onToggle: () => setShowCreatePassword((prev) => !prev),
                  disabled: isCreating,
                })}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                disabled={isCreating}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={createUser}
                disabled={isCreating}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-60"
              >
                {isCreating ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
