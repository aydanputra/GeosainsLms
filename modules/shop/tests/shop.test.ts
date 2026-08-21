import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProduct, createOrder } from '../api/service';
import { prisma } from '@/utils/prisma';

// Mock dependencies
vi.mock('@/utils/prisma', () => ({
  prisma: {
    product: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
    },
    page: {
      findUnique: vi.fn(),
    },
    affiliateProfile: {
      findUnique: vi.fn(),
    },
    referral: {
      findUnique: vi.fn(),
    },
    coupon: {
      findUnique: vi.fn(),
    },
    couponRedemption: {
      count: vi.fn(),
      create: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('Shop Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.page.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.affiliateProfile.findUnique as any).mockResolvedValue(null);
    (prisma.referral.findUnique as any).mockResolvedValue(null);
    (prisma.coupon.findUnique as any).mockResolvedValue(null);
    (prisma.couponRedemption.count as any).mockResolvedValue(0);
    (prisma.$transaction as any).mockImplementation(async (callback: any) =>
      callback({
        order: {
          create: vi.fn().mockResolvedValue({
            id: 'o1',
            total: 100,
            status: 'PENDING',
            items: [],
          }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: 'user-1', name: 'User Test', email: 'user@test.com' }),
        },
        notification: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        courseCoInstructor: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        shopVendor: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      })
    );
  });

  describe('createProduct', () => {
    it('should create a product successfully', async () => {
      const mockProduct = {
        name: 'Test Product',
        price: 100,
        stock: 10,
      };
      (prisma.product.create as any).mockResolvedValue({ id: '1', ...mockProduct });

      const result = await createProduct(mockProduct);

      expect(prisma.product.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id', '1');
    });
  });

  describe('createOrder', () => {
    it('should create an order with valid items', async () => {
      const mockProduct = { id: 'p1', name: 'Product 1', price: 50, stock: 10, type: 'PHYSICAL', vendorId: null, categoryId: null, categoryIds: [] };
      (prisma.product.findUnique as any).mockResolvedValue(mockProduct);

      const result = await createOrder('user-1', {
        items: [{ productId: 'p1', quantity: 2 }],
        shipping: {
          recipientName: 'User Test',
          phone: '08123456789',
          addressLine1: 'Jl. Geo No. 1',
          city: 'Bandung',
        },
      });

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
        select: { id: true, name: true, price: true, stock: true, type: true, vendorId: true, categoryId: true, categoryIds: true },
      });
      expect(result).toHaveProperty('id', 'o1');
    });

    it('should throw error if product stock is insufficient', async () => {
      const mockProduct = { id: 'p1', name: 'Product 1', price: 50, stock: 1, type: 'PHYSICAL', vendorId: null, categoryId: null, categoryIds: [] };
      (prisma.product.findUnique as any).mockResolvedValue(mockProduct);

      await expect(createOrder('user-1', { items: [{ productId: 'p1', quantity: 2 }] })).rejects.toThrow('Insufficient stock');
    });
  });
});
