'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCartStore } from '@/modules/shop/store/useCartStore';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const pathname = usePathname();
  const lastTrackedRef = useRef<string>('');

  useEffect(() => {
    Promise.resolve(useCartStore.persist.rehydrate()).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const ref = (url.searchParams.get('ref') || '').trim().toUpperCase().replace(/\s+/g, '');
      const linkId = (url.searchParams.get('al') || '').trim();
      if (!ref) return;
      if (ref.length > 32) return;

      const key = `affiliate_tracked_${ref}`;
      if (window.sessionStorage.getItem(key) === '1') return;
      window.sessionStorage.setItem(key, '1');

      fetch('/api/affiliate/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: ref, linkId, landingPath: url.pathname }),
      }).catch(() => {});

      url.searchParams.delete('ref');
      url.searchParams.delete('al');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (!pathname) return;
      if (
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/register') ||
        pathname.startsWith('/_next')
      ) {
        return;
      }

      const query = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
      const key = `${pathname}?${query}`;
      const now = Date.now();

      if (lastTrackedRef.current === key) return;
      lastTrackedRef.current = key;

      const dedupeKey = `pv_dedupe_${pathname}`;
      const dedupeRaw = window.sessionStorage.getItem(dedupeKey);
      if (dedupeRaw) {
        const lastAt = Number(dedupeRaw) || 0;
        if (now - lastAt < 800) return;
      }
      window.sessionStorage.setItem(dedupeKey, String(now));

      const url = new URL(window.location.href);
      const utmSource = (url.searchParams.get('utm_source') || '').trim();
      const utmMedium = (url.searchParams.get('utm_medium') || '').trim();
      const utmCampaign = (url.searchParams.get('utm_campaign') || '').trim();

      fetch('/api/analytics/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          path: pathname,
          referrer: document.referrer || '',
          utmSource,
          utmMedium,
          utmCampaign,
        }),
      }).catch(() => {});
    } catch {}
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
