"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '../../../components/ConfirmDialog';
import ErrorSummaryPanel from '../../../components/ErrorSummaryPanel';

interface SettingsTabProps {
  course: any;
}

export default function SettingsTab({ course }: SettingsTabProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  // Default to DRAFT if status is missing or undefined
  const [status, setStatus] = useState(course.status || 'DRAFT');
  const [reviewsEnabled, setReviewsEnabled] = useState(Boolean(course.reviewsEnabled ?? true));
  const [certificateEnabled, setCertificateEnabled] = useState(Boolean(course.certificateEnabled ?? true));
  const [permissions, setPermissions] = useState({
    isAdmin: false,
    allowInstructorsToPublishCourses: true,
    allowInstructorsToTrashCourses: true,
    allowInstructorsToChangeCourseAuthor: false,
    allowInstructorsToManageCoInstructors: false,
  });

  const [instructors, setInstructors] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [instructorId, setInstructorId] = useState<string>(String(course.instructorId || ''));
  const [coInstructors, setCoInstructors] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [selectedCoInstructorId, setSelectedCoInstructorId] = useState<string>('');
  const [isSavingCoInstructors, setIsSavingCoInstructors] = useState(false);
  const [isSavingAuthor, setIsSavingAuthor] = useState(false);

  const isPublished = status === 'PUBLISHED';
  const canPublish = permissions.isAdmin || permissions.allowInstructorsToPublishCourses;
  const canTrash = permissions.isAdmin || permissions.allowInstructorsToTrashCourses;
  const canChangeAuthor = permissions.isAdmin || permissions.allowInstructorsToChangeCourseAuthor;
  const canManageCoInstructors = permissions.isAdmin || permissions.allowInstructorsToManageCoInstructors;

  const instructorOptions = useMemo(() => {
    const seen = new Set<string>();
    const list = instructors
      .filter((u) => u && u.id && (u.role === 'ADMIN' || u.role === 'MENTOR'))
      .filter((u) => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      })
      .map((u) => ({ id: u.id, label: `${u.name || u.email} (${u.role})` }));
    return list;
  }, [instructors]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/course-settings', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        const isAdmin = typeof data?.enableQA === 'boolean' || typeof data?.isPublic === 'boolean';
        setPermissions({
          isAdmin,
          allowInstructorsToPublishCourses: data?.allowInstructorsToPublishCourses !== false,
          allowInstructorsToTrashCourses: data?.allowInstructorsToTrashCourses !== false,
          allowInstructorsToChangeCourseAuthor: data?.allowInstructorsToChangeCourseAuthor === true,
          allowInstructorsToManageCoInstructors: data?.allowInstructorsToManageCoInstructors === true,
        });
      } catch {
        if (!active) return;
        setPermissions((p) => ({ ...p, isAdmin: false }));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [usersRes, coRes] = await Promise.all([
          fetch('/api/instructors?role=ALL&limit=100', { cache: 'no-store' }),
          fetch(`/api/courses/${course.id}/co-instructors`, { cache: 'no-store' }),
        ]);
        const usersData = await usersRes.json().catch(() => []);
        const coData = await coRes.json().catch(() => []);
        if (!active) return;
        if (Array.isArray(usersData)) setInstructors(usersData as any);
        if (Array.isArray(coData)) setCoInstructors(coData as any);
      } catch {
        if (!active) return;
      }
    })();
    return () => {
      active = false;
    };
  }, [course.id]);

  const handlePublishToggle = async () => {
    setIsPublishing(true);
    setPublishErrors([]);
    const newStatus = isPublished ? 'DRAFT' : 'PUBLISHED';
    
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          setPublishErrors(data.errors);
          throw new Error('Validasi publikasi gagal');
        }
        throw new Error(data.error || 'Gagal mengubah status publikasi');
      }

      setStatus(newStatus);
      router.refresh();
      toast.success(`Kursus berhasil ${newStatus === 'PUBLISHED' ? 'dipublikasikan' : 'disembunyikan'}`);
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteCourse = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/courses/${course.id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Gagal menghapus kursus');

      toast.success('Kursus berhasil dihapus');
      router.push('/dashboard/admin/courses');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan saat menghapus kursus.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSaveAuthor = async () => {
    if (!instructorId) {
      toast.error('Pilih author terlebih dahulu');
      return;
    }
    setIsSavingAuthor(true);
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan author');
      toast.success('Author kursus diperbarui');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan.');
    } finally {
      setIsSavingAuthor(false);
    }
  };

  const handleAddCoInstructor = async () => {
    if (!selectedCoInstructorId) {
      toast.error('Pilih co-instructor terlebih dahulu');
      return;
    }
    setIsSavingCoInstructors(true);
    try {
      const res = await fetch(`/api/courses/${course.id}/co-instructors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedCoInstructorId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal menambahkan co-instructor');
      const listRes = await fetch(`/api/courses/${course.id}/co-instructors`, { cache: 'no-store' });
      const list = await listRes.json().catch(() => []);
      if (Array.isArray(list)) setCoInstructors(list as any);
      setSelectedCoInstructorId('');
      toast.success('Co-instructor ditambahkan');
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan.');
    } finally {
      setIsSavingCoInstructors(false);
    }
  };

  const handleRemoveCoInstructor = async (userId: string) => {
    setIsSavingCoInstructors(true);
    try {
      const res = await fetch(`/api/courses/${course.id}/co-instructors`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus co-instructor');
      setCoInstructors((prev) => prev.filter((u) => u.id !== userId));
      toast.success('Co-instructor dihapus');
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan.');
    } finally {
      setIsSavingCoInstructors(false);
    }
  };

  const handleSaveFeatureSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewsEnabled, certificateEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || 'Gagal menyimpan pengaturan');
      toast.success('Pengaturan fitur tersimpan');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <ErrorSummaryPanel errors={publishErrors} onClose={() => setPublishErrors([])} />
      
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Pengaturan Fitur</h3>
            <p className="text-sm text-slate-500 mt-1">Atur fitur kursus ini (override dari default global).</p>
          </div>
          <button
            type="button"
            onClick={handleSaveFeatureSettings}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setReviewsEnabled((v) => !v)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              reviewsEnabled ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="text-xs text-slate-500 font-bold">Ulasan / Rating</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">{reviewsEnabled ? 'Aktif' : 'Nonaktif'}</div>
          </button>

          <button
            type="button"
            onClick={() => setCertificateEnabled((v) => !v)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              certificateEnabled ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="text-xs text-slate-500 font-bold">Sertifikat</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">{certificateEnabled ? 'Aktif' : 'Nonaktif'}</div>
          </button>
        </div>
      </div>

      {(canChangeAuthor || canManageCoInstructors) ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Author & Co-Instructors</h3>
              <p className="text-sm text-slate-500 mt-1">Kelola author utama dan co-instructor kursus.</p>
            </div>
          </div>

          {canChangeAuthor ? (
            <div className="mt-5">
              <div className="text-sm font-semibold text-slate-800 mb-2">Course Author</div>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  className="w-full sm:flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Pilih author</option>
                  {instructorOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSaveAuthor}
                  disabled={isSavingAuthor}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isSavingAuthor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan Author
                </button>
              </div>
            </div>
          ) : null}

          {canManageCoInstructors ? (
            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-800 mb-2">Co-Instructors</div>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedCoInstructorId}
                  onChange={(e) => setSelectedCoInstructorId(e.target.value)}
                  className="w-full sm:flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Pilih co-instructor</option>
                  {instructorOptions
                    .filter((o) => o.id !== instructorId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCoInstructor}
                  disabled={isSavingCoInstructors}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSavingCoInstructors ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Tambah
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {coInstructors.length === 0 ? (
                  <div className="text-sm text-slate-500">Belum ada co-instructor.</div>
                ) : (
                  coInstructors.map((u) => (
                    <div key={u.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{u.name}</div>
                        <div className="text-xs text-slate-500 truncate">{u.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCoInstructor(u.id)}
                        disabled={isSavingCoInstructors}
                        className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-60"
                      >
                        Hapus
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Publication Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Status Publikasi</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">
              {isPublished ? 'Kursus ini sudah terbit' : 'Kursus ini masih draft'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {isPublished 
                ? 'Siswa dapat melihat dan membeli kursus ini.' 
                : 'Hanya admin dan mentor yang dapat melihat kursus ini.'}
            </p>
          </div>
          <button
            onClick={handlePublishToggle}
            disabled={isPublishing || !canPublish}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              isPublished
                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                : 'bg-green-600 text-white hover:bg-green-700 border border-transparent'
            } ${!canPublish ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isPublishing && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPublished ? 'Sembunyikan (Draft)' : 'Publikasikan'}
          </button>
        </div>
        {!canPublish ? <p className="text-xs text-slate-500 mt-3">Publikasi oleh instruktur dinonaktifkan. Kursus perlu review admin.</p> : null}
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-4">Area Berbahaya</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-700">Hapus Kursus</p>
            <p className="text-sm text-red-600/80 mt-1">
              Menghapus kursus akan menghapus semua modul, pelajaran, dan data siswa yang terkait.
            </p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting || !canTrash}
            className={`px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2 ${!canTrash ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Hapus Kursus
          </button>
        </div>
        {!canTrash ? <p className="text-xs text-red-700/80 mt-3">Penghapusan kursus oleh instruktur dinonaktifkan. Hanya admin yang dapat menghapus.</p> : null}
      </div>
      
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteCourse}
        title="Hapus Kursus?"
        description="Apakah Anda yakin ingin menghapus kursus ini secara permanen? Tindakan ini tidak dapat dibatalkan dan semua data terkait akan hilang."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
