import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function generateUniqueVendorSlug(base: string) {
  const normalizedBase = slugify(base);
  if (!normalizedBase) return null;

  const existing = await prisma.shopVendor.findUnique({ where: { slug: normalizedBase }, select: { id: true } });
  if (!existing) return normalizedBase;

  for (let i = 0; i < 10; i++) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const candidate = `${normalizedBase}-${suffix}`;
    const used = await prisma.shopVendor.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!used) return candidate;
  }

  return `${normalizedBase}-${Date.now().toString(36)}`;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = user.role === 'ADMIN';
    const where = isAdmin
      ? Promise.resolve(undefined)
      : Promise.resolve({
          OR: [{ ownerId: String(user.id) }, { members: { some: { userId: String(user.id) } } }],
        });

    const vendors = await prisma.shopVendor.findMany({
      where: await where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(vendors);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengambil vendor' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const slugBase = slugInput || name;
    const slug = slugify(slugBase);
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

    if (!name) return NextResponse.json({ error: 'Nama vendor wajib diisi' }, { status: 400 });
    if (!slug) return NextResponse.json({ error: 'Slug vendor tidak valid' }, { status: 400 });

    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin && user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!isAdmin) {
      const missing: string[] = [];
      if (!description) missing.push('Deskripsi');
      if (!logoUrl) missing.push('Logo');
      if (!coverUrl) missing.push('Cover');
      if (!contactEmail) missing.push('Email');
      if (!contactPhone) missing.push('Telepon');
      if (!addressLine1) missing.push('Alamat Baris 1');
      if (!addressLine2) missing.push('Alamat Baris 2');
      if (!city) missing.push('Kota');
      if (!province) missing.push('Provinsi');
      if (!postalCode) missing.push('Kode Pos');
      if (!country) missing.push('Negara');
      if (!idNumber) missing.push('Nomor Identitas');
      if (!idDocumentUrl) missing.push('Dokumen Identitas');
      if (missing.length > 0) {
        return NextResponse.json({ error: `Lengkapi field wajib: ${missing.join(', ')}` }, { status: 400 });
      }
      if (!/^\S+@\S+\.\S+$/.test(String(contactEmail).toLowerCase())) {
        return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 });
      }

      const existing = await prisma.shopVendor.findFirst({
        where: {
          OR: [{ ownerId: String(user.id) }, { members: { some: { userId: String(user.id) } } }],
        },
        select: { id: true, status: true, name: true, slug: true },
      });
      if (existing) {
        if (existing.status === 'REJECTED') {
          const updated = await prisma.shopVendor.update({
            where: { id: existing.id },
            data: {
              name,
              description,
              logoUrl,
              coverUrl,
              contactEmail,
              contactPhone,
              addressLine1,
              addressLine2,
              city,
              province,
              postalCode,
              country,
              idNumber,
              idDocumentUrl,
              status: 'PENDING',
              verificationNote: null,
            },
          });

          const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
          if (admins.length > 0) {
            const me = await prisma.user.findUnique({
              where: { id: String(user.id) },
              select: { id: true, name: true, email: true },
            });
            const title = 'Pengajuan ulang vendor';
            const message = `User: ${me?.name || me?.email || String(user.id)}\nEmail: ${me?.email || '-'}\nUserId: ${String(
              user.id
            )}\nVendor: ${existing.name}\nSlug: ${existing.slug}\n\nLINK:/dashboard/admin/shop/vendors`;
            await prisma.notification.createMany({
              data: admins.map((a) => ({ userId: a.id, title, message, read: false })),
            });
          }

          return NextResponse.json(updated, { status: 200 });
        }
        return NextResponse.json({ error: 'Akun Anda sudah terhubung dengan vendor' }, { status: 400 });
      }
    }

    let ownerId: string | null = null;
    if (isAdmin && (ownerIdInput || ownerEmailInput)) {
      const ownerUser = ownerIdInput
        ? await prisma.user.findUnique({ where: { id: ownerIdInput }, select: { id: true, role: true } })
        : await prisma.user.findUnique({ where: { email: ownerEmailInput }, select: { id: true, role: true } });
      if (!ownerUser) return NextResponse.json({ error: 'Owner user tidak ditemukan' }, { status: 404 });
      ownerId = ownerUser.id;
    }
    if (!isAdmin) ownerId = String(user.id);

    const safeSlug = isAdmin ? slug : await generateUniqueVendorSlug(slugBase);
    if (!safeSlug) return NextResponse.json({ error: 'Slug vendor tidak valid' }, { status: 400 });

    const created = await prisma.shopVendor.create({
      data: {
        name,
        slug: safeSlug,
        ownerId,
        description: description || null,
        logoUrl: logoUrl || null,
        coverUrl: coverUrl || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        province: province || null,
        postalCode: postalCode || null,
        country: country || null,
        idNumber: idNumber || null,
        idDocumentUrl: idDocumentUrl || null,
        verificationNote: verificationNote || null,
        status:
          isAdmin && (statusInput === 'APPROVED' || statusInput === 'REJECTED' || statusInput === 'SUSPENDED' || statusInput === 'PENDING')
            ? (statusInput as any)
            : undefined,
        commissionType: isAdmin && (commissionTypeInput === 'FLAT' || commissionTypeInput === 'PERCENT') ? (commissionTypeInput as any) : undefined,
        commissionRate: isAdmin ? commissionRate : undefined,
      },
    });

    if (!isAdmin) {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
      if (admins.length > 0) {
        const me = await prisma.user.findUnique({
          where: { id: String(user.id) },
          select: { id: true, name: true, email: true },
        });
        const title = 'Permintaan menjadi vendor';
        const message = `User: ${me?.name || me?.email || String(user.id)}\nEmail: ${me?.email || '-'}\nUserId: ${String(
          user.id
        )}\nVendor: ${created.name}\nSlug: ${created.slug}\n\nLINK:/dashboard/admin/shop/vendors`;
        await prisma.notification.createMany({
          data: admins.map((a) => ({ userId: a.id, title, message, read: false })),
        });
      }
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membuat vendor' }, { status: 500 });
  }
}
