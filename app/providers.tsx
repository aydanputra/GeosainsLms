'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedRef = useRef<string>('');
  const [routeLoading, setRouteLoading] = useState(false);
  const routeLoadingStartedAtRef = useRef<number | null>(null);
  const routeLoadingTimeoutRef = useRef<any>(null);
  const ROUTE_LOADER_MIN_MS = 3000;
  const ROUTE_LOADER_MAX_MS = 15000;

  const startRouteLoading = () => {
    if (routeLoadingTimeoutRef.current) clearTimeout(routeLoadingTimeoutRef.current);
    routeLoadingStartedAtRef.current = Date.now();
    setRouteLoading(true);
    routeLoadingTimeoutRef.current = setTimeout(() => {
      setRouteLoading(false);
      routeLoadingStartedAtRef.current = null;
      routeLoadingTimeoutRef.current = null;
    }, ROUTE_LOADER_MAX_MS);
  };

  const stopRouteLoading = () => {
    if (routeLoadingTimeoutRef.current) clearTimeout(routeLoadingTimeoutRef.current);
    routeLoadingTimeoutRef.current = null;
    const startedAt = routeLoadingStartedAtRef.current;
    if (!startedAt) {
      setRouteLoading(false);
      return;
    }
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, ROUTE_LOADER_MIN_MS - elapsed);
    routeLoadingTimeoutRef.current = setTimeout(() => {
      setRouteLoading(false);
      routeLoadingStartedAtRef.current = null;
      routeLoadingTimeoutRef.current = null;
    }, remaining);
  };

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
    const onClick = (e: MouseEvent) => {
      try {
        if (e.defaultPrevented) return;
        if (e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const target = e.target as Element | null;
        const anchor = target?.closest('a');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href) return;
        if (href.startsWith('#')) return;
        if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
        const a = anchor as HTMLAnchorElement;
        if (a.target && a.target !== '_self') return;
        if (a.hasAttribute('download')) return;
        const nextUrl = new URL(href, window.location.href);
        if (nextUrl.origin !== window.location.origin) return;
        if (nextUrl.pathname.startsWith('/api')) return;
        const current = window.location.pathname + window.location.search + window.location.hash;
        const next = nextUrl.pathname + nextUrl.search + nextUrl.hash;
        if (current === next) return;
        startRouteLoading();
      } catch {}
    };

    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      stopRouteLoading();
    }, 0);
    return () => clearTimeout(t);
  }, [pathname, searchParams]);

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

      const query = searchParams ? searchParams.toString() : '';
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
  }, [pathname, searchParams]);

  return (
    <QueryClientProvider client={queryClient}>
      {routeLoading ? (
        <div className="fixed inset-0 z-[9999] bg-white/70 backdrop-blur-sm">
          <div className="w-full h-full flex items-center justify-center p-6">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
              <div className="text-sm font-extrabold text-slate-700">Memuat...</div>
            </div>
          </div>
        </div>
      ) : null}
      {children}
    </QueryClientProvider>
  );
}
