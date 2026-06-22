import { del, get, put } from '@vercel/blob';
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const BLOB_PREFIX = 'blob:';

export function isBlobStorageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isVercelRuntime() {
  return process.env.VERCEL === '1';
}

export function assertLessonAttachmentStorageConfigured() {
  if (isBlobStorageEnabled()) return;
  if (isVercelRuntime()) {
    throw new Error('Penyimpanan lampiran belum dikonfigurasi di server. Tambahkan BLOB_READ_WRITE_TOKEN di Vercel.');
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
    const pathname = `lessons/${safeLessonId}/${filename}`;
    const blob = await put(pathname, args.buffer, {
      access: 'private',
      contentType: args.mimeType,
      addRandomSuffix: false,
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
    const pathname = getBlobPathnameFromStoragePath(storagePath);
    const blob = await get(pathname, { access: 'private' });

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
    await del(getBlobPathnameFromStoragePath(storagePath));
    return;
  }

  const absolutePath = path.isAbsolute(storagePath)
    ? storagePath
    : path.join(process.cwd(), storagePath);
  await unlink(absolutePath);
}
