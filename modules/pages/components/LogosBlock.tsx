"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

type LogoItem = {
  name?: string;
  imageUrl?: string;
  href?: string;
};

type LogosContent = {
  heading?: string;
  subheading?: string;
  layout?: 'GRID' | 'MARQUEE';
  grayscale?: boolean;
  logoHeightPx?: number;
  durationSec?: number;
  items?: LogoItem[];
};

function useSmoothMarquee({
  viewportRef,
  trackRef,
  measureRef,
  durationSec,
}: {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  measureRef: React.RefObject<HTMLDivElement | null>;
  durationSec: number;
}) {
  const pausedRef = useRef(false);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    const trackEl = trackRef.current;
    const measureEl = measureRef.current;
    if (!viewportEl || !trackEl || !measureEl) return;
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion) return;

    let raf = 0;
    let last = performance.now();
    let offset = 0;
    let loopWidth = 0;
    let speedPxPerSec = 0;

    const recompute = () => {
      const ms = measureRef.current;
      if (!ms) return;
      loopWidth = Math.max(0, ms.getBoundingClientRect().width);
      speedPxPerSec = loopWidth > 0 ? loopWidth / Math.max(8, durationSec) : 0;
      if (loopWidth > 0) offset = ((offset % loopWidth) + loopWidth) % loopWidth;
    };

    const onEnter = () => {
      pausedRef.current = true;
    };
    const onLeave = () => {
      pausedRef.current = false;
    };

    viewportEl.addEventListener('pointerenter', onEnter);
    viewportEl.addEventListener('pointerleave', onLeave);

    const ro = new ResizeObserver(() => recompute());
    ro.observe(viewportEl);
    ro.observe(measureEl);
    recompute();

    const step = (now: number) => {
      const tr = trackRef.current;
      if (!tr) return;

      const dt = Math.min(50, now - last) / 1000;
      last = now;

      if (!pausedRef.current && loopWidth > 0 && speedPxPerSec > 0) {
        offset = (offset + speedPxPerSec * dt) % loopWidth;
        tr.style.transform = `translate3d(${-offset}px, 0, 0)`;
        tr.style.willChange = 'transform';
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      viewportEl.removeEventListener('pointerenter', onEnter);
      viewportEl.removeEventListener('pointerleave', onLeave);
    };
  }, [viewportRef, trackRef, measureRef, durationSec]);
}

export default function LogosBlock({ content }: { content: LogosContent }) {
  const heading = typeof content?.heading === 'string' ? content.heading : 'Dipercaya oleh';
  const subheading = typeof content?.subheading === 'string' ? content.subheading : '';
  const layout: 'GRID' | 'MARQUEE' = content?.layout === 'MARQUEE' ? 'MARQUEE' : 'GRID';
  const grayscale = Boolean(content?.grayscale);
  const logoHeightPx = typeof content?.logoHeightPx === 'number' && Number.isFinite(content.logoHeightPx) ? content.logoHeightPx : 36;
  const durationSec = typeof content?.durationSec === 'number' && Number.isFinite(content.durationSec) ? content.durationSec : 22;
  const items = useMemo(() => (Array.isArray(content?.items) ? content.items : []).filter((it) => it?.name || it?.imageUrl), [content]);
  const marqueeViewportRef = useRef<HTMLDivElement | null>(null);
  const marqueeTrackRef = useRef<HTMLDivElement | null>(null);
  const marqueeMeasureRef = useRef<HTMLDivElement | null>(null);
  const [brokenMap, setBrokenMap] = useState<Record<string, true>>({});

  useSmoothMarquee({
    viewportRef: marqueeViewportRef,
    trackRef: marqueeTrackRef,
    measureRef: marqueeMeasureRef,
    durationSec,
  });

  const logoClassName = `shrink-0 flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 min-w-[160px] ${
    grayscale ? 'grayscale opacity-80 hover:opacity-100 transition-opacity' : ''
  }`;

  const renderLogo = (it: LogoItem, key: string) => {
    const name = typeof it.name === 'string' ? it.name : '';
    const href = typeof it.href === 'string' ? it.href : '';
    const imageUrl = typeof it.imageUrl === 'string' ? it.imageUrl : '';
    const displayName = name || 'Logo';
    const isBroken = Boolean(brokenMap[key]);

    const node = (
      <div className={logoClassName} style={{ height: `${logoHeightPx + 24}px` }}>
        <div className="relative w-full" style={{ height: `${logoHeightPx}px` }}>
          {imageUrl && !isBroken ? (
            <Image
              src={imageUrl}
              alt={displayName}
              fill
              unoptimized
              className="object-contain"
              onError={() => setBrokenMap((prev) => ({ ...prev, [key]: true }))}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-sm font-extrabold text-slate-700 truncate px-2">
              {displayName}
            </div>
          )}
        </div>
      </div>
    );

    if (href) {
      return (
        <Link key={key} href={href} className="block">
          {node}
        </Link>
      );
    }

    return <div key={key}>{node}</div>;
  };

  return (
    <section className="w-full bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-[700] leading-[36px] text-slate-900">{heading}</h2>
          {subheading ? <div className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">{subheading}</div> : null}
        </div>

        <div className="mt-8">
          {items.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
              Belum ada logo yang ditambahkan.
            </div>
          ) : layout === 'MARQUEE' ? (
            <div ref={marqueeViewportRef} className="relative overflow-hidden py-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
              <div ref={marqueeTrackRef} className="flex items-center">
                <div ref={marqueeMeasureRef} className="flex items-center gap-4 pr-4">
                  {items.map((it, idx) => renderLogo(it, `a-${idx}`))}
                </div>
                <div className="flex items-center gap-4 pr-4" aria-hidden>
                  {items.map((it, idx) => renderLogo(it, `b-${idx}`))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {items.map((it, idx) => renderLogo(it, `g-${idx}`))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
