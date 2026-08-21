"use client";

import Cards from '../../components/Cards';
import Table from '../../components/Tables';
import { useMentorStats, useMentorCourses } from '../../api/service';
import Link from 'next/link';

interface MentorDashboardProps {
  stats: {
    totalCourses: number;
    enrolledStudents: number;
    totalBundles?: number;
    totalProducts?: number;
    productsSold?: number;
    totalEarning?: number;
    publishedPosts?: number;
    platformFeeTotal?: number;
    affiliateFeeTotal?: number;
  };
  courses: any[];
  notifications?: Array<{ id: string; title: string; message: string; read: boolean; createdAt: string }>;
  recentEnrollments?: Array<{ id: string; createdAt: string; studentName: string; studentEmail: string; courseTitle: string; courseSlug: string }>;
  pendingSubmissions?: Array<{
    id: string;
    submittedAt: string;
    studentName: string;
    studentEmail: string;
    courseTitle: string;
    courseSlug: string;
    assignmentTitle: string;
    lessonTitle: string;
  }>;
}

function parseNotificationMessage(message: string) {
  const raw = typeof message === 'string' ? message : '';
  const lines = raw.split('\n').map((l) => l.trim());
  let href: string | null = null;
  const out: string[] = [];
  for (const l of lines) {
    if (!l) continue;
    if (l.toUpperCase().startsWith('LINK:')) href = l.slice(5).trim() || null;
    else out.push(l);
  }
  return { href, text: out.join('\n') };
}

