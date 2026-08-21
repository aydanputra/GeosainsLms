"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, RefObject } from 'react';

type TestimonialsButton = {
  text?: string;
  href?: string;
  variant?: 'PRIMARY' | 'SECONDARY' | 'OUTLINE';
  bgColor?: string;
  textColor?: string;
  borderColor?: string;
};

type TestimonialsItem = {
  title?: string;
  text?: string;
  authorName?: string;
  authorRole?: string;
  avatarUrl?: string;
};

type TestimonialsContent = {
  badgeText?: string;
  heading?: string;
  subheading?: string;
  buttons?: TestimonialsButton[];
  testimonials?: TestimonialsItem[];
  backgroundFrom?: string;
  backgroundTo?: string;
  scrollSpeedPxPerSec?: number;
  heightPx?: number;
  motionMode?: 'BOUNCE' | 'LOOP';
};

function isHexColor(value: unknown) {
  return typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function useSyncedColumnsMotion({
  leftViewportRef,
  leftMeasureRef,
  leftAnimatedRef,
  rightViewportRef,
  rightMeasureRef,
  rightAnimatedRef,
  speedPxPerSec,
  mode,
}: {
  leftViewportRef: RefObject<HTMLElement | null>;
  leftMeasureRef: RefObject<HTMLElement | null>;
  leftAnimatedRef: RefObject<HTMLElement | null>;
  rightViewportRef: RefObject<HTMLElement | null>;
  rightMeasureRef: RefObject<HTMLElement | null>;
  rightAnimatedRef: RefObject<HTMLElement | null>;
  speedPxPerSec: number;
  mode: 'BOUNCE' | 'LOOP';
}) {
  useEffect(() => {
    const leftVp = leftViewportRef.current;
    const leftMs = leftMeasureRef.current;
    const leftAnim = leftAnimatedRef.current;
    const rightVp = rightViewportRef.current;
    const rightMs = rightMeasureRef.current;
    const rightAnim = rightAnimatedRef.current;
    if (!leftVp || !leftMs || !leftAnim || !rightVp || !rightMs || !rightAnim) return;
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion) return;

    let raf = 0;
    let last = performance.now();
    let dir: 1 | -1 = 1;
    let progress = 0;

    let leftMaxOffset = 0;
    let rightMaxOffset = 0;
    let leftLoopLength = 0;
    let rightLoopLength = 0;
    let virtualLength = 0;

    const recompute = () => {
      const lv = leftViewportRef.current;
      const lm = leftMeasureRef.current;
      const rv = rightViewportRef.current;
      const rm = rightMeasureRef.current;
      if (!lv || !lm || !rv || !rm) return;

      const lvH = lv.getBoundingClientRect().height;
      const lmH = lm.getBoundingClientRect().height;
      const rvH = rv.getBoundingClientRect().height;
      const rmH = rm.getBoundingClientRect().height;

      leftLoopLength = Math.max(0, lmH);
      rightLoopLength = Math.max(0, rmH);
      leftMaxOffset = Math.max(0, lmH - lvH);
      rightMaxOffset = Math.max(0, rmH - rvH);

      if (mode === 'LOOP') {
        virtualLength = Math.max(leftLoopLength, rightLoopLength);
        if (virtualLength > 0) progress = ((progress % 1) + 1) % 1;
      } else {
        virtualLength = Math.max(leftMaxOffset, rightMaxOffset);
        progress = Math.max(0, Math.min(1, progress));
      }
    };

    recompute();

    const ro = new ResizeObserver(() => recompute());
    ro.observe(leftVp);
    ro.observe(leftMs);
    ro.observe(rightVp);
    ro.observe(rightMs);

    const step = (now: number) => {
      const la = leftAnimatedRef.current;
      const ra = rightAnimatedRef.current;
      if (!la || !ra) return;

      const dt = Math.min(50, now - last) / 1000;
      last = now;

      if (virtualLength <= 0) {
        raf = requestAnimationFrame(step);
        return;
      }

      const deltaProgress = (speedPxPerSec / virtualLength) * dt;

      if (mode === 'LOOP') {
        progress = (progress + deltaProgress) % 1;
      } else {
        progress += dir * deltaProgress;
        if (progress <= 0) {
          progress = 0;
          dir = 1;
        } else if (progress >= 1) {
          progress = 1;
          dir = -1;
        }
      }

      const leftTravel = mode === 'LOOP' ? leftLoopLength : leftMaxOffset;
      const rightTravel = mode === 'LOOP' ? rightLoopLength : rightMaxOffset;
      const leftOffset = progress * leftTravel;
      const rightOffset = (1 - progress) * rightTravel;

      la.style.transform = `translate3d(0, ${-leftOffset}px, 0)`;
      ra.style.transform = `translate3d(0, ${-rightOffset}px, 0)`;
      la.style.willChange = 'transform';
      ra.style.willChange = 'transform';
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [leftViewportRef, leftMeasureRef, leftAnimatedRef, rightViewportRef, rightMeasureRef, rightAnimatedRef, speedPxPerSec, mode]);
}

function ColumnMotion({
  items,
  heightPx,
  offsetTopPx,
  viewportRef,
  measureRef,
  animatedRef,
  loopDuplicate,
}: {
  items: TestimonialsItem[];
  heightPx: number;
  offsetTopPx?: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  measureRef: RefObject<HTMLDivElement | null>;
  animatedRef: RefObject<HTMLDivElement | null>;
  loopDuplicate: boolean;
}) {
  const avatarSizes = '40px';

  return (
    <div className="relative overflow-hidden" style={{ height: `${heightPx}px` }}>
      <div ref={viewportRef} className="h-full overflow-hidden">
        <div ref={animatedRef}>
          <div ref={measureRef}>
            {offsetTopPx ? <div style={{ height: `${offsetTopPx}px` }} /> : null}
            <div className="space-y-6">
              {items.map((t, idx) => (
                <div
                  key={`${t.title || 't'}-${idx}`}
                  className="bg-white text-slate-900 rounded-2xl p-6 shadow-sm"
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '180px' }}
                >
                  {t.title ? <div className="text-lg font-[700] leading-[27px]">{t.title}</div> : null}
                  {t.text ? <div className="mt-2 text-sm text-slate-600 leading-relaxed">{t.text}</div> : null}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden relative shrink-0">
                      {t.avatarUrl ? (
                        <Image src={t.avatarUrl} alt={t.authorName || 'User'} fill sizes={avatarSizes} className="object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 truncate">{t.authorName || 'Anonim'}</div>
                      <div className="text-xs text-slate-500 truncate">{t.authorRole || ''}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-6" />
          </div>

          {loopDuplicate ? (
            <div aria-hidden>
              {offsetTopPx ? <div style={{ height: `${offsetTopPx}px` }} /> : null}
              <div className="space-y-6">
                {items.map((t, idx) => (
                  <div
                    key={`dup-${t.title || 't'}-${idx}`}
                    className="bg-white text-slate-900 rounded-2xl p-6 shadow-sm"
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '180px' }}
                  >
                    {t.title ? <div className="text-lg font-[700] leading-[27px]">{t.title}</div> : null}
                    {t.text ? <div className="mt-2 text-sm text-slate-600 leading-relaxed">{t.text}</div> : null}
                    <div className="mt-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden relative shrink-0">
                        {t.avatarUrl ? (
                          <Image src={t.avatarUrl} alt={t.authorName || 'User'} fill sizes={avatarSizes} className="object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 truncate">{t.authorName || 'Anonim'}</div>
                        <div className="text-xs text-slate-500 truncate">{t.authorRole || ''}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-6" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function TestimonialsBlock({ content }: { content: TestimonialsContent }) {
  const rawBadgeText = typeof content?.badgeText === 'string' ? content.badgeText.trim() : '';
  const rawHeading = typeof content?.heading === 'string' ? content.heading.trim() : '';
  const badgeText = !rawBadgeText || rawBadgeText === 'Trusted By 900K+ Students' ? 'Dipercaya Banyak Peserta' : rawBadgeText;
  const heading = !rawHeading || rawHeading === 'Join Our Supportive Community 😊' || rawHeading === 'Join Our Supportive Community'
    ? 'Komunitas Belajar GeoSains'
    : rawHeading;
  const subheading = typeof content?.subheading === 'string' ? content.subheading : '';

  const buttons = Array.isArray(content?.buttons) ? content.buttons : [];
  const leftColumn = useMemo(() => {
    const list = Array.isArray(content?.testimonials) ? content.testimonials : [];
    return list.filter((_, idx) => idx % 2 === 0);
  }, [content]);
  const rightColumn = useMemo(() => {
    const list = Array.isArray(content?.testimonials) ? content.testimonials : [];
    return list.filter((_, idx) => idx % 2 === 1);
  }, [content]);

  const speed = typeof content?.scrollSpeedPxPerSec === 'number' && Number.isFinite(content.scrollSpeedPxPerSec) ? content.scrollSpeedPxPerSec : 18;

  const heightPx = typeof content?.heightPx === 'number' && Number.isFinite(content.heightPx) ? content.heightPx : 560;
  const motionMode: 'BOUNCE' | 'LOOP' = content?.motionMode === 'LOOP' ? 'LOOP' : 'BOUNCE';
  const loopDuplicate = motionMode === 'LOOP';

  const leftViewportRef = useRef<HTMLDivElement | null>(null);
  const leftMeasureRef = useRef<HTMLDivElement | null>(null);
  const leftAnimatedRef = useRef<HTMLDivElement | null>(null);
  const rightViewportRef = useRef<HTMLDivElement | null>(null);
  const rightMeasureRef = useRef<HTMLDivElement | null>(null);
  const rightAnimatedRef = useRef<HTMLDivElement | null>(null);

  useSyncedColumnsMotion({
    leftViewportRef,
    leftMeasureRef,
    leftAnimatedRef,
    rightViewportRef,
    rightMeasureRef,
    rightAnimatedRef,
    speedPxPerSec: speed,
    mode: motionMode,
  });

  const backgroundFrom = isHexColor(content?.backgroundFrom) ? String(content.backgroundFrom) : '#070A1B';
  const backgroundTo = isHexColor(content?.backgroundTo) ? String(content.backgroundTo) : '#0B1B3A';

  const sectionStyle = useMemo(() => ({ backgroundImage: `linear-gradient(90deg, ${backgroundFrom}, ${backgroundTo})` }), [backgroundFrom, backgroundTo]);

  return (
    <section className="w-full text-white overflow-hidden" style={sectionStyle}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="text-brand-gradient font-extrabold text-sm">{badgeText}</div>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-[700] leading-[1.15] tracking-tight">
              {heading}
            </h2>
            {subheading ? <p className="mt-4 text-slate-200/90 text-sm sm:text-base leading-relaxed max-w-md">{subheading}</p> : null}

            {buttons.length > 0 ? (
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                {buttons.map((b, idx) => {
                  const text = typeof b?.text === 'string' ? b.text : '';
                  const href = typeof b?.href === 'string' ? b.href : '';
                  const variant = b?.variant === 'SECONDARY' || b?.variant === 'OUTLINE' || b?.variant === 'PRIMARY' ? b.variant : 'PRIMARY';
                  const bgColor = isHexColor(b?.bgColor) ? String(b.bgColor) : '';
                  const textColor = isHexColor(b?.textColor) ? String(b.textColor) : '';
                  const borderColor = isHexColor(b?.borderColor) ? String(b.borderColor) : '';

                  const style = {
                    ...(bgColor ? { background: bgColor } : {}),
                    ...(textColor ? { color: textColor } : {}),
                    ...(borderColor ? { borderColor } : {}),
                  } as CSSProperties;

                  const base = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-sm transition-opacity';
                  const className =
                    variant === 'PRIMARY'
                      ? `${base} bg-brand-gradient text-white hover:opacity-90`
                      : variant === 'SECONDARY'
                        ? `${base} bg-white text-slate-900 hover:opacity-90`
                        : `${base} bg-white/10 text-white border border-white/15 hover:opacity-90`;

                  if (!text || !href) return null;
                  return (
                    <Link key={`${href}-${idx}`} href={href} className={className} style={style}>
                      {text}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ColumnMotion
                items={leftColumn}
                heightPx={heightPx}
                viewportRef={leftViewportRef}
                measureRef={leftMeasureRef}
                animatedRef={leftAnimatedRef}
                loopDuplicate={loopDuplicate}
              />
              <ColumnMotion
                items={rightColumn}
                heightPx={heightPx}
                offsetTopPx={40}
                viewportRef={rightViewportRef}
                measureRef={rightMeasureRef}
                animatedRef={rightAnimatedRef}
                loopDuplicate={loopDuplicate}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
