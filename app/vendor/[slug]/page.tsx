import VendorShopPage from '@/modules/shop/pages/VendorShopPage';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <VendorShopPage slug={slug} />;
}

