export const revalidate = 300;

import GeoservicesPage from '@/modules/geoservices/pages/GeoservicesPage';
import { getPublicGeoservicesVendors } from '@/modules/public/api/performance';

export default async function Page() {
  const vendors = await getPublicGeoservicesVendors();

  return <GeoservicesPage initialVendors={vendors} />;
}
