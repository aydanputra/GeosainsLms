import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

export async function GET(req: NextRequest) {
  try {
    const categorySlug = req.nextUrl.searchParams.get('category') || 'geo-services';

    const vendors = await prisma.shopVendor.findMany({
      where: {
        status: 'APPROVED',
      },
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
        products: {
          where: { categoryRef: { slug: categorySlug } },
          select: { id: true },
        },
      },
    });

    return NextResponse.json(
      vendors.map((v) => ({
        ...v,
        serviceCount: Array.isArray(v.products) ? v.products.length : 0,
        products: undefined,
      }))
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengambil vendor' }, { status: 500 });
  }
}
