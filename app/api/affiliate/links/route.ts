import { NextRequest, NextResponse } from 'next/server';
import { createAffiliateLink, listAffiliateLinks } from '@/modules/affiliate/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const links = await listAffiliateLinks(user.id);
    return NextResponse.json(links, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const kindRaw = typeof body.kind === 'string' ? body.kind.trim().toUpperCase() : '';
    const kind = kindRaw === 'COURSE' || kindRaw === 'PRODUCT' ? (kindRaw as 'COURSE' | 'PRODUCT') : null;
    if (!kind) return NextResponse.json({ error: 'kind tidak valid' }, { status: 400 });

    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
    const productId = typeof body.productId === 'string' ? body.productId.trim() : '';

    const link = await createAffiliateLink(user.id, { kind, courseId: courseId || undefined, productId: productId || undefined });
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'AFFILIATE_LINK_CREATE',
      entityType: 'AffiliateLink',
      entityId: String((link as any)?.id || ''),
      metadata: { kind, courseId: courseId || null, productId: productId || null, path: (link as any)?.path || null },
    });
    return NextResponse.json(link, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

