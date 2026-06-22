import { del, get, put } from '@vercel/blob';
import { createHash } from 'crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const BLOB_PREFIX = 'blob:';
const CLOUDINARY_RAW_PREFIX = 'cloudinary-raw:';

function getCloudinaryConfig() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

function getBlobTokenCandidates() {
  const envKeys = Object.keys(process.env || {});
  const candidates = [
    'BLOB_READ_WRITE_TOKEN',
    ...envKeys.filter((key) => {
      const upperKey = key.toUpperCase();
      return upperKey !== 'BLOB_READ_WRITE_TOKEN'
        && upperKey.includes('BLOB')
        && upperKey.endsWith('READ_WRITE_TOKEN');
    }),
  ];

  return Array.from(new Set(candidates));
}

function getBlobTokenInfo() {
  const candidates = getBlobTokenCandidates();
  for (const key of candidates) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return {
        key,
        value: value.trim(),
        candidates,
      };
    }
  }

  return {
    key: null,
    value: null,
    candidates,
  };
}

export function isBlobStorageEnabled() {
  return Boolean(getBlobTokenInfo().value);
}

export function isCloudinaryStorageEnabled() {
  return Boolean(getCloudinaryConfig());
}

export function isVercelRuntime() {
  return process.env.VERCEL === '1';
}

export function assertLessonAttachmentStorageConfigured() {
  if (isCloudinaryStorageEnabled() || isBlobStorageEnabled()) return;
  if (isVercelRuntime()) {
    const tokenInfo = getBlobTokenInfo();
    const candidateInfo = tokenInfo.candidates.length > 0 ? tokenInfo.candidates.join(', ') : 'tidak ada kandidat env';
    throw new Error(
      `Penyimpanan lampiran belum dikonfigurasi di server. Set salah satu: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET atau token Blob di Vercel. Kandidat env Blob yang dicek: ${candidateInfo}.`
    );
  }
}

export function isBlobStoragePath(storagePath?: string | null) {
  return typeof storagePath === 'string' && storagePath.startsWith(BLOB_PREFIX);
}

export function getBlobPathnameFromStoragePath(storagePath: string) {
  return storagePath.slice(BLOB_PREFIX.length);
}

export function isCloudinaryRawStoragePath(storagePath?: string | null) {
  return typeof storagePath === 'string' && storagePath.startsWith(CLOUDINARY_RAW_PREFIX);
}

function getCloudinaryRawMeta(storagePath: string) {
  const payload = storagePath.slice(CLOUDINARY_RAW_PREFIX.length);
  const [publicIdEncoded, ...urlParts] = payload.split('|');
  const publicId = decodeURIComponent(publicIdEncoded || '');
  const url = urlParts.join('|');
  return { publicId, url };
}

