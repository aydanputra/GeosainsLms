"use client";

import { useMemo, useState } from 'react';
import Table from '../../components/Tables';
import Cards from '../../components/Cards';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, Search, Edit2, Trash2, Store, Image as ImageIcon, Eye, Check, X } from 'lucide-react';
import { toast } from 'sonner';

type VendorPermissions = {
  canCreate: boolean;
  canEdit: boolean;
  canChangeStatus: boolean;
  canDelete: boolean;
};

type VendorRow = {
  id: string;
  name: string;
  slug: string;
  ownerId?: string | null;
  ownerEmail?: string | null;
  ownerName?: string | null;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  idNumber: string | null;
  idDocumentUrl: string | null;
  verificationNote: string | null;
  commissionType: 'PERCENT' | 'FLAT';
  commissionRate: number;
  ratingAvg?: number;
  ratingCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

type VendorForm = {
  id?: string;
  name: string;
  slug: string;
  ownerEmail: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  idNumber: string;
  idDocumentUrl: string;
  verificationNote: string;
  commissionType: 'PERCENT' | 'FLAT';
  commissionRate: number;
};

function normalizeForm(value: Partial<VendorRow>): VendorForm {
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    name: typeof value.name === 'string' ? value.name : '',
    slug: typeof value.slug === 'string' ? value.slug : '',
    ownerEmail: typeof value.ownerEmail === 'string' ? value.ownerEmail : '',
    description: typeof value.description === 'string' ? value.description : '',
    logoUrl: typeof value.logoUrl === 'string' && !value.logoUrl.startsWith('blob:') ? value.logoUrl : '',
    coverUrl: typeof value.coverUrl === 'string' && !value.coverUrl.startsWith('blob:') ? value.coverUrl : '',
    status:
      value.status === 'APPROVED' || value.status === 'REJECTED' || value.status === 'SUSPENDED' || value.status === 'PENDING'
        ? value.status
        : 'PENDING',
    contactEmail: typeof value.contactEmail === 'string' ? value.contactEmail : '',
    contactPhone: typeof value.contactPhone === 'string' ? value.contactPhone : '',
    addressLine1: typeof value.addressLine1 === 'string' ? value.addressLine1 : '',
    addressLine2: typeof value.addressLine2 === 'string' ? value.addressLine2 : '',
    city: typeof value.city === 'string' ? value.city : '',
    province: typeof value.province === 'string' ? value.province : '',
    postalCode: typeof value.postalCode === 'string' ? value.postalCode : '',
    country: typeof value.country === 'string' ? value.country : '',
    idNumber: typeof value.idNumber === 'string' ? value.idNumber : '',
    idDocumentUrl: typeof value.idDocumentUrl === 'string' && !value.idDocumentUrl.startsWith('blob:') ? value.idDocumentUrl : '',
    verificationNote: typeof value.verificationNote === 'string' ? value.verificationNote : '',
    commissionType: value.commissionType === 'FLAT' || value.commissionType === 'PERCENT' ? value.commissionType : 'PERCENT',
    commissionRate: typeof value.commissionRate === 'number' && Number.isFinite(value.commissionRate) ? value.commissionRate : 10,
  };
}

