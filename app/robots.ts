import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/modules/core/utils/appUrl';

export default function robots(): MetadataRoute.Robots {
  const appUrl = getAppUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/login', '/register'],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
