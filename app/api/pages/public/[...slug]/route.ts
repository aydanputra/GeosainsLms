import { NextRequest, NextResponse } from 'next/server';
import { getPublishedPageBySlug } from '@/modules/pages/api/service';
import { sanitizePageBlocks } from '@/modules/core/utils/sanitizeHtml';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  try {
    const { slug } = await params;
    const slugString = slug.join('/');
    
    const page = await getPublishedPageBySlug(slugString);
    
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      ...page,
      blocks: sanitizePageBlocks(page.blocks),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
