"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Bell, ChevronDown, Menu, MessageSquare, Search, ShoppingCart, X } from 'lucide-react';
import { useCartStore } from '@/modules/shop/store/useCartStore';

type CourseCategory = { id: string; name: string; slug: string };

type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
  role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
};

type SiteSettings = {
  siteName?: string;
  siteDescription?: string;
  logoUrl?: string;
};

export default function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [elearningOpen, setElearningOpen] = useState(false);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const { items: cartItems } = useCartStore();
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const elearningRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const cartCount = useMemo(() => cartItems.reduce((acc, item) => acc + Number(item.quantity || 0), 0), [cartItems]);

  const hidden = useMemo(() => {
    if (!pathname) return false;
    if (pathname.startsWith('/dashboard')) return true;
    if (searchParams?.get('spotlight') === '1') return true;
    return false;
  }, [pathname, searchParams]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json().catch(() => []);
        if (!active) return;
        setCategories(Array.isArray(data) ? data : []);
      } catch {
        if (!active) return;
        setCategories([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        const data = await res.json().catch(() => ({ user: null }));
        if (!active) return;
        setUser(data?.user || null);
      } catch {
        if (!active) return;
        setUser(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let timer: any = null;

    const load = async () => {
      try {
        if (!user?.id) {
          if (!active) return;
          setMessageUnreadCount(0);
          return;
        }
        const res = await fetch('/api/messages/threads?limit=1', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setMessageUnreadCount(0);
          return;
        }
        setMessageUnreadCount(typeof data?.unreadCount === 'number' ? data.unreadCount : 0);
      } catch {
        if (!active) return;
        setMessageUnreadCount(0);
      }
    };

    load();
    timer = setInterval(load, 20000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/site-settings');
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        setSiteSettings(typeof data === 'object' && data ? (data as SiteSettings) : {});
      } catch {
        if (!active) return;
        setSiteSettings({});
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!elearningOpen) return;
    const handler = (e: MouseEvent) => {
      if (!elearningRef.current) return;
      if (!elearningRef.current.contains(e.target as Node)) setElearningOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [elearningOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setMobileOpen(false);
      setElearningOpen(false);
      setUserMenuOpen(false);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [pathname]);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const y = window.scrollY || 0;
      setScrolled((prev) => {
        const next = prev ? y > 4 : y > 16;
        return prev === next ? prev : next;
      });
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  if (hidden) return null;

  const menuItems = [
    { href: '/blog', label: 'Artikel dan Berita' },
    { href: '/shop', label: 'Geoshop' },
    { href: '/geoservices', label: 'Geoservices' },
  ];

  const dashboardHref =
    user?.role === 'ADMIN'
      ? '/dashboard/admin'
      : user?.role === 'MENTOR'
        ? '/dashboard/mentor'
        : user?.role === 'VENDOR'
          ? '/dashboard/vendor'
          : '/dashboard/student';

  const inboxHref =
    user?.role === 'ADMIN'
      ? '/dashboard/admin/inbox'
      : user?.role === 'MENTOR'
        ? '/dashboard/mentor/inbox'
        : '/dashboard/student/inbox';

  return (
    <header
      className={[
        'sticky top-0 z-50 border-b border-slate-200 bg-white transition-shadow duration-200 relative',
        scrolled ? 'shadow-sm' : '',
      ].join(' ')}
    >
      <div
        className={[
          'absolute inset-0 pointer-events-none',
          'supports-[backdrop-filter]:backdrop-blur-lg supports-[backdrop-filter]:backdrop-saturate-150',
          'bg-white/95 transition-opacity duration-200',
          scrolled ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            {siteSettings.logoUrl ? (
              <div className="relative h-10 w-36 sm:w-44 lg:w-48">
                <Image
                  src={siteSettings.logoUrl}
                  alt={siteSettings.siteName || 'Logo'}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="192px"
                />
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-extrabold">
                  G
                </div>
                <div className="min-w-0 hidden sm:block">
                  <div className="text-sm font-extrabold text-slate-900 leading-tight">{siteSettings.siteName || 'GeoSains'}</div>
                  <div className="text-xs text-slate-500 leading-tight truncate">
                    {siteSettings.siteDescription || 'Upgrade Skill Geosains'}
                  </div>
                </div>
              </>
            )}
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-2 flex-1 justify-center">
          <Link
            href="/"
            className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
              pathname === '/' ? 'text-indigo-700 bg-indigo-50' : 'text-slate-700 hover:bg-white hover:text-slate-900'
            }`}
          >
            Home
          </Link>

          <div className="relative" ref={elearningRef}>
            <button
              type="button"
              onClick={() => setElearningOpen((v) => !v)}
              className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
                pathname?.startsWith('/courses') ? 'text-indigo-700 bg-indigo-50' : 'text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              E-Learning <ChevronDown className={`w-4 h-4 transition-transform ${elearningOpen ? 'rotate-180' : ''}`} />
            </button>

            {elearningOpen ? (
              <div className="absolute left-0 mt-2 w-[320px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-3 border-b border-slate-100">
                  <Link href="/courses" className="block px-3 py-2 rounded-xl text-sm font-bold text-slate-900 hover:bg-slate-50">
                    Semua Kursus
                  </Link>
                </div>
                <div className="p-2 max-h-72 overflow-auto">
                  {categories.length > 0 ? (
                    categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/courses?category=${encodeURIComponent(cat.slug)}`}
                        className="block px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {cat.name}
                      </Link>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-500">Belum ada kategori.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                pathname === item.href ? 'text-indigo-700 bg-indigo-50' : 'text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            className="relative w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            title="Keranjang"
            aria-label="Keranjang"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                {cartCount > 99 ? '99+' : String(cartCount)}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => {
              const redirect = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
              if (!user) window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
              else window.location.href = inboxHref;
            }}
            className="relative w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            title="Pesan"
            aria-label="Pesan"
          >
            <MessageSquare className="w-5 h-5" />
            {user && messageUnreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                {messageUnreadCount > 99 ? '99+' : String(messageUnreadCount)}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            title="Notifikasi"
          >
            <Bell className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            title="Cari"
          >
            <Search className="w-5 h-5" />
          </button>

          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-3 pl-2 pr-2 py-2 rounded-2xl hover:bg-white transition-colors"
              >
                <div className="hidden sm:block text-sm font-bold text-slate-900">
                  Halo, {user.name || user.email.split('@')[0]}
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-200 overflow-hidden relative">
                  {typeof user.avatarUrl === 'string' && user.avatarUrl.trim() && !user.avatarUrl.startsWith('blob:') ? (
                    <Image src={user.avatarUrl} alt="User" fill unoptimized className="object-cover" />
                  ) : (
                    <Image src="/window.svg" alt="User" fill className="object-cover" />
                  )}
                </div>
                <ChevronDown className={`hidden sm:block w-4 h-4 text-slate-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen ? (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="text-sm font-extrabold text-slate-900 truncate">{user.name || user.email}</div>
                    <div className="text-xs text-slate-500 truncate">{user.email}</div>
                  </div>
                  <div className="p-2">
                    <Link href="/dashboard/settings" className="block px-3 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50">
                      Profil Saya
                    </Link>
                    <Link href={dashboardHref} className="block px-3 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50">
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                        } catch {
                        }
                        setUser(null);
                        window.location.href = '/login';
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-sm font-bold text-red-700 hover:bg-red-50"
                    >
                      Keluar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/login" className="px-3 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-white">
                Masuk
              </Link>
              <Link href="/register" className="px-4 py-2 rounded-xl text-sm font-bold bg-brand-gradient text-white hover:opacity-90">
                Daftar
              </Link>
            </div>
          )}

          <button
            type="button"
            className="lg:hidden w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50"
            onClick={() => setMobileOpen((v) => !v)}
            title="Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="lg:hidden border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-2">
            <Link
              href="/cart"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              <span>Keranjang</span>
              {cartCount > 0 ? (
                <span className="min-w-6 h-6 px-2 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {cartCount > 99 ? '99+' : String(cartCount)}
                </span>
              ) : null}
            </Link>
            <Link href="/" className="block px-3 py-2 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-50">
              Home
            </Link>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setElearningOpen((v) => !v)}
                className="w-full px-3 py-2 text-left text-sm font-bold text-slate-800 hover:bg-slate-50 flex items-center justify-between"
              >
                E-Learning
                <ChevronDown className={`w-4 h-4 transition-transform ${elearningOpen ? 'rotate-180' : ''}`} />
              </button>
              {elearningOpen ? (
                <div className="p-2 border-t border-slate-200 bg-white">
                  <Link href="/courses" className="block px-3 py-2 rounded-xl text-sm font-bold text-slate-900 hover:bg-slate-50">
                    Semua Kursus
                  </Link>
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/courses?category=${encodeURIComponent(cat.slug)}`}
                      className="block px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className="block px-3 py-2 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-50">
                {item.label}
              </Link>
            ))}

            {!user ? (
              <div className="pt-2 flex items-center gap-2">
                <Link href="/login" className="flex-1 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 border border-slate-200 text-center hover:bg-slate-50">
                  Masuk
                </Link>
                <Link href="/register" className="flex-1 px-3 py-2 rounded-xl text-sm font-bold bg-brand-gradient text-white text-center hover:opacity-90">
                  Daftar
                </Link>
              </div>
            ) : (
              <div className="pt-2 grid grid-cols-2 gap-2">
                <Link
                  href="/profile"
                  className="px-3 py-2 rounded-xl text-sm font-bold text-slate-700 border border-slate-200 text-center hover:bg-slate-50"
                >
                  Profil
                </Link>
                <Link
                  href={dashboardHref}
                  className="px-3 py-2 rounded-xl text-sm font-bold text-slate-700 border border-slate-200 text-center hover:bg-slate-50"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                    } catch {
                    }
                    setUser(null);
                    window.location.href = '/login';
                  }}
                  className="col-span-2 px-3 py-2 rounded-xl text-sm font-bold text-red-700 border border-slate-200 text-center hover:bg-red-50"
                >
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
