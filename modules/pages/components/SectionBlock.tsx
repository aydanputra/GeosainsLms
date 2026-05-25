"use client";

import HeroBlock from './HeroBlock';
import TextBlock from './TextBlock';
import FeaturesBlock from './FeaturesBlock';
import CTABlock from './CTABlock';
import CoursesBlock from './CoursesBlock';
import GridBlock, { type GridContent } from './GridBlock';
import TestimonialsBlock from './TestimonialsBlock';
import FaqBlock from './FaqBlock';
import LogosBlock from './LogosBlock';
import VendorsBlock from './VendorsBlock';
import GalleryBlock from './GalleryBlock';
import type { CSSProperties } from 'react';

type Widget = { id: string; type: string; content: string };
type Column = { id: string; widgets: Widget[] };
type SectionContent = {
  id?: string;
  columns: Column[];
  layout?: {
    columnsGap?: 'SM' | 'MD' | 'LG';
    maxWidth?: 'FULL' | 'BOXED';
    paddingY?: 'SM' | 'MD' | 'LG';
  };
};

type HeroContent = {
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

type TextContent = { text: string; alignment?: 'left' | 'center' | 'right' };
type FeaturesContent = { heading?: string; features: Array<{ title: string; description: string; icon?: string }> };
type CtaContent = { heading?: string; subheading?: string; buttonText?: string; buttonLink?: string; buttonHref?: string };
type CoursesContent = { heading?: string; subheading?: string; limit?: number; variant?: string; cta?: { text?: string; href?: string } };
type GridContentLocal = GridContent;
type TestimonialsContent = {
  badgeText?: string;
  heading?: string;
  subheading?: string;
  buttons?: Array<{
    text?: string;
    href?: string;
    variant?: 'PRIMARY' | 'SECONDARY' | 'OUTLINE';
    bgColor?: string;
    textColor?: string;
    borderColor?: string;
  }>;
  testimonials?: Array<{
    title?: string;
    text?: string;
    authorName?: string;
    authorRole?: string;
    avatarUrl?: string;
  }>;
  backgroundFrom?: string;
  backgroundTo?: string;
  scrollSpeedPxPerSec?: number;
  heightPx?: number;
  motionMode?: 'BOUNCE' | 'LOOP';
};

type FaqContent = {
  heading?: string;
  subheading?: string;
  items?: Array<{ question?: string; answer?: string }>;
  cta?: { text?: string; href?: string };
};

type LogosContent = {
  heading?: string;
  subheading?: string;
  layout?: 'GRID' | 'MARQUEE';
  grayscale?: boolean;
  logoHeightPx?: number;
  durationSec?: number;
  items?: Array<{ name?: string; imageUrl?: string; href?: string }>;
};

type VendorsContent = {
  heading?: string;
  subheading?: string;
  limit?: number;
  sort?: 'TOP' | 'NEWEST' | 'NAME_ASC';
  cta?: { text?: string; href?: string };
};

type GalleryContent = {
  heading?: string;
  subheading?: string;
  columns?: number;
  mobileColumns?: 1 | 2;
  imageHeightPx?: number;
  showCaptions?: boolean;
  items?: Array<{ imageUrl?: string; caption?: string; href?: string }>;
};

function sanitizeJsonString(input: string) {
  let inString = false;
  let escaped = false;
  let out = '';

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }

    if (ch === '\n') {
      out += '\\n';
      continue;
    }
    if (ch === '\r') {
      out += '\\r';
      continue;
    }
    if (ch === '\t') {
      out += '\\t';
      continue;
    }

    const code = ch.charCodeAt(0);
    if (code >= 0 && code < 0x20) {
      out += `\\u${code.toString(16).padStart(4, '0')}`;
      continue;
    }

    out += ch;
  }

  return out;
}

function parseWidgetContent(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    try {
      return JSON.parse(sanitizeJsonString(content));
    } catch {
      return null;
    }
  }
}

