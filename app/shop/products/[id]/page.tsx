import { prisma } from '@/utils/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AddToCartButton from '@/modules/shop/components/AddToCartButton';
import ProductInfoTabs from '@/modules/shop/components/ProductInfoTabs';
import ProductImageGallery from '@/modules/shop/components/ProductImageGallery';
import { BadgeCheck, Store, Tag } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getAppUrl } from '@/modules/core/utils/appUrl';

export const dynamic = 'force-dynamic';

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizePublicUrl(appUrl: string, value: string | null | undefined) {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith('blob:')) return null;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('/')) return `${appUrl}${v}`;
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: idOrSlug } = await params;
  const hdrs = await headers();
  const appUrl = getAppUrl(hdrs);

  try {
    const [product, siteSettingsPage] = await Promise.all([
      prisma.product.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        select: { id: true, slug: true, name: true, description: true, imageUrl: true, imageUrls: true, updatedAt: true },
      }),
      prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true, updatedAt: true } }),
    ]);

    const canonicalId = product?.slug || product?.id || idOrSlug;
    const canonical = `${appUrl}/shop/products/${encodeURIComponent(canonicalId)}`;

    if (!product) {
      return { alternates: { canonical } };
    }

    const parsed = safeParse(siteSettingsPage?.content);
    const siteName = typeof parsed.siteName === 'string' && parsed.siteName.trim() ? parsed.siteName.trim() : 'GeoSains LMS';
    const fallbackDescription =
      typeof parsed.siteDescription === 'string' && parsed.siteDescription.trim() ? parsed.siteDescription.trim() : 'Belanja produk di Geoshop.';
    const description = typeof product.description === 'string' && product.description.trim() ? product.description.trim() : fallbackDescription;

    const imageCandidate =
      normalizePublicUrl(appUrl, product.imageUrl) ||
      normalizePublicUrl(appUrl, Array.isArray(product.imageUrls) && product.imageUrls.length > 0 ? product.imageUrls[0] : null) ||
      normalizePublicUrl(appUrl, typeof parsed.logoUrl === 'string' ? parsed.logoUrl : null) ||
      null;
    const images = imageCandidate ? [{ url: imageCandidate }] : [];

    const title = `${product.name} | ${siteName}`;
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: 'website',
        url: canonical,
        title,
        description,
        siteName,
        images,
      },
      twitter: {
        card: images.length > 0 ? 'summary_large_image' : 'summary',
        title,
        description,
        images: images.length > 0 ? images.map((i) => i.url) : undefined,
      },
    };
  } catch {
    return { alternates: { canonical: `${appUrl}/shop/products/${encodeURIComponent(idOrSlug)}` } };
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idOrSlug } = await params;

  const product = await prisma.product.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: { categoryRef: true, vendor: true },
  });

  if (!product) return notFound();

  const imageUrl =
    typeof product.imageUrl === 'string' && product.imageUrl.trim() && !product.imageUrl.startsWith('blob:') ? product.imageUrl : null;
  const categoryName =
    product.categoryRef?.name || (product.category === 'BOOKS' ? 'Buku' : product.category === 'MERCH' ? 'Merchandise' : 'Lainnya');
  const vendorName = product.vendor?.name || '';
  const vendorSlug = product.vendor?.slug || '';
  const vendorLocation = [product.vendor?.city, product.vendor?.province, product.vendor?.country].filter(Boolean).join(', ');
  const productType = (product as any)?.type === 'SERVICE' || (product as any)?.type === 'RENTAL' ? (product as any).type : 'PHYSICAL';
  const isInStock = productType === 'SERVICE' ? true : Number(product.stock || 0) > 0;

  const moreWhere: any = { id: { not: product.id } };
  if (product.vendorId) moreWhere.vendorId = product.vendorId;
  else if (product.categoryId) moreWhere.categoryId = product.categoryId;
  else moreWhere.category = product.category;

  const moreProducts = await prisma.product.findMany({
    where: moreWhere,
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { id: true, slug: true, name: true, description: true, price: true, imageUrl: true },
  });
  const moreProductsNormalized = moreProducts.map((p) => ({
    ...p,
    imageUrl: typeof p.imageUrl === 'string' && p.imageUrl.startsWith('blob:') ? null : p.imageUrl,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm font-semibold text-slate-500">
            <Link href="/" className="hover:text-slate-700">
              Home
            </Link>{' '}
            <span className="text-slate-300">/</span>{' '}
            <Link href="/shop" className="hover:text-slate-700">
              Geoshop
            </Link>{' '}
            <span className="text-slate-300">/</span> <span className="text-slate-700">{product.name}</span>
          </div>
          <Link href="/shop" className="text-sm font-bold text-slate-700 hover:text-slate-900">
            ← Kembali ke Toko
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <ProductImageGallery name={product.name} imageUrl={imageUrl} imageUrls={product.imageUrls || null} />

          <div className="bg-white rounded-2xl border border-slate-200 p-6 h-full flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                <Tag className="w-4 h-4 text-indigo-700" />
                {categoryName}
              </span>
            </div>

            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{product.name}</h1>

            <div className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600 font-semibold">
                <Store className="w-4 h-4 text-blue-700" />
                {vendorName ? (
                  <Link href={`/vendor/${encodeURIComponent(vendorSlug)}`} className="text-blue-700 hover:text-blue-800 font-extrabold">
                    {vendorName}
                  </Link>
                ) : (
                  <span>-</span>
                )}
                {product.vendor?.status === 'APPROVED' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Terverifikasi
                  </span>
                ) : null}
              </div>
              {vendorLocation ? <div className="text-xs text-slate-500 font-semibold">{vendorLocation}</div> : null}
            </div>

            <div className="mt-5 text-3xl font-extrabold text-indigo-700">IDR {Number(product.price).toLocaleString('id-ID')}</div>

            {product.description ? (
              <div className="mt-4 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{product.description}</div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">Deskripsi belum tersedia.</div>
            )}

            <div className="mt-auto pt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {isInStock ? (
                <AddToCartButton product={{ id: product.id, name: product.name, price: product.price, imageUrl: imageUrl, type: productType }} />
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full sm:w-auto bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold"
                >
                  Stok Habis
                </button>
              )}
              <Link
                href="/cart"
                className="w-full sm:w-auto text-center px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50"
              >
                Lihat Keranjang
              </Link>
            </div>
          </div>
        </div>

        <ProductInfoTabs
          categoryName={categoryName}
          productName={product.name}
          productDescription={product.description || null}
          vendor={
            product.vendor
              ? {
                  name: product.vendor.name,
                  slug: product.vendor.slug,
                  description: product.vendor.description,
                  city: product.vendor.city,
                  province: product.vendor.province,
                  country: product.vendor.country,
                  contactEmail: product.vendor.contactEmail,
                  contactPhone: product.vendor.contactPhone,
                }
              : null
          }
          moreProducts={moreProductsNormalized}
        />
      </div>
    </div>
  );
}
