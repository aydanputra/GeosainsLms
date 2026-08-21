import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as mentorOrderRoute } from '@/app/api/dashboard/mentor/orders/[orderId]/route';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    course: {
      findMany: vi.fn(),
    },
    courseCoInstructor: {
      findMany: vi.fn(),
    },
    shopVendor: {
      findMany: vi.fn(),
    },
    page: {
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

describe('Mentor Order Detail Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should scope mentor response to allowed items without exposing order-level payment proof', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'mentor-1', role: 'MENTOR' });
    (prisma.course.findMany as any).mockResolvedValue([{ id: 'course-1' }]);
    (prisma.courseCoInstructor.findMany as any).mockResolvedValue([]);
    (prisma.shopVendor.findMany as any).mockResolvedValue([]);
    (prisma.page.findUnique as any).mockResolvedValue({ content: JSON.stringify({ enableRevenueSharing: true, instructorRevenueSharePercent: 90, adminRevenueSharePercent: 10 }) });
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-1',
      status: 'PAID',
      createdAt: new Date('2026-08-08T10:00:00.000Z'),
      total: 250000,
      shippingRecipientName: 'Buyer',
      shippingPhone: '08123',
      shippingAddressLine1: 'Jl. Test 1',
      shippingAddressLine2: null,
      shippingCity: 'Bandung',
      shippingProvince: 'Jawa Barat',
      shippingPostalCode: '40111',
      shippingCountry: 'Indonesia',
      shippingCourier: 'JNE',
      shippingTrackingNumber: 'RESI123',
      shippedAt: null,
      user: { id: 'user-1', name: 'Buyer', email: 'buyer@example.com' },
      commission: { amount: 25000, status: 'APPROVED' },
      items: [
        {
          id: 'item-allowed',
          productId: null,
          courseId: 'course-1',
          quantity: 1,
          price: 100000,
          discountAmount: 0,
          discountStoreAmount: 0,
          discountMarketplaceAmount: 0,
          refundAmount: 0,
          product: null,
          course: { id: 'course-1', title: 'Kursus Saya' },
        },
        {
          id: 'item-other',
          productId: null,
          courseId: 'course-2',
          quantity: 1,
          price: 150000,
          discountAmount: 0,
          discountStoreAmount: 0,
          discountMarketplaceAmount: 0,
          refundAmount: 0,
          product: null,
          course: { id: 'course-2', title: 'Kursus Lain' },
        },
      ],
    });

    const req = new NextRequest('http://localhost/api/dashboard/mentor/orders/order-1', {
      headers: { cookie: 'token=abc' },
    });

    const res = await mentorOrderRoute(req, { params: Promise.resolve({ orderId: 'order-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('item-allowed');
    expect(data.pricing.order.total).toBe(100000);
    expect(data.pricing.order.subtotal).toBe(100000);
    expect(data.pricing.earnings.affiliateFee).toBe(10000);
    expect(data.shippingRecipientName).toBeNull();
    expect(data.shippingAddressLine1).toBeNull();
    expect(data.shippingTrackingNumber).toBeNull();
    expect(data).not.toHaveProperty('manualPaymentProofUrl');
    expect(data).not.toHaveProperty('payment');
    expect(data).not.toHaveProperty('total');
  });
});
