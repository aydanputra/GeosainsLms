import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: vendorId } = await params;

    const vendor = await prisma.shopVendor.findUnique({ where: { id: vendorId }, select: { id: true, ownerId: true } });
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isOwner = vendor.ownerId && String(vendor.ownerId) === String(user.id);
    if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const members = await prisma.shopVendorMember.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(members);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengambil anggota vendor' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: vendorId } = await params;
    const vendor = await prisma.shopVendor.findUnique({ where: { id: vendorId }, select: { id: true, ownerId: true } });
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isOwner = vendor.ownerId && String(vendor.ownerId) === String(user.id);
    if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as { email?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 });

    const memberUser = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } });
    if (!memberUser) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    if (vendor.ownerId && String(vendor.ownerId) === String(memberUser.id)) {
      return NextResponse.json({ error: 'Owner sudah otomatis memiliki akses' }, { status: 400 });
    }

    const created = await prisma.shopVendorMember.upsert({
      where: { vendorId_userId: { vendorId, userId: memberUser.id } },
      create: { vendorId, userId: memberUser.id, role: 'CO_INSTRUCTOR' },
      update: { role: 'CO_INSTRUCTOR' },
      select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menambah anggota vendor' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: vendorId } = await params;
    const vendor = await prisma.shopVendor.findUnique({ where: { id: vendorId }, select: { id: true, ownerId: true } });
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isOwner = vendor.ownerId && String(vendor.ownerId) === String(user.id);
    if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as { memberId?: unknown };
    const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : '';
    if (!memberId) return NextResponse.json({ error: 'memberId wajib diisi' }, { status: 400 });

    const existing = await prisma.shopVendorMember.findUnique({ where: { id: memberId }, select: { id: true, vendorId: true } });
    if (!existing || existing.vendorId !== vendorId) return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 });

    await prisma.shopVendorMember.delete({ where: { id: memberId } });
    return NextResponse.json({ message: 'Anggota dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus anggota vendor' }, { status: 500 });
  }
}
