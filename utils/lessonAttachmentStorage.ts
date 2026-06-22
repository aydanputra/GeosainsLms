import { del, get, put } from '@vercel/blob';
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const BLOB_PREFIX = 'blob:';

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

export function isVercelRuntime() {
  return process.env.VERCEL === '1';
}

export function assertLessonAttachmentStorageConfigured() {
  if (isBlobStorageEnabled()) return;
  if (isVercelRuntime()) {
    const tokenInfo = getBlobTokenInfo();
    const candidateInfo = tokenInfo.candidates.length > 0 ? tokenInfo.candidates.join(', ') : 'tidak ada kandidat env';
    throw new Error(`Penyimpanan lampiran belum dikonfigurasi di server. Tambahkan token Blob di Vercel. Kandidat env yang dicek: ${candidateInfo}.`);
  }
}

export function isBlobStoragePath(storagePath?: string | null) {
  return typeof storagePath === 'string' && storagePath.startsWith(BLOB_PREFIX);
}

export function getBlobPathnameFromStoragePath(storagePath: string) {
  return storagePath.slice(BLOB_PREFIX.length);
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