function getSpacingStyle(content: unknown): CSSProperties | undefined {
  if (!content || typeof content !== 'object') return undefined;
  const spacing = (content as { spacing?: unknown }).spacing;
  if (!spacing || typeof spacing !== 'object') return undefined;

  const ptPx = typeof (spacing as { ptPx?: unknown }).ptPx === 'number' ? (spacing as { ptPx: number }).ptPx : undefined;
  const pbPx = typeof (spacing as { pbPx?: unknown }).pbPx === 'number' ? (spacing as { pbPx: number }).pbPx : undefined;
  const pxPx = typeof (spacing as { pxPx?: unknown }).pxPx === 'number' ? (spacing as { pxPx: number }).pxPx : undefined;
  const mtPx = typeof (spacing as { mtPx?: unknown }).mtPx === 'number' ? (spacing as { mtPx: number }).mtPx : undefined;
  const mbPx = typeof (spacing as { mbPx?: unknown }).mbPx === 'number' ? (spacing as { mbPx: number }).mbPx : undefined;
  const mxPx = typeof (spacing as { mxPx?: unknown }).mxPx === 'number' ? (spacing as { mxPx: number }).mxPx : undefined;

  if (ptPx === undefined && pbPx === undefined && pxPx === undefined && mtPx === undefined && mbPx === undefined && mxPx === undefined)
    return undefined;

  return {
    ...(ptPx !== undefined ? { paddingTop: ptPx } : {}),
    ...(pbPx !== undefined ? { paddingBottom: pbPx } : {}),
    ...(pxPx !== undefined ? { paddingLeft: pxPx, paddingRight: pxPx } : {}),
    ...(mtPx !== undefined ? { marginTop: mtPx } : {}),
    ...(mbPx !== undefined ? { marginBottom: mbPx } : {}),
    ...(mxPx !== undefined ? { marginLeft: mxPx, marginRight: mxPx } : {}),
  };
}

