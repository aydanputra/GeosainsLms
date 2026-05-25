"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';

export default function SiteFooter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hidden = useMemo(() => {
    if (!pathname) return false;
    if (pathname.startsWith('/dashboard')) return true;
    if (searchParams?.get('spotlight') === '1') return true;
    return false;
  }, [pathname, searchParams]);

  if (hidden) return null;

  return (
    <footer className="mt-14 bg-slate-950 text-slate-200">
      <div className="h-1 bg-brand-gradient" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="text-lg font-extrabold text-white">GeoSains</span>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-white/10 border border-white/10">LMS</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              Platform pembelajaran geosains dengan kursus terstruktur, kuis, tugas, sertifikat, dan layanan pendukung.
            </p>
          </div>

          <div className="space-y-4">
            <div className="text-sm font-extrabold text-white">Menu</div>
            <div className="space-y-2 text-sm">
              <Link href="/courses" className="block text-slate-300 hover:text-white transition-colors">
                Kursus
              </Link>
              <Link href="/shop" className="block text-slate-300 hover:text-white transition-colors">
                GeoShop
              </Link>
              <Link href="/geoservices" className="block text-slate-300 hover:text-white transition-colors">
                GeoServices
              </Link>
              <Link href="/blog" className="block text-slate-300 hover:text-white transition-colors">
                Blog
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-sm font-extrabold text-white">Akun</div>
            <div className="space-y-2 text-sm">
              <Link href="/login" className="block text-slate-300 hover:text-white transition-colors">
                Masuk
              </Link>
              <Link href="/register" className="block text-slate-300 hover:text-white transition-colors">
                Daftar
              </Link>
              <Link href="/dashboard/settings" className="block text-slate-300 hover:text-white transition-colors">
                Profil
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-sm font-extrabold text-white">Kontak</div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
                <div className="leading-relaxed">Indonesia</div>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-300 shrink-0" />
                <a className="hover:text-white transition-colors" href="mailto:info@geosains.id">
                  info@geosains.id
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-300 shrink-0" />
                <a className="hover:text-white transition-colors" href="tel:+620000000000">
                  +62 000 0000 0000
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-semibold">
            © {new Date().getFullYear()} GeoSains LMS. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
              Kebijakan Privasi
            </Link>
            <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
              Syarat & Ketentuan
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
