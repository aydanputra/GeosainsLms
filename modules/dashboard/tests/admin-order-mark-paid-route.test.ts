import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as adminOrderMarkPaidRoute } from '@/app/api/dashboard/admin/orders/[orderId]/mark-paid/route';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { finalizeOrderPaid } from '@/modules/payment/api/service';
import { writeAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

describe('Admin Order Mark Paid Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
    (verifyToken as any).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
  });

  it('should reject mark-paid when manual payment proof has not been submitted', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      manualPaymentStatus: 'NONE',
      manualPaymentProofUrl: null,
      manualPaymentProofMediaId: null,
      payment: { status: 'PENDING' },
    });

    const req = new NextRequest('http://localhost/api/dashboard/admin/orders/order-1/mark-paid', {
      method: 'POST',
      headers: { cookie: 'token=abc' },
    });

    const res = await adminOrderMarkPaidRoute(req, { params: Promise.resolve({ orderId: 'order-1' }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'Bukti pembayaran belum diajukan atau sudah diproses' });
    expect(finalizeOrderPaid).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('should mark paid when submitted proof exists and payment is not already successful', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      manualPaymentStatus: 'SUBMITTED',
      manualPaymentProofUrl: '/api/shop/orders/order-1/payment-proof/file',
      manualPaymentProofMediaId: 'media-1',
      payment: { status: 'PENDING' },
    });
    (finalizeOrderPaid as any).mockResolvedValue({ id: 'order-1', status: 'PAID' });
    (prisma.order.update as any).mockResolvedValue({
      id: 'order-1',
      status: 'PAID',
      manualPaymentStatus: 'APPROVED',
    });

    const req = new NextRequest('http://localhost/api/dashboard/admin/orders/order-1/mark-paid', {
      method: 'POST',
      headers: { cookie: 'token=abc' },
    });

    const res = await adminOrderMarkPaidRoute(req, { params: Promise.resolve({ orderId: 'order-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      ok: true,
      order: { id: 'order-1', status: 'PAID' },
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
        action: 'ORDER_MARK_PAID',
        entityType: 'Order',
        entityId: 'order-1',
      })
    );
  });
});
