import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as adminOrderReviewRoute } from '@/app/api/dashboard/admin/orders/[orderId]/review/route';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { finalizeOrderPaid } from '@/modules/payment/api/service';
import { writeAuditLog } from '@/utils/audit';
import { sendStudentManualPaymentReviewEmail } from '@/utils/email-notifications';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/modules/auth/utils/security', () => ({
  isSameOrigin: vi.fn(),
}));

vi.mock('@/modules/payment/api/service', () => ({
  finalizeOrderPaid: vi.fn(),
}));

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('@/utils/email-notifications', () => ({
  sendStudentManualPaymentReviewEmail: vi.fn(),
}));

describe('Admin Order Review Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
    (verifyToken as any).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
  });

  it('should reject review when proof has not been submitted', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      userId: 'user-1',
      total: 100000,
      manualPaymentProofUrl: null,
      manualPaymentProofMediaId: null,
      manualPaymentStatus: 'NONE',
      user: { name: 'User', email: 'user@example.com' },
    });

    const req = new NextRequest('http://localhost/api/dashboard/admin/orders/order-1/review', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'token=abc',
      },
      body: JSON.stringify({ action: 'APPROVE' }),
    });

    const res = await adminOrderReviewRoute(req, { params: Promise.resolve({ orderId: 'order-1' }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'Bukti pembayaran belum diajukan atau sudah diproses' });
    expect(finalizeOrderPaid).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(sendStudentManualPaymentReviewEmail).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('should approve submitted manual payment with proof', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      userId: 'user-1',
      total: 100000,
      manualPaymentProofUrl: '/api/shop/orders/order-1/payment-proof/file',
      manualPaymentProofMediaId: 'media-1',
      manualPaymentStatus: 'SUBMITTED',
      user: { name: 'User', email: 'user@example.com' },
    });
    (finalizeOrderPaid as any).mockResolvedValue({ id: 'order-1', status: 'PAID' });
    (prisma.order.update as any).mockResolvedValue({
      id: 'order-1',
      status: 'PAID',
      manualPaymentStatus: 'APPROVED',
    });

    const req = new NextRequest('http://localhost/api/dashboard/admin/orders/order-1/review', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'token=abc',
      },
      body: JSON.stringify({ action: 'APPROVE', note: 'valid' }),
    });

    const res = await adminOrderReviewRoute(req, { params: Promise.resolve({ orderId: 'order-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      ok: true,
      order: {
        id: 'order-1',
        status: 'PAID',
        manualPaymentStatus: 'APPROVED',
      },
    });
    expect(finalizeOrderPaid).toHaveBeenCalledWith('order-1');
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          manualPaymentStatus: 'APPROVED',
          manualPaymentReviewedById: 'admin-1',
        }),
      })
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_MANUAL_PAYMENT_APPROVE',
        entityType: 'Order',
        entityId: 'order-1',
      })
    );
  });
});
