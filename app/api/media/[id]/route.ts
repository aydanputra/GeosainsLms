import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { unlink } from 'fs/promises';
import path from 'path';
import { writeAuditLog } from '@/utils/audit';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isOwner = asset.userId === String(user.id);
    if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { alt?: unknown };
    const alt = typeof body.alt === 'string' && body.alt.trim() ? body.alt.trim() : null;

    const updated = await prisma.mediaAsset.update({
      where: { id },
      data: { alt },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'MEDIA_UPDATE',
      entityType: 'MediaAsset',
      entityId: updated.id,
      metadata: { alt },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isOwner = asset.userId === String(user.id);
    if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.mediaAsset.delete({ where: { id } });

    if (asset.storagePath) {
      const absolute = path.isAbsolute(asset.storagePath)
        ? asset.storagePath
        : path.join(process.cwd(), asset.storagePath);
      await unlink(absolute).catch(() => undefined);
    }

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'MEDIA_DELETE',
      entityType: 'MediaAsset',
      entityId: asset.id,
      metadata: { url: asset.url },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
