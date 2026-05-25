import { NextRequest, NextResponse } from 'next/server';
import { getPageBySlug } from '@/modules/pages/api/service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  try {
    const { slug } = await params;
    const slugString = slug.join('/');
    
    const page = await getPageBySlug(slugString);
    
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    return NextResponse.json(page);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
