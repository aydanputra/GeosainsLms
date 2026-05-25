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
    order: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('Shop Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      const mockProduct = { id: 'p1', name: 'Product 1', price: 50, stock: 10 };
      (prisma.product.findUnique as any).mockResolvedValue(mockProduct);
      (prisma.order.create as any).mockResolvedValue({ id: 'o1', total: 100, status: 'PENDING' });

      const result = await createOrder('user-1', { items: [{ productId: 'p1', quantity: 2 }] });

      expect(prisma.product.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          subtotal: 100,
          discountTotal: 0,
          total: 100,
        })
      }));
      expect(result).toHaveProperty('id', 'o1');
    });

    it('should throw error if product stock is insufficient', async () => {
      const mockProduct = { id: 'p1', name: 'Product 1', price: 50, stock: 1 };
      (prisma.product.findUnique as any).mockResolvedValue(mockProduct);

      await expect(createOrder('user-1', { items: [{ productId: 'p1', quantity: 2 }] })).rejects.toThrow('Insufficient stock');
    });
  });
});
