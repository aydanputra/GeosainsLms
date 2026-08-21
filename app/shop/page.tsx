import ShopPage from '@/modules/shop/pages/ShopPage';
import { getPublicShopCategories, getPublicShopProductsPage } from '@/modules/public/api/performance';

export const revalidate = 300;

export default async function Page() {
  const [initialProductsPage, initialCategories] = await Promise.all([
    getPublicShopProductsPage({ take: 12, skip: 0, sort: 'NEWEST' }),
    getPublicShopCategories(),
  ]);

  return <ShopPage initialProductsPage={initialProductsPage} initialCategories={initialCategories} />;
}
