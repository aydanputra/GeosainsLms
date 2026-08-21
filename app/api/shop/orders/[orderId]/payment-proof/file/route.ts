import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { readFile, stat } from 'fs/promises';
import { writeAccessDeniedAuditLog } from '@/utils/audit';
import { resolveMediaPublicUrlPath, resolveMediaStoragePath } from '@/utils/mediaStorage';

export const runtime = 'nodejs';

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

async function readPaymentProofSource(opts: { storagePath?: string | null; url?: string | null }) {
  const storagePath = typeof opts.storagePath === 'string' ? opts.storagePath.trim() : '';
  const url = typeof opts.url === 'string' ? opts.url.trim() : '';

  if (storagePath && !storagePath.startsWith('cloudinary:')) {
    const absolutePath = resolveMediaStoragePath(storagePath);
    if (!absolutePath) return null;
    const [stats, buffer] = await Promise.all([stat(absolutePath), readFile(absolutePath)]);
    return {
      body: buffer,
      size: stats.size,
      contentType: null as string | null,
    };
  }

  let remoteUrl = '';
  if (isHttpUrl(url)) {
    remoteUrl = url;
  } else if (!storagePath && url.startsWith('/uploads/')) {
    const absolutePath = resolveMediaPublicUrlPath(url);
    if (!absolutePath) return null;
    const [stats, buffer] = await Promise.all([stat(absolutePath), readFile(absolutePath)]);
    return {
      body: buffer,
      size: stats.size,
      contentType: null as string | null,
    };
  } else if (storagePath.startsWith('cloudinary:') && isHttpUrl(url)) {
    remoteUrl = url;
  }

  if (!remoteUrl) return null;

  const response = await fetch(remoteUrl, { cache: 'no-store' });
  if (!response.ok) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    body: buffer,
    size: buffer.length,
    contentType: response.headers.get('content-type'),
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<any> }) {
  try {
    const { orderId } = await params;
    const id = String(orderId || '').trim();
    const token = req.cookies.get('token')?.value;
    if (!token) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'ORDER_PAYMENT_PROOF_FILE_DENIED',
        status: 401,
        entityType: 'Order',
        entityId: id || null,
        reason: 'missing_token',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'ORDER_PAYMENT_PROOF_FILE_DENIED',
        status: 401,
        entityType: 'Order',
        entityId: id || null,
        reason: 'invalid_token',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) return NextResponse.json({ error: 'Order tidak valid' }, { status: 400 });

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        manualPaymentProofUrl: true,
        manualPaymentProofMediaId: true,
        manualPaymentStatus: true,
      },
    });

    if (!order || (!order.manualPaymentProofMediaId && !order.manualPaymentProofUrl)) {
      return NextResponse.json({ error: 'Bukti pembayaran tidak ditemukan' }, { status: 404 });
    }

    const role = String(user.role || '').toUpperCase();
    const isOwner = String(order.userId) === String(user.id);
    const isAdmin = role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      await writeAccessDeniedAuditLog({
        req,
        actor: { id: String(user.id), role: user.role },
        action: 'ORDER_PAYMENT_PROOF_FILE_DENIED',
        status: 403,
        entityType: 'Order',
        entityId: id,
        reason: 'forbidden',
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const media = order.manualPaymentProofMediaId
      ? await prisma.mediaAsset.findUnique({
          where: { id: String(order.manualPaymentProofMediaId) },
          select: {
            id: true,
            url: true,
            storagePath: true,
            mimeType: true,
            filename: true,
            size: true,
          },
        })
      : null;

    const storedFile = await readPaymentProofSource({
      storagePath: media?.storagePath || null,
      url: media?.url || order.manualPaymentProofUrl,
    });
    if (!storedFile) {
      return NextResponse.json({ error: 'File bukti pembayaran tidak ditemukan' }, { status: 404 });
    }

    const filename = media?.filename || `payment-proof-${id}`;
    const contentType = media?.mimeType || storedFile.contentType || 'application/octet-stream';

    return new NextResponse(storedFile.body as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(storedFile.size),
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal memuat bukti pembayaran' }, { status: 500 });
  }
}
