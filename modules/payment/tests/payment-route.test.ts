import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { POST as checkoutRoute } from '@/app/api/payment/checkout/route';
import { POST as webhookRoute } from '@/app/api/payment/webhook/route';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { createPayment, handlePaymentWebhook } from '@/modules/payment/api/service';
import { writeAccessDeniedAuditLog, writeAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    page: {
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
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
  createPayment: vi.fn(),
  handlePaymentWebhook: vi.fn(),
}));

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
  writeAccessDeniedAuditLog: vi.fn(),
}));

describe('Payment Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYMENT_WEBHOOK_SECRET = 'payment-webhook-secret';
    (isSameOrigin as any).mockReturnValue(true);
  });

  describe('POST /api/payment/checkout', () => {
    it('should deny creating a payment for another user order', async () => {
      (verifyToken as any).mockResolvedValue({ id: 'student-2', role: 'STUDENT' });
      (prisma.order.findUnique as any).mockResolvedValue({ id: 'order-1', userId: 'student-1' });

      const req = new NextRequest('http://localhost/api/payment/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: 'token=abc',
        },
        body: JSON.stringify({ orderId: 'order-1' }),
      });

      const res = await checkoutRoute(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data).toEqual({ error: 'Forbidden' });
      expect(createPayment).not.toHaveBeenCalled();
      expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_CHECKOUT_DENIED',
          status: 403,
          entityType: 'Order',
          entityId: 'order-1',
          reason: 'not_order_owner',
        })
      );
    });

    it('should create payment for the order owner', async () => {
      (verifyToken as any).mockResolvedValue({ id: 'student-1', role: 'STUDENT' });
      (prisma.order.findUnique as any).mockResolvedValue({ id: 'order-1', userId: 'student-1' });
      (prisma.page.findUnique as any).mockResolvedValue({ content: JSON.stringify({ paymentMethod: 'XENDIT' }) });
      (createPayment as any).mockResolvedValue({
        id: 'pay-1',
        orderId: 'order-1',
        provider: 'XENDIT',
        paymentUrl: 'https://payments.example/checkout',
      });

      const req = new NextRequest('http://localhost/api/payment/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: 'token=abc',
        },
        body: JSON.stringify({ orderId: 'order-1' }),
      });

      const res = await checkoutRoute(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data).toEqual({
        id: 'pay-1',
        orderId: 'order-1',
        provider: 'XENDIT',
        paymentUrl: 'https://payments.example/checkout',
      });
      expect(createPayment).toHaveBeenCalledWith({
        provider: 'XENDIT',
        orderId: 'order-1',
        amount: undefined,
      });
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_CHECKOUT',
          entityType: 'Payment',
        })
      );
    });
  });

  describe('POST /api/payment/webhook', () => {
    it('should reject generic webhook when provider does not match payment record', async () => {
      (prisma.payment.findFirst as any).mockResolvedValue({
        id: 'pay-1',
        provider: 'XENDIT',
        amount: 100000,
        orderId: 'order-1',
      });

      const payload = {
        externalId: 'order_order-1',
        provider: 'MIDTRANS',
        amount: 100000,
        status: 'SUCCESS',
      };
      const rawBody = JSON.stringify(payload);
      const signature = createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET as string).update(rawBody).digest('hex');

      const req = new NextRequest('http://localhost/api/payment/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-signature': signature,
        },
        body: rawBody,
      });

      const res = await webhookRoute(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toEqual({ error: 'Provider mismatch' });
      expect(handlePaymentWebhook).not.toHaveBeenCalled();
    });

    it('should reject generic webhook when amount does not match payment record', async () => {
      (prisma.payment.findFirst as any).mockResolvedValue({
        id: 'pay-1',
        provider: 'XENDIT',
        amount: 100000,
        orderId: 'order-1',
      });

      const payload = {
        externalId: 'order_order-1',
        provider: 'XENDIT',
        amount: 90000,
        status: 'SUCCESS',
      };
      const rawBody = JSON.stringify(payload);
      const signature = createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET as string).update(rawBody).digest('hex');

      const req = new NextRequest('http://localhost/api/payment/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-signature': signature,
        },
        body: rawBody,
      });

      const res = await webhookRoute(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toEqual({ error: 'Amount mismatch' });
      expect(handlePaymentWebhook).not.toHaveBeenCalled();
    });
  });
});
