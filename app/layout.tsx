import { Suspense } from 'react';
import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Toaster } from 'sonner';
import SiteHeader from '@/modules/layout/components/SiteHeader';
import SiteFooter from '@/modules/layout/components/SiteFooter';
import { prisma } from '@/utils/prisma';
import PublicSupportChat from '@/modules/layout/components/PublicSupportChat';
import { getAppUrl } from '@/modules/core/utils/appUrl';

export const revalidate = 300;

type LayoutSiteSettings = {
  siteName?: string;
  siteDescription?: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
};

type LayoutCategory = {
  id: string;
  name: string;
  slug: string;
};

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function pickString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await prisma.page.findUnique({
      where: { slug: '__site_settings__' },
      select: { content: true, updatedAt: true },
    });
    const parsed = page?.content ? (JSON.parse(page.content) as Record<string, unknown>) : {};
    const siteName = typeof parsed.siteName === 'string' && parsed.siteName.trim() ? parsed.siteName.trim() : 'GeoSains LMS';
    const siteDescription =
      typeof parsed.siteDescription === 'string' && parsed.siteDescription.trim()
        ? parsed.siteDescription.trim()
        : 'Platform pembelajaran geosains.';
    const faviconUrl = typeof parsed.faviconUrl === 'string' && parsed.faviconUrl.trim() ? parsed.faviconUrl.trim() : '';
    const logoUrl = typeof parsed.logoUrl === 'string' && parsed.logoUrl.trim() ? parsed.logoUrl.trim() : '';
    const version = page?.updatedAt ? new Date(page.updatedAt).getTime() : Date.now();
    const withVersion = (url: string) => (url ? `${url}${url.includes('?') ? '&' : '?'}v=${version}` : '');
    const faviconVersioned = withVersion(faviconUrl);
    const logoVersioned = withVersion(logoUrl);

    return {
      metadataBase: new URL(getAppUrl()),
      title: siteName,
      description: siteDescription,
      ...(faviconUrl || logoUrl
        ? {
            icons: {
              ...(faviconUrl
                ? {
                    icon: [{ url: faviconVersioned, type: 'image/png' }],
                    shortcut: [{ url: faviconVersioned, type: 'image/png' }],
                  }
                : {}),
              ...(logoUrl ? { apple: [{ url: logoVersioned, type: 'image/png' }] } : {}),
            },
          }
        : {}),
    };
  } catch {
    return {
      metadataBase: new URL(getAppUrl()),
      title: 'GeoSains LMS',
      description: 'Platform pembelajaran geosains.',
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [supportAdmin, siteSettingsPage, categories] = await Promise.all([
    prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: [{ isSuperAdmin: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, email: true },
    }),
    prisma.page.findUnique({
      where: { slug: '__site_settings__' },
      select: { content: true },
    }),
    prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const parsedSiteSettings = safeParse(siteSettingsPage?.content);
  const initialSiteSettings: LayoutSiteSettings = {
    siteName: pickString(parsedSiteSettings, 'siteName'),
    siteDescription: pickString(parsedSiteSettings, 'siteDescription'),
    logoUrl: pickString(parsedSiteSettings, 'logoUrl'),
    contactEmail: pickString(parsedSiteSettings, 'contactEmail'),
    contactPhone: pickString(parsedSiteSettings, 'contactPhone'),
  };
  const initialCategories: LayoutCategory[] = categories.map((category) => ({
    id: String(category.id),
    name: String(category.name),
    slug: String(category.slug),
  }));

  return (
    <html lang="id">
      <body
        className={`${poppins.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Providers>
          <Suspense fallback={null}>
            <SiteHeader initialCategories={initialCategories} initialSiteSettings={initialSiteSettings} />
          </Suspense>
          {children}
          <Suspense fallback={null}>
            <SiteFooter initialSiteSettings={initialSiteSettings} />
          </Suspense>
          <PublicSupportChat
            adminId={supportAdmin?.id ? String(supportAdmin.id) : null}
            adminLabel={supportAdmin?.name ? String(supportAdmin.name) : supportAdmin?.email ? String(supportAdmin.email) : null}
          />
          <Toaster position="top-right" richColors closeButton duration={4000} />
        </Providers>
      </body>
    </html>
  );
}
