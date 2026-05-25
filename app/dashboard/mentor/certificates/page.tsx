import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Award, Loader2, PenLine, Trash2 } from 'lucide-react';

const COURSE_CERTIFICATE_PREFIX = '__course_certificate__';

export const dynamic = 'force-dynamic';

type Tab = 'ALL' | 'POLICY';

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

const getTemplatePageMm = (content: any) => {
  const orientation = content?.orientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE';
  const pageSize = content?.pageSize === 'LETTER' ? 'LETTER' : 'A4';
  const a4 = orientation === 'PORTRAIT' ? { widthMm: 210, heightMm: 297 } : { widthMm: 297, heightMm: 210 };
  const letter = orientation === 'PORTRAIT' ? { widthMm: 215.9, heightMm: 279.4 } : { widthMm: 279.4, heightMm: 215.9 };
  return pageSize === 'LETTER' ? letter : a4;
};

const renderTemplateThumb = (template: any) => {
  const content = template?.content && typeof template.content === 'object' ? template.content : {};
  const dims = getTemplatePageMm(content);
  const bg =
    typeof (content as any).background === 'string'
      ? String((content as any).background)
      : typeof (content as any).certificateBackgroundImageUrl === 'string'
        ? String((content as any).certificateBackgroundImageUrl)
        : '';
  const els = Array.isArray((content as any).elements) ? ((content as any).elements as any[]) : [];
  const sorted = [...els].sort((a, b) => Number(a?.zIndex || 0) - Number(b?.zIndex || 0)).slice(0, 40);
  const getText = (el: any) => {
    switch (el?.type) {
      case 'TEXT':
        return String(el?.content || '').trim() || 'Text';
      case 'NAME':
        return '[ student_name ]';
      case 'COURSE':
        return '[ course_title ]';
      case 'INSTRUCTOR':
        return '[ instructor_name ]';
      case 'SERIAL':
        return '[ verification_id ]';
      case 'DATE':
        return '[ date ]';
      case 'DURATION':
        return '[ duration ]';
      case 'POINT':
        return '[ points ]';
      case 'GRADE':
        return '[ grade ]';
      case 'BUNDLE':
        return '[ bundle_courses ]';
      default:
        return '';
    }
  };
  return (
    <div className="relative w-full h-full bg-white overflow-hidden" style={{ aspectRatio: `${dims.widthMm} / ${dims.heightMm}` }}>
      {bg ? <img src={bg} className="absolute inset-0 w-full h-full object-cover" /> : null}
      <div className="absolute inset-0">
        {sorted.map((el: any, idx: number) => {
          const x = Number(el?.x || 0);
          const y = Number(el?.y || 0);
          const w = Math.max(1, Number(el?.width || 1));
          const h = Math.max(1, Number(el?.height || 1));
          const left = `${(x / dims.widthMm) * 100}%`;
          const top = `${(y / dims.heightMm) * 100}%`;
          const width = `${(w / dims.widthMm) * 100}%`;
          const height = `${(h / dims.heightMm) * 100}%`;
          const opacity = typeof el?.opacity === 'number' ? Math.max(0, Math.min(100, el.opacity)) / 100 : 1;
          if (el?.type === 'IMAGE') {
            const src = typeof el?.src === 'string' ? el.src : '';
            return (
              <div key={String(el?.id || idx)} className="absolute" style={{ left, top, width, height, opacity }}>
                {src ? <img src={src} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100" />}
              </div>
            );
          }
          if (el?.type === 'QR') {
            return (
              <div key={String(el?.id || idx)} className="absolute" style={{ left, top, width, height, opacity }}>
                <div className="w-full h-full border border-slate-300 bg-white" />
              </div>
            );
          }
          if (el?.type === 'SIGNATURE') {
            return (
              <div key={String(el?.id || idx)} className="absolute" style={{ left, top, width, height, opacity }}>
                <div className="w-full h-full border-b border-slate-300" />
              </div>
            );
          }
          const text = getText(el);
          if (!text) return null;
          const color = typeof el?.color === 'string' ? el.color : '#111827';
          const align = el?.align === 'left' ? 'left' : el?.align === 'right' ? 'right' : 'center';
          const fontSize = Math.max(8, Math.round((Number(el?.fontSize || 16) as number) * 0.32));
          return (
            <div
              key={String(el?.id || idx)}
              className="absolute overflow-hidden"
              style={{
                left,
                top,
                width,
                height,
                opacity,
                color,
                fontSize,
                fontWeight: el?.bold ? 800 : 700,
                fontStyle: el?.italic ? 'italic' : 'normal',
                display: 'flex',
                alignItems: 'center',
                justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
                textAlign: align as any,
                padding: 2,
                whiteSpace: 'nowrap',
              }}
            >
              <span className="truncate">{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

async function isCourseCoInstructor(courseId: string, userId: string) {
  const row = await prisma.courseCoInstructor.findUnique({
    where: { courseId_userId: { courseId, userId } } as any,
    select: { id: true },
  });
  return Boolean(row);
}

export default async function MentorCertificatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId || role !== 'MENTOR') return <div>Access Denied</div>;

  const sp = (await searchParams?.catch(() => undefined)) ?? {};
  const tabParam = typeof (sp as any)?.tab === 'string' ? String((sp as any).tab) : '';
  const tab: Tab = tabParam === 'policy' ? 'POLICY' : 'ALL';

  const courses = await prisma.course.findMany({
    where: { instructorId: userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, slug: true, status: true },
  });

  const courseIds = courses.map((c) => c.id);
  const designPages = courseIds.length
    ? await prisma.page.findMany({
        where: { slug: { in: courseIds.map((id) => `${COURSE_CERTIFICATE_PREFIX}${id}`) } },
        select: { slug: true, updatedAt: true, content: true },
      })
    : [];

  const designByCourseId = new Map<
    string,
    {
      updatedAt: Date;
      design: Record<string, unknown>;
    }
  >();

  for (const p of designPages) {
    const slug = String(p.slug || '');
    const courseId = slug.startsWith(COURSE_CERTIFICATE_PREFIX) ? slug.slice(COURSE_CERTIFICATE_PREFIX.length) : '';
    if (!courseId) continue;
    const raw = safeParse(p.content);
    const bg = typeof (raw as any)?.certificateBackgroundImageUrl === 'string' ? String((raw as any).certificateBackgroundImageUrl).trim() : '';
    const els = Array.isArray((raw as any)?.elements) ? (raw as any).elements : [];
    if (!bg && els.length === 0) continue;
    designByCourseId.set(courseId, { updatedAt: p.updatedAt, design: raw });
  }

  async function deleteCourseCertificateDesign(formData: FormData) {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyToken(token);
    const userId = payload?.id ? String(payload.id) : null;
    const role = payload?.role ? String(payload.role) : null;
    if (!userId || role !== 'MENTOR') return;
    const courseId = String(formData.get('courseId') || '').trim();
    if (!courseId) return;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, instructorId: true, deletedAt: true },
    });
    if (!course || course.deletedAt) return;

    const isInstructor = userId === course.instructorId;
    const isCoInstructor = !isInstructor ? await isCourseCoInstructor(course.id, userId) : false;
    if (!isInstructor && !isCoInstructor) return;

    const slug = `${COURSE_CERTIFICATE_PREFIX}${courseId}`;
    const existing = await prisma.page.findUnique({ where: { slug }, select: { id: true } });
    if (existing) await prisma.page.delete({ where: { slug } });

    revalidatePath('/dashboard/mentor/certificates');
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="text-xl font-extrabold text-slate-900">Buat Sertifikat Anda</div>
            <div className="mt-2 text-sm text-slate-600">
              <div>Dalam 3 langkah</div>
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <div>1. Pilih desain sertifikat</div>
                <div>2. Atur teks dan unggah tanda tangan</div>
                <div>3. Simpan, sertifikat siap digunakan</div>
              </div>
            </div>
            <div className="mt-5">
              <Link
                href="/dashboard/mentor/certificates/builder/select"
                prefetch={false}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
              >
                Buat sertifikat
              </Link>
            </div>
          </div>
          <div className="w-full lg:w-96 h-40 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Award className="w-10 h-10" />
          </div>
        </div>
        <div className="px-6 border-t border-slate-100">
          <div className="flex items-center gap-6 text-sm font-extrabold">
            <Link
              href="/dashboard/mentor/certificates?tab=all"
              className={tab === 'ALL' ? 'py-4 border-b-2 border-indigo-600 text-indigo-700' : 'py-4 text-slate-700 hover:text-slate-900'}
            >
              Semua Sertifikat
            </Link>
            <Link
              href="/dashboard/mentor/certificates?tab=policy"
              className={tab === 'POLICY' ? 'py-4 border-b-2 border-indigo-600 text-indigo-700' : 'py-4 text-slate-700 hover:text-slate-900'}
            >
              Kebijakan Sertifikat
            </Link>
          </div>
        </div>
      </div>

      {tab === 'ALL' ? (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="text-sm font-extrabold text-slate-900">Sertifikat Dipublikasikan (Per Kursus)</div>
            <div className="text-xs text-slate-500 mt-0.5">Desain yang sudah disimpan ke kursus tertentu</div>
          </div>
          <div className="divide-y divide-slate-100">
            {courses.length === 0 ? (
              <div className="p-6 text-sm text-slate-700">Belum ada kursus.</div>
            ) : designByCourseId.size === 0 ? (
              <div className="p-6 text-center">
                <div className="text-sm font-extrabold text-slate-400 uppercase tracking-widest">Belum ada</div>
                <div className="text-xs text-slate-400 mt-2">Klik “Buat sertifikat”, pilih kursus, lalu Publish.</div>
              </div>
            ) : (
              courses
                .map((c) => {
                  const row = designByCourseId.get(c.id);
                  if (!row) return null;
                  const design = row.design as any;
                  const courseId = String(c.id || '');
                  const templateLike = {
                    content: {
                      background:
                        typeof design?.certificateBackgroundImageUrl === 'string' ? String(design.certificateBackgroundImageUrl).trim() : '',
                      elements: Array.isArray(design?.elements) ? design.elements : [],
                      orientation: design?.certificatePageOrientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE',
                      pageSize: design?.certificatePageSize === 'LETTER' ? 'LETTER' : 'A4',
                    },
                  };
                  return (
                    <div key={courseId} className="p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-14 w-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                          <div className="w-full h-full">{renderTemplateThumb(templateLike)}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-slate-900 truncate">
                            {String(c.title || c.slug || c.id || 'Kursus')}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {design?.certificatePageSize === 'LETTER' ? 'Letter' : 'A4'} •{' '}
                            {design?.certificatePageOrientation === 'PORTRAIT' ? 'Portrait' : 'Landscape'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Published
                        </span>
                        <Link
                          href={`/dashboard/mentor/certificates/builder?courseId=${encodeURIComponent(courseId)}`}
                          prefetch={false}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          title="Edit"
                        >
                          <PenLine className="w-4 h-4" />
                        </Link>
                        <form action={deleteCourseCertificateDesign}>
                          <input type="hidden" name="courseId" value={courseId} />
                          <button
                            type="submit"
                            className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })
                .filter(Boolean)
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-extrabold text-slate-900">Kebijakan Sertifikat</div>
          <div className="mt-2 text-sm text-slate-600">
            Pengaturan kebijakan sertifikat bersifat global dan mengikuti konfigurasi Admin.
          </div>
          <div className="mt-4 text-sm text-slate-700">
            Jika Anda perlu mengubah kebijakan (misalnya aturan unduh PDF, auto issue, QR/serial), silakan minta Admin untuk mengubahnya di menu Sertifikat.
          </div>
        </div>
      )}
    </div>
  );
}
