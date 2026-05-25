import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const prismaAny = prisma as any;
    const vendor = await prismaAny.shopVendor.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        coverUrl: true,
        status: true,
        contactEmail: true,
        contactPhone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        province: true,
        postalCode: true,
        country: true,
        ratingAvg: true,
        ratingCount: true,
        products: {
          include: {
            categoryRef: true,
          },
        },
      },
    });

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    if (vendor.status !== 'APPROVED') return NextResponse.json({ ...vendor, products: [] });

    return NextResponse.json({
      ...vendor,
      products: Array.isArray(vendor.products) ? vendor.products.sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1)) : [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengambil vendor' }, { status: 500 });
  }
}
