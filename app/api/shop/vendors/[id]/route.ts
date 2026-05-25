import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import { writeAuditLog } from '@/utils/audit';

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prismaAny = prisma as any;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = user.role === 'ADMIN';
    const before = await prisma.shopVendor.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, ownerId: true, status: true },
    });
    if (!before) return NextResponse.json({ error: 'Vendor tidak ditemukan' }, { status: 404 });

    const canManage =
      isAdmin ||
      Boolean(
        await prisma.shopVendor.findFirst({
          where: {
            id,
            OR: [{ ownerId: String(user.id) }, { members: { some: { userId: String(user.id) } } }],
          },
          select: { id: true },
        })
      );

    if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as {
      name?: unknown;
      slug?: unknown;
      ownerId?: unknown;
      ownerEmail?: unknown;
      description?: unknown;
      logoUrl?: unknown;
      coverUrl?: unknown;
      contactEmail?: unknown;
      contactPhone?: unknown;
      addressLine1?: unknown;
      addressLine2?: unknown;
      city?: unknown;
      province?: unknown;
      postalCode?: unknown;
      country?: unknown;
      idNumber?: unknown;
      idDocumentUrl?: unknown;
      verificationNote?: unknown;
      status?: unknown;
      commissionType?: unknown;
      commissionRate?: unknown;
    };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const slugInput = typeof body.slug === 'string' ? body.slug.trim() : '';
    const ownerIdInput = typeof body.ownerId === 'string' ? body.ownerId.trim() : '';
    const ownerEmailInput = typeof body.ownerEmail === 'string' ? body.ownerEmail.trim().toLowerCase() : '';
    const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : '';
    const coverUrl = typeof body.coverUrl === 'string' ? body.coverUrl.trim() : '';
    const contactEmail = typeof body.contactEmail === 'string' ? body.contactEmail.trim() : '';
    const contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone.trim() : '';
    const addressLine1 = typeof body.addressLine1 === 'string' ? body.addressLine1.trim() : '';
    const addressLine2 = typeof body.addressLine2 === 'string' ? body.addressLine2.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    const province = typeof body.province === 'string' ? body.province.trim() : '';
    const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() : '';
    const country = typeof body.country === 'string' ? body.country.trim() : '';
    const idNumber = typeof body.idNumber === 'string' ? body.idNumber.trim() : '';
    const idDocumentUrl = typeof body.idDocumentUrl === 'string' ? body.idDocumentUrl.trim() : '';
    const verificationNote = typeof body.verificationNote === 'string' ? body.verificationNote.trim() : '';
    const statusInput = typeof body.status === 'string' ? body.status.trim() : '';
    const commissionTypeInput = typeof body.commissionType === 'string' ? body.commissionType.trim() : '';
    const commissionRate = typeof body.commissionRate === 'number' && Number.isFinite(body.commissionRate) ? body.commissionRate : undefined;

    const data: any = {};
    if (name) data.name = name;
    if (slugInput) data.slug = slugify(slugInput);
    if (typeof body.description === 'string') data.description = description || null;
    if (typeof body.logoUrl === 'string') data.logoUrl = logoUrl || null;
    if (typeof body.coverUrl === 'string') data.coverUrl = coverUrl || null;
    if (typeof body.contactEmail === 'string') data.contactEmail = contactEmail || null;
    if (typeof body.contactPhone === 'string') data.contactPhone = contactPhone || null;
    if (typeof body.addressLine1 === 'string') data.addressLine1 = addressLine1 || null;
    if (typeof body.addressLine2 === 'string') data.addressLine2 = addressLine2 || null;
    if (typeof body.city === 'string') data.city = city || null;
    if (typeof body.province === 'string') data.province = province || null;
    if (typeof body.postalCode === 'string') data.postalCode = postalCode || null;
    if (typeof body.country === 'string') data.country = country || null;
    if (typeof body.idNumber === 'string') data.idNumber = idNumber || null;
    if (typeof body.idDocumentUrl === 'string') data.idDocumentUrl = idDocumentUrl || null;
    if (typeof body.verificationNote === 'string') data.verificationNote = verificationNote || null;

    if (isAdmin) {
      if (typeof body.ownerId === 'string' || typeof body.ownerEmail === 'string') {
        if (!ownerIdInput && !ownerEmailInput) {
          data.ownerId = null;
        } else {
          const ownerUser = ownerIdInput
            ? await prisma.user.findUnique({ where: { id: ownerIdInput }, select: { id: true } })
            : await prisma.user.findUnique({ where: { email: ownerEmailInput }, select: { id: true } });
          if (!ownerUser) return NextResponse.json({ error: 'Owner user tidak ditemukan' }, { status: 404 });
          data.ownerId = ownerUser.id;
        }
      }
      if (typeof body.status === 'string' && (statusInput === 'APPROVED' || statusInput === 'REJECTED' || statusInput === 'SUSPENDED' || statusInput === 'PENDING'))
        data.status = statusInput;
      if (typeof body.commissionType === 'string' && (commissionTypeInput === 'FLAT' || commissionTypeInput === 'PERCENT')) data.commissionType = commissionTypeInput;
      if (typeof body.commissionRate === 'number' && commissionRate !== undefined) data.commissionRate = commissionRate;
    }

    if (data.slug === '') return NextResponse.json({ error: 'Slug vendor tidak valid' }, { status: 400 });
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 });

    const updated = await prismaAny.shopVendor.update({ where: { id }, data });

    const nextStatus = typeof data.status === 'string' ? data.status : undefined;
    const statusChanged =
      Boolean(nextStatus) &&
      (nextStatus === 'APPROVED' || nextStatus === 'PENDING' || nextStatus === 'REJECTED' || nextStatus === 'SUSPENDED') &&
      String(before.status) !== String(nextStatus);
    const ownerIdToNotify = typeof data.ownerId === 'string' ? String(data.ownerId) : before.ownerId ? String(before.ownerId) : null;

    if (isAdmin && statusChanged && ownerIdToNotify) {
      const title = 'Status Vendor';
      const statusLabel =
        nextStatus === 'APPROVED'
          ? 'Disetujui'
          : nextStatus === 'PENDING'
            ? 'Menunggu'
            : nextStatus === 'REJECTED'
              ? 'Ditolak'
              : 'Suspended';
      const note = typeof data.verificationNote === 'string' ? data.verificationNote.trim() : '';
      const link =
        nextStatus === 'APPROVED'
          ? '/dashboard/vendor/profile'
          : nextStatus === 'REJECTED'
            ? '/dashboard/vendor'
            : '/dashboard/vendor';
      const message = `Vendor: ${before.name}\nSlug: ${before.slug}\nStatus: ${statusLabel}${note ? `\nCatatan: ${note}` : ''}\n\nLINK:${link}`;
      await prisma.notification.create({
        data: { userId: ownerIdToNotify, title, message, read: false },
      });
    }

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: statusChanged ? 'VENDOR_STATUS_UPDATE' : 'VENDOR_UPDATE',
      entityType: 'ShopVendor',
      entityId: id,
      metadata: {
        changes: data,
        before: { status: before.status, ownerId: before.ownerId, slug: before.slug, name: before.name },
        statusChanged: statusChanged || false,
        nextStatus: nextStatus || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperbarui vendor' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PUT(req, ctx);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prismaAny = prisma as any;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const inUse = await prismaAny.product.count({ where: { vendorId: id } });
    if (inUse > 0) return NextResponse.json({ error: 'Vendor sedang dipakai produk' }, { status: 400 });

    const deleted = await prismaAny.shopVendor.delete({ where: { id } });
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'VENDOR_DELETE',
      entityType: 'ShopVendor',
      entityId: id,
      metadata: { slug: deleted?.slug || null, name: deleted?.name || null },
    });
    return NextResponse.json({ message: 'Vendor dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus vendor' }, { status: 500 });
  }
}
