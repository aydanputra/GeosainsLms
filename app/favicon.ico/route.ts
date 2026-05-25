import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const page = await prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true, updatedAt: true } });
    const parsed = page?.content ? (JSON.parse(page.content) as Record<string, unknown>) : {};
    const faviconUrl = typeof parsed.faviconUrl === 'string' && parsed.faviconUrl.trim() ? parsed.faviconUrl.trim() : '';
    const version = page?.updatedAt ? new Date(page.updatedAt).getTime() : Date.now();

    if (faviconUrl) {
      const url = `${faviconUrl}${faviconUrl.includes('?') ? '&' : '?'}v=${version}`;
      const res = NextResponse.redirect(new URL(url, req.nextUrl.origin));
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }
  } catch {
  }

  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
