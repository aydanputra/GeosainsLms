"use client";

import HeroBlock from './HeroBlock';
import TextBlock from './TextBlock';
import FeaturesBlock from './FeaturesBlock';
import CTABlock from './CTABlock';
import CoursesBlock from './CoursesBlock';
import SectionBlock from './SectionBlock';
import GridBlock, { type GridContent } from './GridBlock';
import TestimonialsBlock from './TestimonialsBlock';
import FaqBlock from './FaqBlock';
import LogosBlock from './LogosBlock';
import VendorsBlock from './VendorsBlock';
import GalleryBlock from './GalleryBlock';
import type { CSSProperties } from 'react';

interface Block {
  id: string;
  type: string;
  content: unknown;
}

interface PageRendererProps {
  blocks: Block[];
}

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

type TextContent = {
  text: string;
  alignment?: 'left' | 'center' | 'right';
};

type FeaturesContent = {
  heading?: string;
  features: Array<{ title: string; description: string }>;
};

type CtaContent = {
  heading?: string;
  subheading?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonHref?: string;
};

type CoursesContent = {
  heading?: string;
  subheading?: string;
  limit?: number;
  variant?: string;
  cta?: { text?: string; href?: string };
};

type GridItem = {
  title: string;
  description: string;
  imageUrl?: string;
  href?: string;
  bgColor?: string;
  textColor?: string;
};

type GridContentLocal = GridContent & { highlightEnabled?: boolean; items: GridItem[] };

type SectionContent = {
  id?: string;
  columns: Array<{
    id: string;
    widgets: Array<{ id: string; type: string; content: string }>;
  }>;
  layout?: {
    columnsGap?: 'SM' | 'MD' | 'LG';
    maxWidth?: 'FULL' | 'BOXED';
    paddingY?: 'SM' | 'MD' | 'LG';
  };
};

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

export default function PageRenderer({ blocks }: PageRendererProps) {
  if (!blocks || blocks.length === 0) {
    return <div className="py-20 text-center text-gray-500">Empty Page</div>;
  }

  const getSpacingStyle = (content: unknown) => {
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
    } as CSSProperties;
  };

  return (
    <div className="flex flex-col w-full">
      {blocks.map((block) => {
        let content: unknown;
        if (typeof block.content === 'string') {
          try {
            content = JSON.parse(block.content);
          } catch {
            try {
              content = JSON.parse(sanitizeJsonString(block.content));
            } catch (e2) {
              console.error('Failed to parse block content', e2);
              return (
                <div key={block.id} className="py-10 text-center text-gray-400">
                  Invalid block JSON: {block.type}
                </div>
              );
            }
          }
        } else {
          content = block.content;
        }

        const spacingStyle = getSpacingStyle(content);

        switch (block.type) {
          case 'HERO':
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <HeroBlock content={content as HeroContent} />
              </div>
            ) : (
              <HeroBlock key={block.id} content={content as HeroContent} />
            );
          case 'TEXT': {
            const raw = content as Partial<TextContent> & { text?: unknown; alignment?: unknown };
            const normalized: TextContent = {
              text: typeof raw.text === 'string' ? raw.text : '',
              alignment: raw.alignment === 'left' || raw.alignment === 'center' || raw.alignment === 'right' ? raw.alignment : undefined,
            };
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <TextBlock content={normalized} />
              </div>
            ) : (
              <TextBlock key={block.id} content={normalized} />
            );
          }
          case 'FEATURES': {
            const raw = content as Partial<FeaturesContent> & { heading?: unknown; features?: unknown };
            const featuresArray: unknown[] = Array.isArray(raw.features) ? raw.features : [];
            const normalized: FeaturesContent = {
              heading: typeof raw.heading === 'string' ? raw.heading : undefined,
              features: featuresArray
                .map((f) => {
                  const title = typeof (f as { title?: unknown } | null | undefined)?.title === 'string'
                    ? (f as { title: string }).title
                    : '';
                  const description = typeof (f as { description?: unknown } | null | undefined)?.description === 'string'
                    ? (f as { description: string }).description
                    : '';
                  return { title, description };
                })
                .filter((f) => f.title || f.description),
            };
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <FeaturesBlock content={normalized} />
              </div>
            ) : (
              <FeaturesBlock key={block.id} content={normalized} />
            );
          }
          case 'CTA':
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <CTABlock content={content as CtaContent} />
              </div>
            ) : (
              <CTABlock key={block.id} content={content as CtaContent} />
            );
          case 'COURSES':
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <CoursesBlock content={content as CoursesContent} />
              </div>
            ) : (
              <CoursesBlock key={block.id} content={content as CoursesContent} />
            );
          case 'GRID':
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <GridBlock content={content as GridContentLocal} />
              </div>
            ) : (
              <GridBlock key={block.id} content={content as GridContentLocal} />
            );
          case 'SECTION':
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <SectionBlock content={content as SectionContent} />
              </div>
            ) : (
              <SectionBlock key={block.id} content={content as SectionContent} />
            );
          case 'TESTIMONIALS':
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <TestimonialsBlock content={content as TestimonialsContent} />
              </div>
            ) : (
              <TestimonialsBlock key={block.id} content={content as TestimonialsContent} />
            );
          case 'FAQ':
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <FaqBlock content={content as FaqContent} />
              </div>
            ) : (
              <FaqBlock key={block.id} content={content as FaqContent} />
            );
          case 'LOGOS':
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <LogosBlock content={content as LogosContent} />
              </div>
            ) : (
              <LogosBlock key={block.id} content={content as LogosContent} />
            );
          case 'VENDORS':
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <VendorsBlock content={content as VendorsContent} />
              </div>
            ) : (
              <VendorsBlock key={block.id} content={content as VendorsContent} />
            );
          case 'GALLERY':
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle}>
                <GalleryBlock content={content as GalleryContent} />
              </div>
            ) : (
              <GalleryBlock key={block.id} content={content as GalleryContent} />
            );
          default:
            return spacingStyle ? (
              <div key={block.id} style={spacingStyle} className="py-10 text-center text-gray-400">
                Unknown block type: {block.type}
              </div>
            ) : (
              <div key={block.id} className="py-10 text-center text-gray-400">
                Unknown block type: {block.type}
              </div>
            );
        }
      })}
    </div>
  );
}
