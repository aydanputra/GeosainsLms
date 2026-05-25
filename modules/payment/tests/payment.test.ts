import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPayment, handlePaymentWebhook } from '../api/service';
import { prisma } from '@/utils/prisma';

const prismaMock: any = vi.hoisted(() => {
  const mock: any = {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
    },
    enrollment: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    course: {
      findMany: vi.fn(),
    },
    courseCoInstructor: {
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
  };
  mock.$transaction = vi.fn(async (fn: any) => fn(mock));
  return mock;
});

vi.mock('@/utils/prisma', () => ({ prisma: prismaMock }));

describe('Payment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MIDTRANS_SERVER_KEY = 'test_server_key';
    process.env.MIDTRANS_IS_PRODUCTION = 'false';
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ redirect_url: 'https://midtrans.test/redirect' }),
    }));
  });

  describe('createPayment', () => {
    it('should create payment successfully', async () => {
      const mockOrder = { id: 'o1', status: 'PENDING', total: 100, payment: null, user: { name: 'User', email: 'user@example.com' } };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);
      (prisma.payment.create as any).mockResolvedValue({
        id: 'pay1',
        orderId: 'o1',
        provider: 'MIDTRANS',
        externalId: 'o1',
        status: 'PENDING',
        paymentUrl: null,
      });
      (prisma.payment.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.payment.findUnique as any).mockResolvedValue({
        id: 'pay1',
        orderId: 'o1',
        provider: 'MIDTRANS',
        externalId: 'o1',
        status: 'PENDING',
        paymentUrl: 'https://midtrans.test/redirect',
      });

      // @ts-ignore
      const result = await createPayment({
        orderId: 'o1',
        amount: 100,
        provider: 'MIDTRANS',
      });

      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { paymentId: 'pay1' },
      });
      expect(result).toHaveProperty('id', 'pay1');
      expect(result).toHaveProperty('paymentUrl', 'https://midtrans.test/redirect');
    });

    it('should throw error if order already paid', async () => {
      const mockOrder = { id: 'o1', status: 'PAID', total: 100, payment: null, user: { name: 'User', email: 'user@example.com' } };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      // @ts-ignore
      await expect(createPayment({
        orderId: 'o1',
        amount: 100,
        provider: 'MIDTRANS',
      })).rejects.toThrow('Order already paid');
    });
  });

  describe('handlePaymentWebhook', () => {
    it('should update payment and order status on success', async () => {
      const mockPayment = {
        id: 'pay1',
        orderId: 'o1',
        status: 'PENDING',
        order: { userId: 'u1', total: 100, status: 'PENDING' },
      };
      (prisma.payment.findFirst as any).mockResolvedValue(mockPayment);
      (prisma.payment.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.order.findUnique as any).mockResolvedValue({
        id: 'o1',
        status: 'PENDING',
        userId: 'u1',
        items: [],
        user: { id: 'u1', name: 'User', email: 'user@example.com' },
      });
      (prisma.order.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.orderItem.findMany as any).mockResolvedValue([{ courseId: 'c1', productId: null, quantity: 1 }]);
      (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', name: 'User', email: 'user@example.com' });
      (prisma.course.findMany as any).mockResolvedValue([{ id: 'c1', title: 'Course 1', instructorId: 'm1' }]);
      (prisma.courseCoInstructor.findMany as any).mockResolvedValue([]);
      (prisma.user.findMany as any).mockResolvedValue([]);
      (prisma.payment.findUnique as any).mockResolvedValue({ id: 'pay1', status: 'SUCCESS' });

      // @ts-ignore
      await handlePaymentWebhook('txn_123', 'SUCCESS');

      expect(prisma.payment.updateMany).toHaveBeenCalled();
      expect(prisma.order.updateMany).toHaveBeenCalled();
      expect(prisma.enrollment.upsert).toHaveBeenCalled();
    });
  });
});
