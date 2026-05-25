import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Toaster } from 'sonner';
import SiteHeader from '@/modules/layout/components/SiteHeader';
import SiteFooter from '@/modules/layout/components/SiteFooter';
import { prisma } from '@/utils/prisma';
import PublicSupportChat from '@/modules/layout/components/PublicSupportChat';

export const dynamic = 'force-dynamic';

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
  const supportAdmin =
    (await prisma.user.findFirst({
      where: { role: 'ADMIN', isSuperAdmin: false },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, name: true, email: true },
    })) ||
    (await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: [{ isSuperAdmin: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, email: true },
    }));

  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Providers>
          <SiteHeader />
          {children}
          <SiteFooter />
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
