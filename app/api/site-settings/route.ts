import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { jwtVerify } from 'jose';

const SETTINGS_SLUG = '__site_settings__';

type SiteSettings = {
  siteName?: string;
  siteDescription?: string;
  contactEmail?: string;
  logoUrl?: string;
  faviconUrl?: string;
  paymentMethod?: 'XENDIT' | 'MIDTRANS' | 'MANUAL';
  withdrawMode?: 'AUTO' | 'MANUAL';
  affiliateDefaultCommissionPercent?: number;
  affiliateMarketplaceSharePercent?: number;
  affiliateHoldDays?: number;
};

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

function toSettings(obj: Record<string, unknown>): SiteSettings {
  const v = (key: string) => (typeof obj[key] === 'string' ? (obj[key] as string).trim() : '');
  const toInt = (key: string) => {
    const raw = obj[key];
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
  };
  const siteName = v('siteName');
  const siteDescription = v('siteDescription');
  const contactEmail = v('contactEmail');
  const logoUrl = v('logoUrl');
  const faviconUrl = v('faviconUrl');
  const paymentMethodRaw = v('paymentMethod').toUpperCase();
  const paymentMethod = paymentMethodRaw === 'XENDIT' || paymentMethodRaw === 'MIDTRANS' || paymentMethodRaw === 'MANUAL' ? paymentMethodRaw : '';
  const withdrawModeRaw = v('withdrawMode').toUpperCase();
  const withdrawMode = withdrawModeRaw === 'AUTO' || withdrawModeRaw === 'MANUAL' ? withdrawModeRaw : '';

  const affiliateDefaultCommissionPercent = toInt('affiliateDefaultCommissionPercent');
  const affiliateMarketplaceSharePercent = toInt('affiliateMarketplaceSharePercent');
  const affiliateHoldDays = toInt('affiliateHoldDays');

  return {
    ...(siteName ? { siteName } : {}),
    ...(siteDescription ? { siteDescription } : {}),
    ...(contactEmail ? { contactEmail } : {}),
    ...(logoUrl ? { logoUrl } : {}),
    ...(faviconUrl ? { faviconUrl } : {}),
    ...(paymentMethod ? { paymentMethod: paymentMethod as any } : {}),
    ...(withdrawMode ? { withdrawMode: withdrawMode as any } : {}),
    ...(affiliateDefaultCommissionPercent !== null ? { affiliateDefaultCommissionPercent: Math.max(0, Math.min(100, affiliateDefaultCommissionPercent)) } : {}),
    ...(affiliateMarketplaceSharePercent !== null ? { affiliateMarketplaceSharePercent: Math.max(0, Math.min(100, affiliateMarketplaceSharePercent)) } : {}),
    ...(affiliateHoldDays !== null ? { affiliateHoldDays: Math.max(0, Math.min(30, affiliateHoldDays)) } : {}),
  };
}

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return new TextEncoder().encode(secret);
}

async function hasSuperAdminReauth(req: NextRequest, actorId: string) {
  const raw = req.cookies.get('super_admin_reauth')?.value;
  if (!raw) return false;
  try {
    const { payload } = await jwtVerify(raw, getSecretKey());
    if (payload?.purpose !== 'super_admin_reauth') return false;
    if (String((payload as any)?.uid || '') !== actorId) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const page = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG } });
  const data = toSettings(safeParse(page?.content));
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const actorId = String((user as any).id || '');
    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } }) : null;
    const actorIsSuperAdmin = Boolean(actor?.isSuperAdmin);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const hasAffiliateKeys =
      body &&
      typeof body === 'object' &&
      (Object.prototype.hasOwnProperty.call(body, 'affiliateDefaultCommissionPercent') ||
        Object.prototype.hasOwnProperty.call(body, 'affiliateMarketplaceSharePercent') ||
        Object.prototype.hasOwnProperty.call(body, 'affiliateHoldDays'));
    if (hasAffiliateKeys && !actorIsSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (hasAffiliateKeys && !(await hasSuperAdminReauth(req, actorId))) {
      return NextResponse.json({ error: 'Perlu konfirmasi password', code: 'REAUTH_REQUIRED' }, { status: 401 });
    }
    const existingPage = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG }, select: { content: true } });
    const existing = safeParse(existingPage?.content);
    const patch = toSettings(body);
    const merged = { ...(existing || {}), ...(patch || {}) } as Record<string, unknown>;
    const next = merged;

    const saved = await prisma.page.upsert({
      where: { slug: SETTINGS_SLUG },
      update: { title: 'Site Settings', published: false, content: JSON.stringify(next) },
      create: { title: 'Site Settings', slug: SETTINGS_SLUG, published: false, content: JSON.stringify(next) },
      select: { content: true },
    });

    await prisma.auditLog.create({
      data: {
        actorId,
        actorRole: user.role,
        action: 'SITE_SETTINGS_UPDATE',
        entityType: 'Page',
        entityId: SETTINGS_SLUG,
        metadata: { patch, keys: Object.keys(patch || {}), hasAffiliateKeys } as any,
      },
    });

    return NextResponse.json(toSettings(safeParse(saved.content)));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menyimpan pengaturan' }, { status: 500 });
  }
}
