import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import VendorShopPage from '@/modules/shop/pages/VendorShopPage';
import { prisma } from '@/utils/prisma';
import { getPublicVendorSlugs } from '@/modules/public/api/performance';

export const revalidate = 300;

export async function generateStaticParams() {
  return getPublicVendorSlugs();
}

const getVendorPageData = unstable_cache(
  async (slug: string) => {
    const prismaAny = prisma as any;

    const [vendor, categories] = await Promise.all([
      prismaAny.shopVendor.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logoUrl: true,
          coverUrl: true,
          status: true,
          contactEmail: true,
          contactPhone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          province: true,
          postalCode: true,
          country: true,
          ratingAvg: true,
          ratingCount: true,
          products: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              price: true,
              stock: true,
              type: true,
              imageUrl: true,
              imageUrls: true,
              categoryId: true,
              createdAt: true,
              categoryRef: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.productCategoryModel.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!vendor) {
      return {
        vendor: null,
        categories,
      };
    }

    return {
      vendor: {
        ...vendor,
        logoUrl:
          typeof vendor.logoUrl === 'string' && vendor.logoUrl.startsWith('blob:') ? null : vendor.logoUrl,
        coverUrl:
          typeof vendor.coverUrl === 'string' && vendor.coverUrl.startsWith('blob:') ? null : vendor.coverUrl,
        products:
          vendor.status === 'APPROVED'
            ? vendor.products
            : [],
      },
      categories,
    };
  },
  ['public-vendor-page-data'],
  { revalidate: 300 }
);

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { vendor, categories } = await getVendorPageData(slug);

  if (!vendor) {
    notFound();
  }

  return <VendorShopPage slug={slug} initialVendor={vendor} initialCategories={categories} />;
}
