import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateStats, getAllAffiliates } from '@/modules/affiliate/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

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

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin can view all, Student views own
    if (user.role === 'ADMIN') {
        const settingsPage = await prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true } });
        const settings = safeParse(settingsPage?.content);
        const holdDaysRaw = typeof (settings as any).affiliateHoldDays === 'number' ? (settings as any).affiliateHoldDays : 7;
        const holdDays = Math.max(0, Math.min(30, Math.floor(Number(holdDaysRaw || 0))));
        if (holdDays > 0) {
          const holdMs = holdDays * 24 * 60 * 60 * 1000;
          const cutoff = new Date(Date.now() - holdMs);
          await prisma.$transaction(async (tx) => {
            const profiles = await tx.affiliateProfile.findMany({ select: { id: true, pendingBalance: true } });
            if (profiles.length === 0) return;
            const pendingById = new Map(profiles.map((p) => [p.id, Math.max(0, Math.round(Number(p.pendingBalance || 0)))] as const));

            const eligible = await tx.commission.groupBy({
              by: ['affiliateId'],
              where: { status: 'EARNED', createdAt: { lte: cutoff } },
              _sum: { amount: true },
            });
            for (const row of eligible) {
              const affiliateId = String(row.affiliateId);
              const sum = Math.max(0, Math.round(Number(row._sum.amount || 0)));
              if (sum <= 0) continue;
              const pending = pendingById.get(affiliateId) ?? 0;
              const dec = Math.min(sum, pending);

              await tx.commission.updateMany({
                where: { affiliateId, status: 'EARNED', createdAt: { lte: cutoff } },
                data: { status: 'AVAILABLE' },
              });
              await tx.affiliateProfile.update({
                where: { id: affiliateId },
                data: { balance: { increment: sum }, pendingBalance: { decrement: dec } },
              });
            }
          });
        }
        const allStats = await getAllAffiliates();
        return NextResponse.json(allStats);
    } else {
        const stats = await getAffiliateStats(user.id);
        return NextResponse.json(stats);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