export default function AdminVendors({
  vendors: initialVendors,
  permissions,
}: {
  vendors: VendorRow[];
  permissions?: Partial<VendorPermissions>;
}) {
  const resolvedPermissions: VendorPermissions = {
    canCreate: true,
    canEdit: true,
    canChangeStatus: true,
    canDelete: true,
    ...(permissions || {}),
  };
  const [vendors, setVendors] = useState<VendorRow[]>(initialVendors || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [editorValue, setEditorValue] = useState<VendorForm>({
    name: '',
    slug: '',
    ownerEmail: '',
    description: '',
    logoUrl: '',
    coverUrl: '',
    status: 'PENDING',
    contactEmail: '',
    contactPhone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    province: '',
    postalCode: '',
    country: '',
    idNumber: '',
    idDocumentUrl: '',
    verificationNote: '',
    commissionType: 'PERCENT',
    commissionRate: 10,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<'LOGO' | 'COVER' | 'ID'>('LOGO');
  const [rejectDialog, setRejectDialog] = useState<{ isOpen: boolean; id: string | null; name: string }>({
    isOpen: false,
    id: null,
    name: '',
  });
  const [rejectNote, setRejectNote] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => v.name.toLowerCase().includes(q) || v.slug.toLowerCase().includes(q));
  }, [vendors, searchQuery]);

  const metrics = [
    { label: 'Total Vendor', value: vendors.length, color: 'bg-blue-500' },
    { label: 'Vendor Aktif', value: vendors.filter((v) => v.status === 'APPROVED').length, color: 'bg-indigo-500' },
  ];

  const openCreate = () => {
    if (!resolvedPermissions.canCreate) {
      toast.error('Anda tidak memiliki izin untuk menambah vendor');
      return;
    }
    setEditorMode('CREATE');
    setWizardStep(1);
    setEditorValue({
      name: '',
      slug: '',
      ownerEmail: '',
      description: '',
      logoUrl: '',
      coverUrl: '',
      status: 'PENDING',
      contactEmail: '',
      contactPhone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      province: '',
      postalCode: '',
      country: '',
      idNumber: '',
      idDocumentUrl: '',
      verificationNote: '',
      commissionType: 'PERCENT',
      commissionRate: 10,
    });
    setEditorOpen(true);
  };

  const openEdit = (row: VendorRow) => {
    if (!resolvedPermissions.canEdit) {
      toast.error('Anda tidak memiliki izin untuk mengedit vendor');
      return;
    }
    setEditorMode('EDIT');
    setWizardStep(1);
    setEditorValue(normalizeForm(row));
    setEditorOpen(true);
  };

  const save = async () => {
    const isEdit = editorMode === 'EDIT' && !!editorValue.id;
    if (isEdit && !resolvedPermissions.canEdit) {
      toast.error('Anda tidak memiliki izin untuk mengedit vendor');
      return;
    }
    if (!isEdit && !resolvedPermissions.canCreate) {
      toast.error('Anda tidak memiliki izin untuk menambah vendor');
      return;
    }

    if (!editorValue.name.trim()) {
      toast.error('Nama vendor wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: editorValue.name.trim(),
        slug: editorValue.slug.trim(),
        ownerEmail: editorValue.ownerEmail.trim(),
        description: editorValue.description.trim(),
        logoUrl: editorValue.logoUrl.trim(),
        coverUrl: editorValue.coverUrl.trim(),
        status: editorValue.status,
        contactEmail: editorValue.contactEmail.trim(),
        contactPhone: editorValue.contactPhone.trim(),
        addressLine1: editorValue.addressLine1.trim(),
        addressLine2: editorValue.addressLine2.trim(),
        city: editorValue.city.trim(),
        province: editorValue.province.trim(),
        postalCode: editorValue.postalCode.trim(),
        country: editorValue.country.trim(),
        idNumber: editorValue.idNumber.trim(),
        idDocumentUrl: editorValue.idDocumentUrl.trim(),
        verificationNote: editorValue.verificationNote.trim(),
        commissionType: editorValue.commissionType,
        commissionRate: Number(editorValue.commissionRate),
      };

      const url = isEdit ? `/api/shop/vendors/${editorValue.id}` : '/api/shop/vendors';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan vendor');

      if (isEdit) {
        setVendors((prev) => prev.map((v) => (v.id === data.id ? data : v)));
        toast.success('Vendor berhasil diperbarui');
      } else {
        setVendors((prev) => [data, ...prev]);
        toast.success('Vendor berhasil ditambahkan');
      }

      setEditorOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan vendor');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!resolvedPermissions.canDelete) {
      toast.error('Anda tidak memiliki izin untuk menghapus vendor');
      setDeleteConfirm({ isOpen: false, id: null });
      return;
    }
    if (!deleteConfirm.id) {
      setDeleteConfirm({ isOpen: false, id: null });
      return;
    }

    try {
      const res = await fetch(`/api/shop/vendors/${deleteConfirm.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus vendor');
      setVendors((prev) => prev.filter((v) => v.id !== deleteConfirm.id));
      toast.success(data.message || 'Vendor berhasil dihapus');
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus vendor');
    } finally {
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const setStatus = async (id: string, nextStatus: VendorRow['status'], note?: string) => {
    if (!resolvedPermissions.canChangeStatus) {
      toast.error('Anda tidak memiliki izin untuk mengubah status vendor');
      return false;
    }
    try {
      setIsUpdatingStatus(true);
      const payload: any = { status: nextStatus };
      if (typeof note === 'string') payload.verificationNote = note;
      const res = await fetch(`/api/shop/vendors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui status vendor');
      setVendors((prev) => prev.map((v) => (v.id === data.id ? data : v)));
      toast.success('Status vendor berhasil diperbarui');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Gagal memperbarui status vendor');
      return false;
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const columns = [
    {
      header: 'Vendor',
      accessorKey: 'name',
      cell: (val: string, row: VendorRow) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
            {row.logoUrl ? (
              <Image src={row.logoUrl} alt={row.name} fill unoptimized className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <ImageIcon className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 truncate">{val}</div>
            <div className="font-mono text-xs text-slate-500 truncate">{row.slug}</div>
            {row.ownerEmail ? <div className="text-xs text-slate-500 truncate">Owner: {row.ownerEmail}</div> : null}
          </div>
        </div>
      ),
    },
    {
      header: 'Deskripsi',
      accessorKey: 'description',
      cell: (val: string | null) => <div className="text-sm text-slate-600 line-clamp-1">{val || '-'}</div>,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (val: VendorRow['status']) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
          {val === 'APPROVED' ? 'Aktif' : val === 'PENDING' ? 'Menunggu' : val === 'REJECTED' ? 'Ditolak' : 'Suspended'}
        </span>
      ),
    },
    {
      header: 'Aksi',
      accessorKey: 'id',
      cell: (_id: string, row: VendorRow) => (
        <div className="flex items-center justify-end gap-2">
          {resolvedPermissions.canChangeStatus && row.status === 'PENDING' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`Setujui vendor "${row.name}"?`)) return;
                  void setStatus(row.id, 'APPROVED');
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                title="Approve"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectDialog({ isOpen: true, id: row.id, name: row.name });
                  setRejectNote(row.verificationNote || '');
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Reject"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : null}
          <Link
            href={`/vendor/${row.slug}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Lihat Toko"
          >
            <Eye className="w-4 h-4" />
          </Link>
          {resolvedPermissions.canEdit ? (
            <button
              type="button"
              onClick={() => openEdit(row)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          ) : null}
          {resolvedPermissions.canDelete ? (
            <button
              type="button"
              onClick={() => setDeleteConfirm({ isOpen: true, id: row.id })}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Hapus"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Vendor</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola vendor untuk dukungan multi-vendor.</p>
        </div>
        {resolvedPermissions.canCreate ? (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Tambah Vendor
          </button>
        ) : null}
      </div>

      <Cards metrics={metrics} isLoading={false} />

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Cari vendor..."
            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="hidden md:block">
        {filtered.length > 0 ? (
          <Table columns={columns} data={filtered} isLoading={false} />
        ) : (
          <EmptyState
            icon={Store}
            title="Tidak ada vendor"
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : 'Belum ada vendor yang ditambahkan.'}
            action={!searchQuery && resolvedPermissions.canCreate ? { label: 'Tambah Vendor Baru', onClick: openCreate } : undefined}
          />
        )}
      </div>

      <div className="md:hidden space-y-4">
        {filtered.length === 0 ? (
          <EmptyState icon={Store} title="Tidak ada vendor" description="Belum ada data vendor untuk ditampilkan." />
        ) : (
          filtered.map((v) => (
            <div key={v.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                  {v.logoUrl ? (
                    <Image src={v.logoUrl} alt={v.name} fill unoptimized className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 line-clamp-1">{v.name}</div>
                  <div className="font-mono text-xs text-slate-500">{v.slug}</div>
                </div>
              </div>
              <div className="text-sm text-slate-600 line-clamp-2">{v.description || '-'}</div>
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                <Link
                  href={`/vendor/${v.slug}`}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Lihat
                </Link>
                {resolvedPermissions.canChangeStatus && v.status === 'PENDING' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(`Setujui vendor "${v.name}"?`)) return;
                        void setStatus(v.id, 'APPROVED');
                      }}
                      className="text-xs font-medium text-green-600 hover:text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectDialog({ isOpen: true, id: v.id, name: v.name });
                        setRejectNote(v.verificationNote || '');
                      }}
                      className="text-xs font-medium text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      Reject
                    </button>
                  </>
                ) : null}
                {resolvedPermissions.canEdit ? (
                  <button
                    type="button"
                    onClick={() => openEdit(v)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Edit
                  </button>
                ) : null}
                {resolvedPermissions.canDelete ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ isOpen: true, id: v.id })}
                    className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Hapus
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900">{editorMode === 'CREATE' ? 'Tambah Vendor' : 'Edit Vendor'}</div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                    wizardStep === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                  }`}
                >
                  1. Profil
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                    wizardStep === 2 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                  }`}
                >
                  2. Kontak & Alamat
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                    wizardStep === 3 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                  }`}
                >
                  3. Verifikasi
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              {wizardStep === 1 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Nama</label>
                      <input
                        value={editorValue.name}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Contoh: Vendor A"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Slug (opsional)</label>
                      <input
                        value={editorValue.slug}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, slug: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="vendor-a"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Owner (Email, opsional)</label>
                    <input
                      value={editorValue.ownerEmail}
                      onChange={(e) => setEditorValue((prev) => ({ ...prev, ownerEmail: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="owner@domain.com"
                    />
                    <div className="text-xs text-slate-500">
                      Jika diisi, user akan menjadi Owner vendor (tanpa mengubah role akun).
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Logo (opsional)</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMediaTarget('LOGO');
                            setIsMediaOpen(true);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 w-full"
                        >
                          Pilih / Upload
                        </button>
                        <button
                          type="button"
                          disabled={!editorValue.logoUrl}
                          onClick={() => setEditorValue((prev) => ({ ...prev, logoUrl: '' }))}
                          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
                        >
                          Hapus
                        </button>
                      </div>
                      {editorValue.logoUrl ? (
                        <div className="mt-2 w-28 aspect-square rounded-2xl overflow-hidden bg-white border border-slate-200 relative">
                          <Image src={editorValue.logoUrl} alt={editorValue.name || 'Vendor'} fill unoptimized className="object-contain p-2" />
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-500">Belum ada logo.</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Sampul Toko (opsional)</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMediaTarget('COVER');
                            setIsMediaOpen(true);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 w-full"
                        >
                          Pilih / Upload
                        </button>
                        <button
                          type="button"
                          disabled={!editorValue.coverUrl}
                          onClick={() => setEditorValue((prev) => ({ ...prev, coverUrl: '' }))}
                          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
                        >
                          Hapus
                        </button>
                      </div>
                      {editorValue.coverUrl ? (
                        <div className="mt-2 h-28 sm:h-32 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 relative">
                          <Image src={editorValue.coverUrl} alt={editorValue.name || 'Sampul Toko'} fill unoptimized className="object-cover" />
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-500">Belum ada sampul.</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Deskripsi (opsional)</label>
                    <textarea
                      rows={4}
                      value={editorValue.description}
                      onChange={(e) => setEditorValue((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </>
              ) : null}

              {wizardStep === 2 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Email Kontak</label>
                      <input
                        value={editorValue.contactEmail}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, contactEmail: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="toko@email.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Telepon/WhatsApp</label>
                      <input
                        value={editorValue.contactPhone}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, contactPhone: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="08xxxxxxxxxx"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Alamat</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        value={editorValue.addressLine1}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, addressLine1: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Alamat 1"
                      />
                      <input
                        value={editorValue.addressLine2}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, addressLine2: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Alamat 2 (opsional)"
                      />
                      <input
                        value={editorValue.city}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, city: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Kota/Kabupaten"
                      />
                      <input
                        value={editorValue.province}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, province: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Provinsi"
                      />
                      <input
                        value={editorValue.postalCode}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, postalCode: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Kode Pos"
                      />
                      <input
                        value={editorValue.country}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, country: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Negara"
                      />
                    </div>
                  </div>
                </>
              ) : null}

              {wizardStep === 3 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Status</label>
                      <select
                        value={editorValue.status}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, status: e.target.value as any }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="PENDING">Menunggu Verifikasi</option>
                        <option value="APPROVED">Aktif</option>
                        <option value="REJECTED">Ditolak</option>
                        <option value="SUSPENDED">Suspended</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Catatan Verifikasi</label>
                      <input
                        value={editorValue.verificationNote}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, verificationNote: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Catatan internal admin"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Nomor Identitas (opsional)</label>
                      <input
                        value={editorValue.idNumber}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, idNumber: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="KTP / NIB / NPWP"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Dokumen Identitas (opsional)</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMediaTarget('ID');
                            setIsMediaOpen(true);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 w-full"
                        >
                          Pilih / Upload
                        </button>
                        <button
                          type="button"
                          disabled={!editorValue.idDocumentUrl}
                          onClick={() => setEditorValue((prev) => ({ ...prev, idDocumentUrl: '' }))}
                          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
                        >
                          Hapus
                        </button>
                      </div>
                      {editorValue.idDocumentUrl ? (
                        <div className="mt-2 h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative">
                          <Image src={editorValue.idDocumentUrl} alt="Dokumen Identitas" fill unoptimized className="object-cover" />
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-500">Belum ada dokumen.</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Tipe Komisi</label>
                      <select
                        value={editorValue.commissionType}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, commissionType: e.target.value as any }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="PERCENT">Persentase</option>
                        <option value="FLAT">Nominal</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">
                        Nilai Komisi {editorValue.commissionType === 'PERCENT' ? '(%)' : '(IDR)'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editorValue.commissionRate}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, commissionRate: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep((s) => (s === 2 ? 1 : 2))}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                  >
                    Kembali
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {wizardStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 1 && !editorValue.name.trim()) {
                        toast.error('Nama vendor wajib diisi');
                        return;
                      }
                      setWizardStep((s) => (s === 1 ? 2 : 3));
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-60"
                    disabled={wizardStep === 1 && !editorValue.name.trim()}
                  >
                    Lanjut
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={save}
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <MediaPickerModal
            isOpen={isMediaOpen}
            onClose={() => setIsMediaOpen(false)}
            onSelect={(item) => {
              if (mediaTarget === 'LOGO') setEditorValue((prev) => ({ ...prev, logoUrl: item.url }));
              if (mediaTarget === 'COVER') setEditorValue((prev) => ({ ...prev, coverUrl: item.url }));
              if (mediaTarget === 'ID') setEditorValue((prev) => ({ ...prev, idDocumentUrl: item.url }));
            }}
          />
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={rejectDialog.isOpen}
        onClose={() => {
          if (isUpdatingStatus) return;
          setRejectDialog({ isOpen: false, id: null, name: '' });
          setRejectNote('');
        }}
        onConfirm={async () => {
          if (!rejectDialog.id) return;
          const note = rejectNote.trim();
          if (note.length < 5) {
            toast.error('Catatan penolakan wajib diisi (minimal 5 karakter)');
            return;
          }
          const ok = await setStatus(rejectDialog.id, 'REJECTED', note);
          if (ok) {
            setRejectDialog({ isOpen: false, id: null, name: '' });
            setRejectNote('');
          }
        }}
        title={`Tolak Vendor: ${rejectDialog.name}`}
        variant="danger"
        confirmText="Tolak Vendor"
        cancelText="Batal"
        isLoading={isUpdatingStatus}
        content={
          <div className="space-y-3">
            <div>Berikan alasan penolakan/revisi agar mentor bisa memperbaiki pengajuan.</div>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="w-full min-h-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              placeholder="Contoh: Mohon lengkapi dokumen identitas (foto KTP harus jelas) dan perbaiki alamat (baris 2 wajib diisi)."
            />
          </div>
        }
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Hapus Vendor?"
        description="Vendor yang dipakai oleh produk tidak bisa dihapus."
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
