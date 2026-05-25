import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

export async function GET() {
  try {
    const prismaAny = prisma as any;
    const vendors = await prismaAny.shopVendor.findMany({
      where: { status: 'APPROVED' },
      orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        coverUrl: true,
        city: true,
        province: true,
        country: true,
        contactEmail: true,
        contactPhone: true,
        ratingAvg: true,
        ratingCount: true,
        _count: { select: { products: true } },
      },
    });

    return NextResponse.json(
      Array.isArray(vendors)
        ? vendors.map((v: any) => ({
            ...v,
            productCount: v?._count?.products ?? 0,
          }))
        : []
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengambil vendor' }, { status: 500 });
  }
}

