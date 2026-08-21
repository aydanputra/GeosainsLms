import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as submitPaymentProofRoute } from '@/app/api/shop/orders/[orderId]/payment-proof/route';
import { GET as getPaymentProofFileRoute } from '@/app/api/shop/orders/[orderId]/payment-proof/file/route';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { writeAccessDeniedAuditLog, writeRateLimitAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    mediaAsset: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
    course: {
      findMany: vi.fn(),
    },
    courseCoInstructor: {
      findMany: vi.fn(),
    },
    shopVendor: {
      findMany: vi.fn(),
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

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
  writeRateLimitAuditLog: vi.fn(),
  writeAccessDeniedAuditLog: vi.fn(),
}));

describe('Payment Proof Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
    (getClientIp as any).mockReturnValue('127.0.0.1');
    (enforceRateLimit as any).mockReturnValue({ ok: true });
  });

  it('should store protected proof URL instead of raw media URL', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'user-1', role: 'STUDENT' });
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'PENDING',
      manualPaymentStatus: 'NONE',
      paymentDueAt: null,
    });
    (prisma.mediaAsset.findUnique as any).mockResolvedValue({
      id: 'media-1',
      url: '/uploads/media/user-1/proof.png',
      userId: 'user-1',
      mimeType: 'image/png',
    });
    (prisma.order.update as any).mockResolvedValue({
      id: 'order-1',
      manualPaymentStatus: 'SUBMITTED',
      manualPaymentProofUrl: '/api/shop/orders/order-1/payment-proof/file',
      manualPaymentNote: null,
      manualPaymentSubmittedAt: new Date().toISOString(),
    });
    (prisma.user.findMany as any).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/shop/orders/order-1/payment-proof', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'token=abc' },
      body: JSON.stringify({ mediaId: 'media-1' }),
    });

    const res = await submitPaymentProofRoute(req, { params: Promise.resolve({ orderId: 'order-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          manualPaymentProofUrl: '/api/shop/orders/order-1/payment-proof/file',
          manualPaymentProofMediaId: 'media-1',
        }),
      })
    );
    expect(data.manualPaymentProofUrl).toBe('/api/shop/orders/order-1/payment-proof/file');
  });

  it('should reject non-image media for payment proof', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'user-1', role: 'STUDENT' });
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'PENDING',
      manualPaymentStatus: 'NONE',
      paymentDueAt: null,
    });
    (prisma.mediaAsset.findUnique as any).mockResolvedValue({
      id: 'media-1',
      url: '/uploads/media/user-1/proof.pdf',
      userId: 'user-1',
      mimeType: 'application/pdf',
    });

    const req = new NextRequest('http://localhost/api/shop/orders/order-1/payment-proof', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'token=abc' },
      body: JSON.stringify({ mediaId: 'media-1' }),
    });

    const res = await submitPaymentProofRoute(req, { params: Promise.resolve({ orderId: 'order-1' }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'Bukti pembayaran harus berupa gambar JPG, PNG, WEBP, atau GIF' });
  });

  it('should audit when payment proof upload rate limit is exceeded', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'user-1', role: 'STUDENT' });
    (enforceRateLimit as any).mockReturnValueOnce({ ok: false, retryAfterSeconds: 90 });

    const req = new NextRequest('http://localhost/api/shop/orders/order-1/payment-proof', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'token=abc' },
      body: JSON.stringify({ mediaId: 'media-1' }),
    });

    const res = await submitPaymentProofRoute(req, { params: Promise.resolve({ orderId: 'order-1' }) });
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data).toEqual({ error: 'Terlalu banyak percobaan kirim bukti. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_PAYMENT_PROOF_RATE_LIMITED',
        key: 'orders:payment-proof:ip:127.0.0.1',
      })
    );
  });

  it('should forbid unrelated users from reading protected proof file', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'user-2', role: 'STUDENT' });
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      manualPaymentProofUrl: '/uploads/media/user-1/proof.png',
      manualPaymentProofMediaId: 'media-1',
      manualPaymentStatus: 'SUBMITTED',
    });

    const req = new NextRequest('http://localhost/api/shop/orders/order-1/payment-proof/file', {
      headers: { cookie: 'token=abc' },
    });
    const res = await getPaymentProofFileRoute(req, { params: Promise.resolve({ orderId: 'order-1' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'Forbidden' });
    expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_PAYMENT_PROOF_FILE_DENIED',
        entityId: 'order-1',
        status: 403,
      })
    );
    expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
  });

  it('should forbid mentors from reading protected proof file', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'mentor-1', role: 'MENTOR' });
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      manualPaymentProofUrl: '/uploads/media/user-1/proof.png',
      manualPaymentProofMediaId: 'media-1',
      manualPaymentStatus: 'SUBMITTED',
    });

    const req = new NextRequest('http://localhost/api/shop/orders/order-1/payment-proof/file', {
      headers: { cookie: 'token=abc' },
    });
    const res = await getPaymentProofFileRoute(req, { params: Promise.resolve({ orderId: 'order-1' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'Forbidden' });
    expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_PAYMENT_PROOF_FILE_DENIED',
        entityId: 'order-1',
        status: 403,
      })
    );
    expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
  });
});