export default function SectionBlock({ content }: { content: SectionContent }) {
  const columns = Array.isArray(content.columns) ? content.columns : [];
  const columnsCount = Math.max(1, Math.min(4, columns.length || 1));

  const gapClass = content.layout?.columnsGap === 'SM' ? 'gap-4' : content.layout?.columnsGap === 'LG' ? 'gap-8' : 'gap-6';
  const pyClass = content.layout?.paddingY === 'SM' ? 'py-8' : content.layout?.paddingY === 'LG' ? 'py-16' : 'py-12';
  const maxWidthClass = content.layout?.maxWidth === 'FULL' ? 'w-full' : 'max-w-7xl mx-auto';

  const gridColsClass =
    columnsCount === 1
      ? 'grid-cols-1'
      : columnsCount === 2
        ? 'grid-cols-1 lg:grid-cols-2'
        : columnsCount === 3
          ? 'grid-cols-1 lg:grid-cols-3'
          : 'grid-cols-1 lg:grid-cols-4';

  return (
    <section className={`w-full ${pyClass}`}>
      <div className={`${maxWidthClass} px-4 sm:px-6 lg:px-8`}>
        <div className={`grid ${gridColsClass} ${gapClass}`}>
          {columns.map((col) => (
            <div key={col.id} className="flex flex-col gap-6">
              {(col.widgets || []).map((widget) => {
                const widgetContent = parseWidgetContent(widget.content);
                if (!widgetContent) return null;
                const spacingStyle = getSpacingStyle(widgetContent);

                if (widget.type === 'HERO')
                  return spacingStyle ? (
                    <div key={widget.id} style={spacingStyle}>
                      <HeroBlock content={widgetContent as HeroContent} />
                    </div>
                  ) : (
                    <HeroBlock key={widget.id} content={widgetContent as HeroContent} />
                  );

                if (widget.type === 'TEXT') {
                  const raw = widgetContent as Partial<TextContent> & { text?: unknown; alignment?: unknown };
                  const normalized: TextContent = {
                    text: typeof raw.text === 'string' ? raw.text : '',
                    alignment:
                      raw.alignment === 'left' || raw.alignment === 'center' || raw.alignment === 'right'
                        ? raw.alignment
                        : undefined,
                  };
                  return spacingStyle ? (
                    <div key={widget.id} style={spacingStyle}>
                      <TextBlock content={normalized} />
                    </div>
                  ) : (
                    <TextBlock key={widget.id} content={normalized} />
                  );
                }

                if (widget.type === 'FEATURES') {
                  const raw = widgetContent as Partial<FeaturesContent> & { heading?: unknown; features?: unknown };
                  const featuresArray: unknown[] = Array.isArray(raw.features) ? raw.features : [];
                  const normalized: FeaturesContent = {
                    heading: typeof raw.heading === 'string' ? raw.heading : undefined,
                    features: featuresArray
                      .map((f) => {
                        const title = typeof (f as { title?: unknown } | null | undefined)?.title === 'string'
                          ? (f as { title: string }).title
                          : '';
                        const description =
                          typeof (f as { description?: unknown } | null | undefined)?.description === 'string'
                            ? (f as { description: string }).description
                            : '';
                        const icon = typeof (f as { icon?: unknown } | null | undefined)?.icon === 'string'
                          ? (f as { icon: string }).icon
                          : undefined;
                        return { title, description, icon };
                      })
                      .filter((f) => f.title || f.description),
                  };
                  return spacingStyle ? (
                    <div key={widget.id} style={spacingStyle}>
                      <FeaturesBlock content={normalized} />
                    </div>
                  ) : (
                    <FeaturesBlock key={widget.id} content={normalized} />
                  );
                }

                if (widget.type === 'CTA')
                  return spacingStyle ? (
                    <div key={widget.id} style={spacingStyle}>
                      <CTABlock content={widgetContent as CtaContent} />
                    </div>
                  ) : (
                    <CTABlock key={widget.id} content={widgetContent as CtaContent} />
                  );
                if (widget.type === 'COURSES')
                  return spacingStyle ? (
                    <div key={widget.id} style={spacingStyle}>
                      <CoursesBlock content={widgetContent as CoursesContent} />
                    </div>
                  ) : (
                    <CoursesBlock key={widget.id} content={widgetContent as CoursesContent} />
                  );
                if (widget.type === 'GRID')
                  return spacingStyle ? (
                    <div key={widget.id} style={spacingStyle}>
                      <GridBlock content={widgetContent as GridContentLocal} />
                    </div>
                  ) : (
                    <GridBlock key={widget.id} content={widgetContent as GridContentLocal} />
                  );

                if (widget.type === 'TESTIMONIALS')
                  return spacingStyle ? (
                    <div key={widget.id} style={spacingStyle}>
                      <TestimonialsBlock content={widgetContent as TestimonialsContent} />
                    </div>
                  ) : (
                    <TestimonialsBlock key={widget.id} content={widgetContent as TestimonialsContent} />
                  );

                if (widget.type === 'FAQ')
                  return spacingStyle ? (
                    <div key={widget.id} style={spacingStyle}>
                      <FaqBlock content={widgetContent as FaqContent} />
                    </div>
                  ) : (
                    <FaqBlock key={widget.id} content={widgetContent as FaqContent} />
                  );

                if (widget.type === 'LOGOS')
                  return spacingStyle ? (
                    <div key={widget.id} style={spacingStyle}>
                      <LogosBlock content={widgetContent as LogosContent} />
                    </div>
                  ) : (
                    <LogosBlock key={widget.id} content={widgetContent as LogosContent} />
                  );

                if (widget.type === 'VENDORS')
                  return spacingStyle ? (
                    <div key={widget.id} style={spacingStyle}>
                      <VendorsBlock content={widgetContent as VendorsContent} />
                    </div>
                  ) : (
                    <VendorsBlock key={widget.id} content={widgetContent as VendorsContent} />
                  );

                if (widget.type === 'GALLERY')
                  return spacingStyle ? (
                    <div key={widget.id} style={spacingStyle}>
                      <GalleryBlock content={widgetContent as GalleryContent} />
                    </div>
                  ) : (
                    <GalleryBlock key={widget.id} content={widgetContent as GalleryContent} />
                  );

                return null;
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
