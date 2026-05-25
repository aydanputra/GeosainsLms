import { NextRequest, NextResponse } from 'next/server';
import { generateReferralCode } from '@/modules/affiliate/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await generateReferralCode(user.id);
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'AFFILIATE_CODE_GENERATE',
      entityType: 'AffiliateProfile',
      entityId: (profile as any)?.id ? String((profile as any).id) : null,
      metadata: { code: (profile as any)?.code || null },
    });
    return NextResponse.json(profile, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