function formatIdr(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `Rp${Math.round(n).toLocaleString('id-ID')}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MentorDashboard({
  stats: initialStats,
  courses: initialCourses,
  notifications = [],
  recentEnrollments = [],
  pendingSubmissions = [],
}: MentorDashboardProps) {
  const { data: stats, isLoading: statsLoading } = useMentorStats(initialStats);
  const { data: courses, isLoading: coursesLoading } = useMentorCourses(initialCourses);

  const displayedStats = stats || initialStats;
  const displayedCoursesRaw = courses || initialCourses;
  const displayedCourses = (Array.isArray(displayedCoursesRaw) ? displayedCoursesRaw : [])
    .map((c: any) => {
      const id = typeof c?.id === 'string' ? c.id : '';
      const title = typeof c?.title === 'string' ? c.title : '';
      const status = typeof c?.status === 'string' ? c.status : '';
      const published = status === 'PUBLISHED' || Boolean(c?.published);
      const price = Number(c?.price || 0);
      const students = Number(c?._count?.enrollments ?? c?.students ?? 0);
      return { id, title, published, price, students };
    })
    .filter((c) => c.id && c.title);

  const metrics = [
    { label: 'Total Kursus', value: Number(displayedStats?.totalCourses || 0), color: 'bg-blue-500' },
    { label: 'Total Bundel', value: Number((displayedStats as any)?.totalBundles || 0), color: 'bg-indigo-600' },
    { label: 'Total Produk', value: Number((displayedStats as any)?.totalProducts || 0), color: 'bg-slate-700' },
    { label: 'Jumlah Siswa', value: Number(displayedStats?.enrolledStudents || 0), color: 'bg-green-500' },
    { label: 'Artikel Terbit', value: Number((displayedStats as any)?.publishedPosts || 0), color: 'bg-slate-500' },
    { label: 'Produk Terjual', value: Number((displayedStats as any)?.productsSold || 0), color: 'bg-emerald-600' },
    { label: 'Fee Platform', value: formatIdr(Number((displayedStats as any)?.platformFeeTotal || 0)), color: 'bg-yellow-500' },
    { label: 'Fee Affiliate', value: formatIdr(Number((displayedStats as any)?.affiliateFeeTotal || 0)), color: 'bg-rose-500' },
    { label: 'Pendapatan Bersih', value: formatIdr(Number((displayedStats as any)?.totalEarning || 0)), color: 'bg-violet-600' },
  ];

  const courseColumns = [
    { header: 'Judul', accessorKey: 'title' },
    {
      header: 'Status',
      accessorKey: 'published',
      cell: (val: boolean) => (
        <span className={`px-2 py-1 rounded text-xs ${val ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
          {val ? 'Terbit' : 'Draft'}
        </span>
      )
    },
    { header: 'Siswa', accessorKey: 'students', cell: (val: number) => <span className="font-extrabold text-slate-800">{Number(val || 0)}</span>, className: 'whitespace-nowrap' },
    { header: 'Harga', accessorKey: 'price', cell: (val: number) => formatIdr(Number(val || 0)) },
  ];

  const pendingColumns = [
    { header: 'Tanggal', accessorKey: 'submittedAt', cell: (val: string) => <span className="text-xs text-slate-600">{formatDateTime(String(val || ''))}</span>, className: 'whitespace-nowrap' },
    {
      header: 'Siswa',
      accessorKey: 'studentName',
      cell: (_val: string, row: any) => <span className="font-semibold text-slate-900">{String(row?.studentName || row?.studentEmail || '-')}</span>,
    },
    { header: 'Kursus', accessorKey: 'courseTitle', cell: (val: string) => <span className="text-sm text-slate-700 line-clamp-1">{String(val || '-')}</span> },
    { header: 'Tugas', accessorKey: 'assignmentTitle', cell: (val: string) => <span className="text-sm text-slate-700 line-clamp-1">{String(val || '-')}</span> },
  ];

  const enrollmentColumns = [
    { header: 'Tanggal', accessorKey: 'createdAt', cell: (val: string) => <span className="text-xs text-slate-600">{formatDateTime(String(val || ''))}</span>, className: 'whitespace-nowrap' },
    {
      header: 'Siswa',
      accessorKey: 'studentName',
      cell: (_val: string, row: any) => <span className="font-semibold text-slate-900">{String(row?.studentName || row?.studentEmail || '-')}</span>,
    },
    { header: 'Kursus', accessorKey: 'courseTitle', cell: (val: string) => <span className="text-sm text-slate-700 line-clamp-1">{String(val || '-')}</span> },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Beranda Mentor</h1>
        <p className="text-sm text-slate-600 mt-1">Ringkasan kursus dan aktivitas yang Anda kelola.</p>
      </div>
      
      <Cards metrics={metrics} isLoading={statsLoading} />

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-slate-900">Area Belajar Anda</div>
            <div className="text-sm text-slate-600 mt-1">
              Mentor tetap bisa belajar sebagai siswa dengan akun yang sama, termasuk melihat kursus yang diikuti dan progresnya.
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Link href="/dashboard/student/courses" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 hover:bg-slate-100 transition-colors">
            <div className="text-sm font-extrabold text-slate-900">Kursus Diikuti</div>
            <div className="text-xs text-slate-600 mt-1">Lihat materi yang sedang Anda pelajari.</div>
          </Link>
          <Link href="/dashboard/student/analytics" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 hover:bg-slate-100 transition-colors">
            <div className="text-sm font-extrabold text-slate-900">Progress Belajar</div>
            <div className="text-xs text-slate-600 mt-1">Pantau progres, aktivitas, dan skor quiz.</div>
          </Link>
          <Link href="/dashboard/student/orders" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 hover:bg-slate-100 transition-colors">
            <div className="text-sm font-extrabold text-slate-900">Riwayat Pembelian</div>
            <div className="text-xs text-slate-600 mt-1">Cek pesanan kursus yang pernah Anda beli.</div>
          </Link>
          <Link href="/dashboard/student/certificates" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 hover:bg-slate-100 transition-colors">
            <div className="text-sm font-extrabold text-slate-900">Sertifikat Saya</div>
            <div className="text-xs text-slate-600 mt-1">Buka sertifikat dari kursus yang sudah selesai.</div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-extrabold text-slate-900">Tugas Menunggu Penilaian</div>
            <Link href="/dashboard/mentor/assignments" className="text-sm font-extrabold text-indigo-700 hover:text-indigo-900">
              Lihat Semua
            </Link>
          </div>
          <div className="mt-4">
            {pendingSubmissions.length === 0 ? (
              <div className="text-sm text-slate-600">Tidak ada tugas yang menunggu.</div>
            ) : (
              <Table columns={pendingColumns} data={pendingSubmissions} isLoading={false} />
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-extrabold text-slate-900">Pendaftaran Terbaru</div>
            <Link href="/dashboard/mentor/students" className="text-sm font-extrabold text-indigo-700 hover:text-indigo-900">
              Buka Siswa
            </Link>
          </div>
          <div className="mt-4">
            {recentEnrollments.length === 0 ? (
              <div className="text-sm text-slate-600">Belum ada pendaftaran baru.</div>
            ) : (
              <Table columns={enrollmentColumns} data={recentEnrollments} isLoading={false} />
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-extrabold text-slate-900">Notifikasi Terbaru</div>
          <Link href="/dashboard/notifications?kind=alerts" className="text-sm font-extrabold text-indigo-700 hover:text-indigo-900">
            Lihat Semua
          </Link>
        </div>
        {notifications.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">Belum ada notifikasi.</div>
        ) : (
          <div className="mt-3 divide-y divide-slate-200">
            {notifications.map((n) => {
              const meta = parseNotificationMessage(n.message);
              const href = meta.href;
              const preview = (meta.text.split('\n')[0] || '').trim();
              const when = n.createdAt ? new Date(n.createdAt).toLocaleString('id-ID') : '';
              return (
                <Link
                  key={n.id}
                  href={href || '/dashboard/notifications?kind=alerts'}
                  className="block py-3 hover:bg-slate-50 rounded-xl px-3 -mx-3 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="font-extrabold text-slate-900 text-sm truncate">{n.title}</div>
                        {!n.read ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shrink-0">
                            BARU
                          </span>
                        ) : null}
                      </div>
                      {preview ? <div className="text-xs text-slate-600 mt-1 truncate">{preview}</div> : null}
                    </div>
                    {when ? <div className="text-[10px] text-slate-500 shrink-0">{when}</div> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Kursus Saya</h2>
        <Link href="/dashboard/mentor/courses" className="text-sm font-extrabold text-indigo-700 hover:text-indigo-900">
          Kelola Kursus
        </Link>
      </div>
      <Table columns={courseColumns} data={displayedCourses || []} isLoading={coursesLoading} />
    </div>
  );
}
