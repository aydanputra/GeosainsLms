import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { writeRateLimitAuditLog } from '@/utils/audit';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeAuditLog } from '@/utils/audit';
import { createHash } from 'crypto';
import { optimizeUploadedMedia } from '@/utils/mediaStorage';

export const runtime = 'nodejs';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
const MAX_SIZE = 10 * 1024 * 1024;
const SVG_CERTIFICATE_ALT_PREFIX = 'certificate-library-svg:';
const SVG_DISALLOWED_PATTERN =
  /<\s*(script|foreignobject|iframe|frame|object|embed|audio|video|use|image|link|style|animate|set|animatemotion|animatetransform)\b|on[a-z]+\s*=|(?:xlink:href|href|src)\s*=|<!doctype|<!entity|<\?xml-stylesheet|javascript:|data:text\/html|data:application\/xml|vbscript:/i;

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function canUploadSvg(userRole: string, alt: unknown) {
  const normalizedAlt = typeof alt === 'string' ? alt.trim().toLowerCase() : '';
  const normalizedRole = String(userRole || '').toUpperCase();
  const isCertificateSvg = normalizedAlt.startsWith(SVG_CERTIFICATE_ALT_PREFIX);
  const isPrivilegedUser = normalizedRole === 'ADMIN' || normalizedRole === 'MENTOR';
  return isCertificateSvg && isPrivilegedUser;
}

function sanitizeSvgMarkup(raw: string) {
  const normalized = raw
    .replace(/\uFEFF/g, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .trim();

  if (!normalized.toLowerCase().includes('<svg')) {
    throw new Error('SVG tidak valid');
  }

  if (SVG_DISALLOWED_PATTERN.test(normalized)) {
    throw new Error('SVG mengandung elemen atau atribut yang tidak diizinkan');
  }

  return normalized;
}

function getCloudinaryConfig() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

async function uploadToCloudinary(opts: {
  buffer: Buffer;
  mimeType: string;
  safeUserId: string;
  originalFilename: string;
}) {
  const cfg = getCloudinaryConfig();
  if (!cfg) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `geosains-lms/${opts.safeUserId}`;
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(paramsToSign + cfg.apiSecret).digest('hex');

  const form = new FormData();
  const bytes = new Uint8Array(opts.buffer);
  form.set('file', new Blob([bytes], { type: opts.mimeType }), opts.originalFilename);
  form.set('api_key', cfg.apiKey);
  form.set('timestamp', String(timestamp));
  form.set('folder', folder);
  form.set('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.error?.message === 'string'
        ? data.error.message
        : typeof data?.message === 'string'
          ? data.message
          : 'Gagal upload ke Cloudinary';
    throw new Error(msg);
  }
  const secureUrl = typeof data?.secure_url === 'string' ? data.secure_url : '';
  const publicId = typeof data?.public_id === 'string' ? data.public_id : '';
  if (!secureUrl) throw new Error('Cloudinary tidak mengembalikan secure_url');
  return { url: secureUrl, storagePath: publicId ? `cloudinary:${publicId}` : 'cloudinary' };
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ip = getClientIp(req);
    const ipRl = enforceRateLimit({ key: `media:upload:ip:${ip}`, limit: 40, windowMs: 15 * 60 * 1000 });
    if (!ipRl.ok) {
      await writeRateLimitAuditLog({
        req,
        actor: { id: String(user.id), role: user.role },
        action: 'MEDIA_UPLOAD_RATE_LIMITED',
        key: `media:upload:ip:${ip}`,
        retryAfterSeconds: ipRl.retryAfterSeconds,
        entityType: 'MediaAsset',
        metadata: { scope: 'ip' },
      });
      return NextResponse.json(
        { error: 'Terlalu banyak upload. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(ipRl.retryAfterSeconds) } }
      );
    }
    const userRl = enforceRateLimit({ key: `media:upload:user:${String(user.id)}`, limit: 60, windowMs: 15 * 60 * 1000 });
    if (!userRl.ok) {
      await writeRateLimitAuditLog({
        req,
        actor: { id: String(user.id), role: user.role },
        action: 'MEDIA_UPLOAD_RATE_LIMITED',
        key: `media:upload:user:${String(user.id)}`,
        retryAfterSeconds: userRl.retryAfterSeconds,
        entityType: 'MediaAsset',
        metadata: { scope: 'user' },
      });
      return NextResponse.json(
        { error: 'Terlalu banyak upload untuk akun ini. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(userRl.retryAfterSeconds) } }
      );
    }

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
      if (!canUploadSvg(user.role, alt)) {
        return NextResponse.json(
          { error: 'Upload SVG hanya diizinkan untuk library sertifikat oleh admin atau mentor' },
          { status: 400 }
        );
      }

      const raw = buffer.toString('utf8');
      let sanitizedSvg = '';
      try {
        sanitizedSvg = sanitizeSvgMarkup(raw);
      } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'SVG tidak valid' }, { status: 400 });
      }
      buffer = Buffer.from(sanitizedSvg, 'utf8');
    }

    const safeUserId = sanitizeSegment(String(user.id));
    const safeName = sanitizeFilename(file.name);
    const optimized = await optimizeUploadedMedia({
      buffer,
      mimeType: file.type,
      filename: safeName,
    });
    const storedBuffer = optimized.buffer;
    const storedMimeType = optimized.mimeType;
    const storedFilename = optimized.filename;

    const cloud = await uploadToCloudinary({
      buffer: storedBuffer,
      mimeType: storedMimeType,
      safeUserId,
      originalFilename: storedFilename,
    });

    let storagePath: string | null = null;
    let url = '';
    if (cloud) {
      storagePath = cloud.storagePath;
      url = cloud.url;
    } else {
      if (process.env.VERCEL) {
        return NextResponse.json(
          {
            error:
              'Upload media di Vercel membutuhkan storage eksternal. Set env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.',
          },
          { status: 400 }
        );
      }

      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'media', safeUserId);
      await mkdir(uploadDir, { recursive: true });

      const timestamp = Date.now();
      const filename = `${timestamp}-${uuidv4().slice(0, 8)}-${storedFilename}`;
      const absolutePath = path.join(uploadDir, filename);
      await writeFile(absolutePath, storedBuffer);

      storagePath = path.join('public', 'uploads', 'media', safeUserId, filename);
      url = `/uploads/media/${safeUserId}/${filename}`;
    }

    const created = await prisma.mediaAsset.create({
      data: {
        userId: String(user.id),
        url,
        storagePath,
        filename: file.name,
        mimeType: storedMimeType,
        size: storedBuffer.length,
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
      metadata: { url: created.url, mimeType: created.mimeType, size: created.size, originalSize: file.size },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
