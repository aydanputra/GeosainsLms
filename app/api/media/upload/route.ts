import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeAuditLog } from '@/utils/audit';

export const runtime = 'nodejs';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
const MAX_SIZE = 10 * 1024 * 1024;

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file');
    const alt = formData.get('alt');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File wajib diisi' }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Tipe file tidak didukung' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 });
    }

    let buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === 'image/svg+xml') {
      const raw = buffer.toString('utf8');
      const stripped = raw
        .replace(/\uFEFF/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
        .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
        .replace(/javascript:/gi, '');
      const normalized = stripped.trim();
      if (!normalized.toLowerCase().includes('<svg')) {
        return NextResponse.json({ error: 'SVG tidak valid' }, { status: 400 });
      }
      buffer = Buffer.from(normalized, 'utf8');
    }

    const safeUserId = sanitizeSegment(String(user.id));
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'media', safeUserId);
    await mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const safeName = sanitizeFilename(file.name);
    const filename = `${timestamp}-${uuidv4().slice(0, 8)}-${safeName}`;
    const absolutePath = path.join(uploadDir, filename);

    await writeFile(absolutePath, buffer);

    const storagePath = path.join('public', 'uploads', 'media', safeUserId, filename);
    const url = `/uploads/media/${safeUserId}/${filename}`;

    const created = await prisma.mediaAsset.create({
      data: {
        userId: String(user.id),
        url,
        storagePath,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        alt: typeof alt === 'string' && alt.trim() ? alt.trim() : null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'MEDIA_UPLOAD',
      entityType: 'MediaAsset',
      entityId: created.id,
      metadata: { url: created.url, mimeType: created.mimeType, size: created.size },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
