import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { unlink } from 'fs/promises';
import { writeAccessDeniedAuditLog, writeAuditLog } from '@/utils/audit';
import { resolveMediaStoragePath } from '@/utils/mediaStorage';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isSameOrigin(req)) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'MEDIA_MUTATION_DENIED',
        status: 403,
        entityType: 'MediaAsset',
        entityId: id,
        reason: 'cross_origin',
        metadata: { method: 'PATCH' },
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = req.cookies.get('token')?.value;
    if (!token) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'MEDIA_MUTATION_DENIED',
        status: 401,
        entityType: 'MediaAsset',
        entityId: id,
        reason: 'missing_token',
        metadata: { method: 'PATCH' },
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'MEDIA_MUTATION_DENIED',
        status: 401,
        entityType: 'MediaAsset',
        entityId: id,
        reason: 'invalid_token',
        metadata: { method: 'PATCH' },
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isOwner = asset.userId === String(user.id);
    if (!isAdmin && !isOwner) {
      await writeAccessDeniedAuditLog({
        req,
        actor: { id: String(user.id), role: user.role },
        action: 'MEDIA_MUTATION_DENIED',
        status: 403,
        entityType: 'MediaAsset',
        entityId: id,
        reason: 'forbidden',
        metadata: { method: 'PATCH' },
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isSameOrigin(req)) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'MEDIA_MUTATION_DENIED',
        status: 403,
        entityType: 'MediaAsset',
        entityId: id,
        reason: 'cross_origin',
        metadata: { method: 'DELETE' },
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = req.cookies.get('token')?.value;
    if (!token) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'MEDIA_MUTATION_DENIED',
        status: 401,
        entityType: 'MediaAsset',
        entityId: id,
        reason: 'missing_token',
        metadata: { method: 'DELETE' },
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'MEDIA_MUTATION_DENIED',
        status: 401,
        entityType: 'MediaAsset',
        entityId: id,
        reason: 'invalid_token',
        metadata: { method: 'DELETE' },
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isOwner = asset.userId === String(user.id);
    if (!isAdmin && !isOwner) {
      await writeAccessDeniedAuditLog({
        req,
        actor: { id: String(user.id), role: user.role },
        action: 'MEDIA_MUTATION_DENIED',
        status: 403,
        entityType: 'MediaAsset',
        entityId: id,
        reason: 'forbidden',
        metadata: { method: 'DELETE' },
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.mediaAsset.delete({ where: { id } });

    const absolute = resolveMediaStoragePath(asset.storagePath);
    if (absolute) {
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
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
