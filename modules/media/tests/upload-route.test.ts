import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as uploadMediaRoute } from '@/app/api/media/upload/route';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { writeRateLimitAuditLog } from '@/utils/audit';
import { optimizeUploadedMedia } from '@/utils/mediaStorage';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    mediaAsset: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/modules/auth/utils/security', () => ({
  enforceRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  isSameOrigin: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {},
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
  writeRateLimitAuditLog: vi.fn(),
}));

vi.mock('@/utils/mediaStorage', () => ({
  optimizeUploadedMedia: vi.fn(async ({ buffer, mimeType, filename }: { buffer: Buffer; mimeType: string; filename: string }) => ({
    buffer,
    mimeType,
    filename,
    size: buffer.length,
  })),
}));

describe('Media Upload Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
    (getClientIp as any).mockReturnValue('127.0.0.1');
    (enforceRateLimit as any).mockReturnValue({ ok: true });
    (optimizeUploadedMedia as any).mockImplementation(
      async ({ buffer, mimeType, filename }: { buffer: Buffer; mimeType: string; filename: string }) => ({
      buffer,
      mimeType,
      filename,
      size: buffer.length,
      })
    );
    delete process.env.VERCEL;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  const createUploadRequest = (form: FormData) =>
    ({
      headers: {
        get: (name: string) => {
          const normalized = name.toLowerCase();
          if (normalized === 'origin') return 'http://localhost';
          if (normalized === 'referer') return 'http://localhost/dashboard/admin/media';
          return null;
        },
      },
      cookies: {
        get: (name: string) => (name === 'token' ? { value: 'abc' } : undefined),
      },
      formData: vi.fn().mockResolvedValue(form),
    }) as any;

  it('should reject generic SVG uploads outside certificate library flow', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'mentor-1', role: 'MENTOR' });

    const form = new FormData();
    form.set('file', new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'shape.svg', { type: 'image/svg+xml' }));
    form.set('alt', 'profile-image');

    const req = createUploadRequest(form);

    const res = await uploadMediaRoute(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'Upload SVG hanya diizinkan untuk library sertifikat oleh admin atau mentor' });
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('should return 429 when upload rate limit is exceeded', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'mentor-1', role: 'MENTOR' });
    (enforceRateLimit as any)
      .mockReturnValueOnce({ ok: false, retryAfterSeconds: 120 })
      .mockReturnValue({ ok: true });

    const form = new FormData();
    form.set('file', new File(['abc'], 'sample.png', { type: 'image/png' }));

    const req = createUploadRequest(form);
    const res = await uploadMediaRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('120');
    expect(data).toEqual({ error: 'Terlalu banyak upload. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MEDIA_UPLOAD_RATE_LIMITED',
        key: 'media:upload:ip:127.0.0.1',
      })
    );
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('should reject certificate SVG uploads that contain dangerous markup', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'mentor-1', role: 'MENTOR' });

    const form = new FormData();
    form.set(
      'file',
      new File(
        ['<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>bad</div></foreignObject></svg>'],
        'shape.svg',
        { type: 'image/svg+xml' }
      )
    );
    form.set('alt', 'certificate-library-svg:shape');

    const req = createUploadRequest(form);

    const res = await uploadMediaRoute(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'SVG mengandung elemen atau atribut yang tidak diizinkan' });
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

});
