import { NextRequest, NextResponse } from 'next/server';
import { trackClick } from '@/modules/affiliate/api/service';
import { getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const existingCode = typeof req.cookies.get('affiliate_code')?.value === 'string' ? String(req.cookies.get('affiliate_code')?.value) : '';
    const existingCodeNorm = existingCode.trim().toUpperCase().replace(/\s+/g, '');

    const body = (await req.json().catch(() => ({}))) as { code?: unknown; linkId?: unknown; landingPath?: unknown };
    const codeRaw = typeof body.code === 'string' ? body.code.trim().toUpperCase().replace(/\s+/g, '') : '';
    if (!codeRaw || codeRaw.length > 32) return NextResponse.json({ error: 'Code is required' }, { status: 400 });

    if (existingCodeNorm && existingCodeNorm !== codeRaw) {
      const response = NextResponse.json({ success: true, locked: true, code: existingCodeNorm }, { status: 200 });
      return response;
    }

    const ip = getClientIp(req) || null;

    const linkId = typeof body.linkId === 'string' ? body.linkId.trim() : '';
    const landingPathRaw = typeof body.landingPath === 'string' ? body.landingPath.trim() : '';
    const landingPath = landingPathRaw && landingPathRaw.length <= 400 ? landingPathRaw : undefined;

    const referral = await trackClick(codeRaw, ip || undefined, {
      affiliateLinkId: linkId && linkId.length <= 64 ? linkId : undefined,
      landingPath,
    });
    
    // Set a cookie to track the affiliate for future conversions
    const response = NextResponse.json({ success: true, referral }, { status: 200 });
    if (referral) {
      response.cookies.set('affiliate_code', codeRaw, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      response.cookies.set('affiliate_referral_id', String((referral as any).id || ''), {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      const referralLinkId = typeof (referral as any)?.affiliateLinkId === 'string' ? String((referral as any).affiliateLinkId) : '';
      if (referralLinkId) {
        response.cookies.set('affiliate_link_id', referralLinkId, {
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 30,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      }
    }

    await writeAuditLog({
      req,
      actor: null,
      action: 'AFFILIATE_TRACK',
      entityType: 'AffiliateProfile',
      entityId: null,
      metadata: { code: codeRaw, ok: Boolean(referral), ip },
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
