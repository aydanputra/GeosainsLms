"use client";

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

interface HeroBlockProps {
  content: {
    heading?: string;
    subheading?: string;
    imageUrl?: string;
    ctaText?: string;
    ctaLink?: string;
    primaryCta?: { text?: string; href?: string };
    secondaryCta?: { text?: string; href?: string };

    layout?: {
      widthMode?: 'FULL' | 'BOXED' | 'CUSTOM';
      customMaxWidthPx?: number;
      customPaddingXClass?: string;
      baseBackgroundMode?: 'DARK' | 'NONE' | 'CUSTOM';
      baseBackgroundColor?: string;
      minHeightPx?: number;
    };

    slider?: {
      enabled?: boolean;
      autoplayMs?: number;
      transitionMs?: number;
      showDots?: boolean;
      showArrows?: boolean;
    };
    slides?: Array<{
      heading?: string;
      subheading?: string;
      background?: {
        imageUrl?: string;
        overlayOpacity?: number;
        fit?: 'COVER' | 'CONTAIN';
        position?: 'CENTER' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
      };
      buttons?: Array<{
        text?: string;
        href?: string;
        variant?: 'PRIMARY' | 'SECONDARY' | 'OUTLINE';
        bgColor?: string;
        textColor?: string;
        borderColor?: string;
      }>;
    }>;
  };
}

