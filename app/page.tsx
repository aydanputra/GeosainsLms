import { prisma } from '@/utils/prisma';
import PageRenderer from '@/modules/pages/components/PageRenderer';

export const dynamic = 'force-dynamic';

function getDefaultHomeBlocks() {
  return [
    {
      id: 'home-hero-default',
      type: 'HERO',
      content: JSON.stringify({
        layout: { widthMode: 'FULL' },
        slider: { enabled: false },
        heading: 'Belajar Geosains Lebih Terarah',
        subheading: 'Platform pembelajaran geosains dengan materi terstruktur, kuis, tugas, dan sertifikat.',
        primaryCta: { text: 'Jelajahi Kursus', href: '/courses' },
        secondaryCta: { text: 'Masuk', href: '/login' },
      }),
    },
    {
      id: 'home-courses-default',
      type: 'COURSES',
      content: JSON.stringify({
        heading: 'Kursus Populer',
        subheading: 'Temukan kursus terbaru dan paling diminati.',
        limit: 6,
        variant: 'grid',
        cta: { text: 'Lihat Semua Kursus', href: '/courses' },
      }),
    },
    {
      id: 'home-cta-default',
      type: 'CTA',
      content: JSON.stringify({
        heading: 'Siap Mulai Belajar?',
        subheading: 'Daftar sekarang dan mulai progres belajarmu hari ini.',
        buttonText: 'Daftar',
        buttonHref: '/register',
      }),
    },
  ];
}

export default async function Home() {
  const page = await prisma.page.findUnique({
    where: { slug: 'home' },
    include: { blocks: { orderBy: { order: 'asc' } } },
  });

  const defaultBlocks = getDefaultHomeBlocks();
  const blocks = page?.blocks && page.blocks.length > 0 ? (page.blocks as any[]) : defaultBlocks;

  return (
    <main className="min-h-screen bg-white">
      <PageRenderer blocks={blocks} />
    </main>
  );
}
