import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getProductsRoute } from '@/app/api/shop/products/route';
import { GET as getProductDetailRoute } from '@/app/api/shop/products/[id]/route';
import { GET as getPublicVendorRoute } from '@/app/api/shop/vendors/public/[slug]/route';
import { prisma } from '@/utils/prisma';
import { getProductById } from '../api/service';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    shopVendor: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../api/service', () => ({
  getProductById: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  ProductSchema: { partial: vi.fn() },
}));

describe('Public Shop Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch product list with safe vendor fields only', async () => {
    (prisma.product.findMany as any).mockResolvedValue([]);
    (prisma.product.count as any).mockResolvedValue(0);

    const req = new NextRequest('http://localhost/api/shop/products?paginated=1&take=12&skip=0');
    const res = await getProductsRoute(req);

    expect(res.status).toBe(200);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          categoryRef: true,
          vendor: {
            select: {
              id: true,
              name: true,
              slug: true,
              contactPhone: true,
              status: true,
            },
          },
        },
      })
    );
  });

  it('should fetch public vendor detail without selecting adminWhatsapp', async () => {
    (prisma.shopVendor.findUnique as any).mockResolvedValue({
      id: 'vendor-1',
      name: 'Vendor',
      slug: 'vendor',
      status: 'APPROVED',
      products: [],
    });

    const req = new NextRequest('http://localhost/api/shop/vendors/public/vendor');
    const res = await getPublicVendorRoute(req, { params: Promise.resolve({ slug: 'vendor' }) });

    expect(res.status).toBe(200);
    expect(prisma.shopVendor.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          adminWhatsapp: true,
        }),
      })
    );
  });

  it('should strip adminWhatsapp from product detail API response', async () => {
    (getProductById as any).mockResolvedValue({
      id: 'product-1',
      name: 'Produk',
      vendor: {
        id: 'vendor-1',
        name: 'Vendor',
        slug: 'vendor',
        description: 'desc',
        status: 'APPROVED',
        contactEmail: 'vendor@example.com',
        contactPhone: '08123',
        adminWhatsapp: '08999',
        city: 'Bandung',
        province: 'Jawa Barat',
        country: 'Indonesia',
      },
    });

    const req = new NextRequest('http://localhost/api/shop/products/product-1');
    const res = await getProductDetailRoute(req, { params: Promise.resolve({ id: 'product-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.vendor).toEqual({
      id: 'vendor-1',
      name: 'Vendor',
      slug: 'vendor',
      description: 'desc',
      status: 'APPROVED',
      contactEmail: 'vendor@example.com',
      contactPhone: '08123',
      city: 'Bandung',
      province: 'Jawa Barat',
      country: 'Indonesia',
    });
    expect(data.vendor).not.toHaveProperty('adminWhatsapp');
  });
});