export default function HeroBlock({ content }: HeroBlockProps) {
  const slides = useMemo<NonNullable<HeroBlockProps['content']['slides']>>(() => {
    if (Array.isArray(content.slides) && content.slides.length > 0) {
      return content.slides;
    }

    const primaryText = content.primaryCta?.text || content.ctaText || 'Jelajahi Kursus';
    const primaryHref = content.primaryCta?.href || content.ctaLink || '/courses';
    const secondaryText = content.secondaryCta?.text || '';
    const secondaryHref = content.secondaryCta?.href || '/login';

    return [
      {
        heading: content.heading,
        subheading: content.subheading,
        background: { imageUrl: content.imageUrl, overlayOpacity: 40 },
        buttons: [
          { text: primaryText, href: primaryHref, variant: 'PRIMARY' as const },
          ...(secondaryText ? [{ text: secondaryText, href: secondaryHref, variant: 'OUTLINE' as const }] : []),
        ],
      },
    ];
  }, [content]);

  const sliderEnabled = content.slider?.enabled !== false && slides.length > 1;
  const autoplayMsRaw = typeof content.slider?.autoplayMs === 'number' ? content.slider.autoplayMs : 6000;
  const autoplayMs = Math.max(4000, autoplayMsRaw);
  const showDots = content.slider?.showDots !== false && slides.length > 1;
  const showArrows = content.slider?.showArrows !== false && slides.length > 1;

  const [activeIndex, setActiveIndex] = useState(0);
  const [trackPos, setTrackPos] = useState<'CENTER' | 'NEXT' | 'PREV'>('CENTER');
  const [isAnimating, setIsAnimating] = useState(false);

  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const isAnimatingRef = useRef(isAnimating);
  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  const trackPosRef = useRef(trackPos);
  useEffect(() => {
    trackPosRef.current = trackPos;
  }, [trackPos]);

  const pendingTargetRef = useRef<number | null>(null);

  const transitionMsRaw = typeof content.slider?.transitionMs === 'number' ? content.slider.transitionMs : 1000;
  const transitionMs = Math.min(2500, Math.max(400, transitionMsRaw));

  const startStep = useCallback(
    (dir: 'NEXT' | 'PREV') => {
      if (!sliderEnabled) return;
      if (isAnimatingRef.current) return;
      setIsAnimating(true);
      setTrackPos(dir);
    },
    [sliderEnabled]
  );

  const goNext = useCallback(() => {
    pendingTargetRef.current = null;
    startStep('NEXT');
  }, [startStep]);

  const goPrev = useCallback(() => {
    pendingTargetRef.current = null;
    startStep('PREV');
  }, [startStep]);

  const goToIndex = useCallback(
    (index: number) => {
      if (!sliderEnabled) return;
      const len = slides.length;
      const target = index >= 0 && index < len ? index : 0;
      const current = activeIndexRef.current;
      if (target === current) return;

      pendingTargetRef.current = target;

      const forward = (target - current + len) % len;
      const backward = (current - target + len) % len;
      startStep(forward <= backward ? 'NEXT' : 'PREV');
    },
    [sliderEnabled, slides.length, startStep]
  );

  useEffect(() => {
    if (!sliderEnabled) return;
    if (!autoplayMs || autoplayMs < 1500) return;

    const timer = setInterval(() => {
      if (isAnimatingRef.current) return;
      goNext();
    }, autoplayMs);

    return () => clearInterval(timer);
  }, [sliderEnabled, autoplayMs, goNext]);

  const safeIndex = activeIndex >= 0 && activeIndex < slides.length ? activeIndex : 0;
  const prevIndex = (safeIndex - 1 + slides.length) % slides.length;
  const nextIndex = (safeIndex + 1) % slides.length;

  const widthMode = content.layout?.widthMode || 'FULL';
  const customMaxWidthPx =
    typeof content.layout?.customMaxWidthPx === 'number' && content.layout.customMaxWidthPx > 0
      ? content.layout.customMaxWidthPx
      : undefined;

  const sectionPx = content.layout?.customPaddingXClass || 'px-4 sm:px-6 lg:px-8';

  const baseBackgroundMode = content.layout?.baseBackgroundMode || 'DARK';
  const baseBackgroundColor =
    typeof content.layout?.baseBackgroundColor === 'string' && content.layout.baseBackgroundColor.trim()
      ? content.layout.baseBackgroundColor.trim()
      : undefined;

  const wrapperBgClass = baseBackgroundMode === 'NONE' ? 'bg-transparent' : 'bg-slate-900';
  const wrapperStyle: CSSProperties | undefined =
    baseBackgroundMode === 'CUSTOM' && baseBackgroundColor ? { backgroundColor: baseBackgroundColor } : undefined;

  const wrapperBase = `relative overflow-hidden ${wrapperBgClass} text-white ${sectionPx}`;
  const wrapperFull = 'py-14 sm:py-20';
  const wrapperBoxed = 'py-10 sm:py-14';

  const heroInnerClass =
    widthMode === 'BOXED'
      ? 'max-w-7xl mx-auto'
      : widthMode === 'CUSTOM'
        ? 'mx-auto'
        : 'w-full';

  const heroInnerStyle = widthMode === 'CUSTOM' && customMaxWidthPx ? { maxWidth: `${customMaxWidthPx}px` } : undefined;

  const minHeightPx =
    typeof content.layout?.minHeightPx === 'number' && content.layout.minHeightPx > 0 ? content.layout.minHeightPx : undefined;

  const contentMinHeightClass = 'min-h-[420px] sm:min-h-[520px]';
  const contentMinHeightStyle: CSSProperties | undefined = minHeightPx ? { minHeight: `${minHeightPx}px` } : undefined;

  const cardBgClass = baseBackgroundMode === 'NONE' ? 'bg-transparent' : 'bg-slate-900/60';
  const cardClass =
    widthMode === 'BOXED' || widthMode === 'CUSTOM'
      ? `rounded-3xl border border-white/10 ${cardBgClass} overflow-hidden`
      : '';

  const contentPadClass = showArrows ? 'px-14 sm:px-16 lg:px-20' : 'px-4 sm:px-10';

  const renderBackgroundLayer = (s: (typeof slides)[number] | null, priority?: boolean) => {
    if (!s) return <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950" />;
    if (!s.background?.imageUrl) return <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950" />;

    const overlay =
      typeof s.background.overlayOpacity === 'number'
        ? Math.min(0.9, Math.max(0, s.background.overlayOpacity / 100))
        : 0.45;

    const fit = s.background.fit === 'CONTAIN' ? 'CONTAIN' : 'COVER';
    const position = s.background.position || 'CENTER';
    const objectPosition =
      position === 'TOP'
        ? 'center top'
        : position === 'BOTTOM'
          ? 'center bottom'
          : position === 'LEFT'
            ? 'left center'
            : position === 'RIGHT'
              ? 'right center'
              : 'center';

    return (
      <div className="absolute inset-0">
        <Image
          src={s.background.imageUrl}
          alt="Hero Background"
          fill
          priority={!!priority}
          unoptimized
          className={fit === 'CONTAIN' ? 'object-contain bg-slate-950' : 'object-cover'}
          style={{ objectPosition }}
        />
        <div className="absolute inset-0 bg-slate-950" style={{ opacity: overlay }} />
      </div>
    );
  };

  const renderContent = (s: (typeof slides)[number] | null, primaryArrow: boolean) => {
    const heading = s?.heading || 'Belajar Lebih Terarah di GeoSains LMS';
    const subheading =
      s?.subheading ||
      'Belajar geosains dengan kurikulum terstruktur, materi yang jelas, dan progress yang terukur.';

    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">{heading}</h1>
        <p className="mt-4 text-base sm:text-lg text-slate-200 leading-relaxed">{subheading}</p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          {(s?.buttons || []).map((btn, idx) => {
            const text = btn?.text || '';
            const href = btn?.href || '#';
            if (!text) return null;

            const variant = btn?.variant || (idx === 0 ? 'PRIMARY' : 'OUTLINE');
            const base =
              'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors w-full sm:w-auto';

            const computedStyle: CSSProperties = {};
            if (btn?.bgColor) computedStyle.backgroundColor = btn.bgColor;
            if (btn?.textColor) computedStyle.color = btn.textColor;
            if (btn?.borderColor) computedStyle.borderColor = btn.borderColor;

            const className =
              variant === 'PRIMARY'
                ? `${base} bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/30`
                : variant === 'SECONDARY'
                  ? `${base} bg-white/10 hover:bg-white/15 text-white border border-white/10`
                  : `${base} bg-transparent hover:bg-white/10 text-white border border-white/20`;

            return (
              <Link key={`${href}-${idx}`} href={href} className={className} style={computedStyle}>
                {text}
                {primaryArrow && idx === 0 ? <ArrowRight className="w-4 h-4" /> : null}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSlideItem = (s: (typeof slides)[number] | null, priority?: boolean) => {
    return (
      <div className="w-1/3 h-full shrink-0 relative">
        <div className="absolute inset-0">{renderBackgroundLayer(s, priority)}</div>
        <div className={`relative h-full ${widthMode === 'FULL' ? 'max-w-7xl mx-auto' : ''} px-0`}>
          <div className={`${contentPadClass} py-12 sm:py-16 flex items-center ${contentMinHeightClass}`} style={contentMinHeightStyle}>
            {renderContent(s, true)}
          </div>
        </div>
      </div>
    );
  };

  const translateX = trackPos === 'CENTER' ? '-33.333333%' : trackPos === 'NEXT' ? '-66.666666%' : '0%';

  const handleTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (!isAnimatingRef.current) return;

    const dir = trackPosRef.current;
    const len = slides.length;
    const current = activeIndexRef.current;
    const newIndex = dir === 'NEXT' ? (current + 1) % len : (current - 1 + len) % len;

    activeIndexRef.current = newIndex;
    setActiveIndex(newIndex);
    setIsAnimating(false);
    setTrackPos('CENTER');

    const target = pendingTargetRef.current;
    if (typeof target === 'number' && target !== newIndex) {
      const forward = (target - newIndex + len) % len;
      const backward = (newIndex - target + len) % len;
      requestAnimationFrame(() => startStep(forward <= backward ? 'NEXT' : 'PREV'));
    } else {
      pendingTargetRef.current = null;
    }
  };

  return (
    <section className={wrapperBase} style={wrapperStyle}>
      <div className={`${widthMode === 'FULL' ? wrapperFull : wrapperBoxed}`}>
        <div className={heroInnerClass} style={heroInnerStyle}>
          <div className={`relative ${cardClass}`}>
            {sliderEnabled ? (
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className="flex w-[300%] h-full will-change-transform"
                  style={{
                    transform: `translateX(${translateX})`,
                    transition: isAnimating ? `transform ${transitionMs}ms cubic-bezier(0.45, 0, 0.55, 1)` : 'none',
                  }}
                  onTransitionEnd={handleTrackTransitionEnd}
                >
                  {renderSlideItem(slides[prevIndex], false)}
                  {renderSlideItem(slides[safeIndex], true)}
                  {renderSlideItem(slides[nextIndex], false)}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0">{renderBackgroundLayer(slides[safeIndex] || slides[0], true)}</div>
            )}

            {!sliderEnabled ? (
              <div className={`relative ${widthMode === 'FULL' ? 'max-w-7xl mx-auto' : ''} px-0`}>
                <div className={`${contentPadClass} py-12 sm:py-16 flex items-center ${contentMinHeightClass}`} style={contentMinHeightStyle}>
                  {renderContent(slides[safeIndex] || slides[0], true)}
                </div>
              </div>
            ) : (
              <div className={`relative ${widthMode === 'FULL' ? 'max-w-7xl mx-auto' : ''} px-0 pointer-events-none`}>
                <div
                  className={`${contentPadClass} py-12 sm:py-16 ${contentMinHeightClass} pointer-events-none`}
                  style={contentMinHeightStyle}
                />
              </div>
            )}

            {showDots ? (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex items-center gap-2 z-20">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToIndex(i)}
                    className={`h-2.5 rounded-full transition-all ${i === safeIndex ? 'w-8 bg-white' : 'w-2.5 bg-white/40 hover:bg-white/70'}`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            ) : null}

            {showArrows ? (
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 sm:px-4 pointer-events-none z-20">
                <button
                  type="button"
                  onClick={goPrev}
                  className="pointer-events-auto cursor-pointer w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white flex items-center justify-center transition-colors"
                  aria-label="Sebelumnya"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="pointer-events-auto cursor-pointer w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white flex items-center justify-center transition-colors"
                  aria-label="Berikutnya"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
