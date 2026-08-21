import path from 'path';

const OPTIMIZABLE_MEDIA_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD_IMAGE_DIMENSION = 2200;
const WEBP_UPLOAD_QUALITY = 78;

function isWithinBaseDir(baseDir: string, absolutePath: string) {
  const relativeFromBase = path.relative(baseDir, absolutePath);
  return !relativeFromBase.startsWith('..') && !path.isAbsolute(relativeFromBase) && absolutePath.startsWith(baseDir);
}

export function resolveMediaStoragePath(storagePath?: string | null) {
  const raw = typeof storagePath === 'string' ? storagePath.trim() : '';
  if (!raw || raw.startsWith('cloudinary:')) return null;

  const baseDir = path.resolve(process.cwd(), 'public', 'uploads', 'media');
  const absolutePath = path.resolve(process.cwd(), raw);
  if (!isWithinBaseDir(baseDir, absolutePath)) return null;
  return absolutePath;
}

export function resolveMediaPublicUrlPath(url?: string | null) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw.startsWith('/uploads/media/')) return null;

  const baseDir = path.resolve(process.cwd(), 'public', 'uploads', 'media');
  const absolutePath = path.resolve(process.cwd(), 'public', raw.replace(/^\//, ''));
  if (!isWithinBaseDir(baseDir, absolutePath)) return null;
  return absolutePath;
}

function replaceFileExtension(filename: string, nextExtension: string) {
  const normalized = String(filename || '').trim();
  if (!normalized) return `upload.${nextExtension}`;

  const dotIndex = normalized.lastIndexOf('.');
  const base = dotIndex > 0 ? normalized.slice(0, dotIndex) : normalized;
  return `${base}.${nextExtension}`;
}

type OptimizeUploadedMediaInput = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

type OptimizeUploadedMediaResult = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  size: number;
};

export async function optimizeUploadedMedia(input: OptimizeUploadedMediaInput): Promise<OptimizeUploadedMediaResult> {
  const original = {
    buffer: input.buffer,
    mimeType: input.mimeType,
    filename: input.filename,
    size: input.buffer.length,
  };

  if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) return original;
  if (!OPTIMIZABLE_MEDIA_MIME.has(input.mimeType)) return original;

  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default;

    const probe = sharp(input.buffer, { animated: true, failOn: 'none' });
    const metadata = await probe.metadata();

    // Skip animated formats so we do not accidentally flatten them.
    if ((metadata.pages ?? 1) > 1) return original;

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const shouldResize = Math.max(width, height) > MAX_UPLOAD_IMAGE_DIMENSION;

    let pipeline = sharp(input.buffer, { failOn: 'none' }).rotate();
    if (shouldResize) {
      pipeline = pipeline.resize({
        width: MAX_UPLOAD_IMAGE_DIMENSION,
        height: MAX_UPLOAD_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const optimizedBuffer = await pipeline
      .webp({
        quality: WEBP_UPLOAD_QUALITY,
        alphaQuality: WEBP_UPLOAD_QUALITY,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer();

    if (!shouldResize && optimizedBuffer.length >= Math.floor(input.buffer.length * 0.95)) {
      return original;
    }

    return {
      buffer: optimizedBuffer,
      mimeType: 'image/webp',
      filename: replaceFileExtension(input.filename, 'webp'),
      size: optimizedBuffer.length,
    };
  } catch {
    return original;
  }
}
