import { NextRequest, NextResponse } from 'next/server';
import { deactivateAffiliateLink } from '@/modules/affiliate/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const result = await deactivateAffiliateLink(user.id, id);
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'AFFILIATE_LINK_DEACTIVATE',
      entityType: 'AffiliateLink',
      entityId: String(id || ''),
      metadata: { ok: true },
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