function buildSafeAttachmentName(originalName: string) {
  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${timestamp}-${uuidv4().slice(0, 8)}-${safeName}`;
  return {
    filename,
    safeName,
    timestamp,
  };
}

export async function saveLessonAttachmentFile(args: {
  lessonId: string;
  originalName: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const safeLessonId = args.lessonId.replace(/[^a-zA-Z0-9-]/g, '');
  const { filename } = buildSafeAttachmentName(args.originalName);

  if (isCloudinaryStorageEnabled()) {
    const cfg = getCloudinaryConfig();
    if (!cfg) throw new Error('Konfigurasi Cloudinary tidak tersedia');

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `geosains-lms/lessons/${safeLessonId}`;
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = createHash('sha1').update(paramsToSign + cfg.apiSecret).digest('hex');

    const form = new FormData();
    const bytes = new Uint8Array(args.buffer);
    form.set('file', new Blob([bytes], { type: args.mimeType || 'application/octet-stream' }), filename);
    form.set('api_key', cfg.apiKey);
    form.set('timestamp', String(timestamp));
    form.set('folder', folder);
    form.set('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/raw/upload`, {
      method: 'POST',
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg =
        typeof data?.error?.message === 'string'
          ? data.error.message
          : typeof data?.message === 'string'
            ? data.message
            : 'Gagal upload dokumen ke Cloudinary';
      throw new Error(msg);
    }

    const secureUrl = typeof data?.secure_url === 'string' ? data.secure_url : '';
    const publicId = typeof data?.public_id === 'string' ? data.public_id : '';
    if (!secureUrl || !publicId) {
      throw new Error('Cloudinary tidak mengembalikan metadata dokumen yang lengkap');
    }

    return {
      storageKind: 'cloudinary' as const,
      storagePath: `${CLOUDINARY_RAW_PREFIX}${encodeURIComponent(publicId)}|${secureUrl}`,
      safeLessonId,
      filename,
      debugTarget: {
        publicId,
        url: secureUrl,
      },
    };
  }

  if (isBlobStorageEnabled()) {
    const tokenInfo = getBlobTokenInfo();
    const pathname = `lessons/${safeLessonId}/${filename}`;
    const blob = await put(pathname, args.buffer, {
      access: 'private',
      contentType: args.mimeType,
      addRandomSuffix: false,
      token: tokenInfo.value || undefined,
    });

    return {
      storageKind: 'blob' as const,
      storagePath: `${BLOB_PREFIX}${blob.pathname}`,
      safeLessonId,
      filename,
      debugTarget: {
        pathname: blob.pathname,
        url: blob.url,
      },
    };
  }

  const uploadDir = path.join(process.cwd(), 'storage', 'lessons', safeLessonId);
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, args.buffer);

  return {
    storageKind: 'local' as const,
    storagePath: `storage/lessons/${safeLessonId}/${filename}`,
    safeLessonId,
    filename,
    debugTarget: {
      uploadDir,
      filePath,
    },
  };
}

export async function readLessonAttachmentFile(storagePath: string) {
  if (isCloudinaryRawStoragePath(storagePath)) {
    const meta = getCloudinaryRawMeta(storagePath);
    if (!meta.url) return null;

    const response = await fetch(meta.url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const fileBuffer = Buffer.from(await response.arrayBuffer());

    return {
      body: fileBuffer,
      size: fileBuffer.length,
      contentType: response.headers.get('content-type'),
    };
  }

  if (isBlobStoragePath(storagePath)) {
    const tokenInfo = getBlobTokenInfo();
    const pathname = getBlobPathnameFromStoragePath(storagePath);
    const blob = await get(pathname, {
      access: 'private',
      token: tokenInfo.value || undefined,
    });

    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return null;
    }

    return {
      body: blob.stream,
      size: blob.blob.size,
      contentType: blob.blob.contentType,
    };
  }

  const absolutePath = path.isAbsolute(storagePath)
    ? storagePath
    : path.join(process.cwd(), storagePath);
  const stats = await stat(absolutePath);
  const fileBuffer = await readFile(absolutePath);

  return {
    body: fileBuffer,
    size: stats.size,
    contentType: null,
  };
}

export async function deleteLessonAttachmentFile(storagePath?: string | null) {
  if (!storagePath) return;

  if (isCloudinaryRawStoragePath(storagePath)) {
    const cfg = getCloudinaryConfig();
    if (!cfg) return;

    const meta = getCloudinaryRawMeta(storagePath);
    if (!meta.publicId) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `public_id=${meta.publicId}&timestamp=${timestamp}`;
    const signature = createHash('sha1').update(paramsToSign + cfg.apiSecret).digest('hex');
    const form = new URLSearchParams();
    form.set('public_id', meta.publicId);
    form.set('api_key', cfg.apiKey);
    form.set('timestamp', String(timestamp));
    form.set('signature', signature);

    await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/raw/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    return;
  }

  if (isBlobStoragePath(storagePath)) {
    const tokenInfo = getBlobTokenInfo();
    await del(getBlobPathnameFromStoragePath(storagePath), {
      token: tokenInfo.value || undefined,
    });
    return;
  }

  const absolutePath = path.isAbsolute(storagePath)
    ? storagePath
    : path.join(process.cwd(), storagePath);
  await unlink(absolutePath);
}
