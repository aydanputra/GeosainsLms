import Link from 'next/link';
import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { getPageBySlug } from '@/modules/pages/api/service';
import PageRenderer from '@/modules/pages/components/PageRenderer';

export const dynamic = 'force-dynamic';

export default async function PagePreview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div className="p-10">Access Denied</div>;

  const user = await verifyToken(token);
  if (!user || user.role !== 'ADMIN') return <div className="p-10">Access Denied</div>;

  const page = await getPageBySlug(slug);
  if (!page) return <div className="p-10">Halaman tidak ditemukan</div>;

  const blocks = (page.blocks || []).map((b: any) => ({
    id: b.id,
    type: b.type,
    content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? {}),
  }));

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">{page.title}</div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span className="font-mono">/{page.slug}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${page.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                {page.published ? 'Terbit' : 'Draft'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/admin/pages"
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50"
            >
              Kembali
            </Link>
            <Link
              href={page.slug === 'home' ? '/' : `/${page.slug}`}
              target="_blank"
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800"
            >
              Buka Publik
            </Link>
          </div>
        </div>
      </div>

      <PageRenderer blocks={blocks} />
    </div>
  );
}
