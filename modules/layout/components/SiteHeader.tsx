"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
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
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
  }, [pathname]);

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
    let timer: any = null;

    const load = async () => {
      try {
        if (!user?.id) {
          if (!active) return;
          setNotificationUnreadCount(0);
          return;
        }
        const res = await fetch('/api/notifications?limit=1&kind=alerts', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setNotificationUnreadCount(0);
          return;
        }
        setNotificationUnreadCount(typeof data?.unreadCount === 'number' ? data.unreadCount : 0);
      } catch {
        if (!active) return;
        setNotificationUnreadCount(0);
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
    if (mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (!elearningRef.current) return;
      if (!elearningRef.current.contains(e.target as Node)) setElearningOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [elearningOpen, mobileOpen]);

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
      setSearchOpen(false);
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

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

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

  const submitSearch = () => {
    const q = searchQuery.trim();
    setSearchOpen(false);
    if (!q) {
      router.push('/courses');
      return;
    }
    router.push(`/courses?q=${encodeURIComponent(q)}`);
  };

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
            onClick={() => setSearchOpen(true)}
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            title="Cari"
            aria-label="Cari"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const redirect = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
              if (!user) window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
              else window.location.href = inboxHref;
            }}
            className="relative hidden sm:flex w-10 h-10 rounded-2xl bg-white border border-slate-200 items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50"
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
            onClick={() => {
              const redirect = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
              if (!user) window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
              else window.location.href = '/dashboard/notifications';
            }}
            className="relative hidden sm:flex w-10 h-10 rounded-2xl bg-white border border-slate-200 items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            title="Notifikasi"
            aria-label="Notifikasi"
          >
            <Bell className="w-5 h-5" />
            {user && notificationUnreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                {notificationUnreadCount > 99 ? '99+' : String(notificationUnreadCount)}
              </span>
            ) : null}
          </button>

          {user ? (
            <div className="relative hidden sm:block" ref={userMenuRef}>
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

      {searchOpen ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Tutup pencarian"
            onClick={() => setSearchOpen(false)}
          />
          <div className="relative max-w-2xl mx-auto pt-24 px-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-slate-900">Cari Kursus</div>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="h-9 w-9 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4 text-slate-700" />
                </button>
              </div>
              <div className="p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitSearch();
                  }}
                  className="flex items-center gap-2"
                >
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari judul kursus..."
                      className="w-full h-11 pl-11 pr-4 rounded-2xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    className="h-11 px-4 rounded-2xl bg-indigo-600 text-white font-extrabold hover:bg-indigo-700"
                  >
                    Cari
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={mobileOpen ? 'lg:hidden fixed inset-0 z-[55]' : 'lg:hidden fixed inset-0 z-[55] pointer-events-none'}>
        <button
          type="button"
          className={[
            'absolute inset-0 bg-slate-900/40 transition-opacity duration-300 z-0',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          aria-label="Tutup menu"
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={[
            'absolute top-0 right-0 h-full w-[86%] max-w-sm bg-white border-l border-slate-200 shadow-2xl z-10',
            'transition-transform duration-300 ease-out',
            mobileOpen ? 'translate-x-0' : 'translate-x-full',
          ].join(' ')}
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between">
            <div className="text-sm font-extrabold text-slate-900">Menu</div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="h-10 w-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"
              aria-label="Tutup"
            >
              <X className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          <div className="p-4 space-y-3 overflow-auto h-[calc(100vh-4rem)]">
            {user ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 overflow-hidden relative">
                    {typeof user.avatarUrl === 'string' && user.avatarUrl.trim() && !user.avatarUrl.startsWith('blob:') ? (
                      <Image src={user.avatarUrl} alt={user.name || user.email} fill unoptimized className="object-cover" />
                    ) : (
                      <Image src="/window.svg" alt={user.name || user.email} fill className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-slate-900 truncate">{user.name || user.email}</div>
                    <div className="text-xs text-slate-500 truncate">{user.email}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href="/dashboard/profile"
                    className="px-3 py-2 rounded-2xl text-sm font-extrabold text-slate-800 bg-white border border-slate-200 text-center hover:bg-slate-50"
                  >
                    Profil
                  </Link>
                  <Link
                    href={dashboardHref}
                    className="px-3 py-2 rounded-2xl text-sm font-extrabold text-slate-800 bg-white border border-slate-200 text-center hover:bg-slate-50"
                  >
                    Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-extrabold text-slate-900">Akun</div>
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href="/login"
                    className="flex-1 px-3 py-2 rounded-2xl text-sm font-extrabold text-slate-700 border border-slate-200 text-center hover:bg-slate-50 bg-white"
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/register"
                    className="flex-1 px-3 py-2 rounded-2xl text-sm font-extrabold bg-brand-gradient text-white text-center hover:opacity-90"
                  >
                    Daftar
                  </Link>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Link
                href="/"
                className="flex items-center justify-between px-3 py-3 rounded-2xl text-sm font-extrabold text-slate-800 border border-slate-200 hover:bg-slate-50"
              >
                <span>Home</span>
              </Link>

              {user ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      window.location.href = inboxHref;
                    }}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-2xl text-sm font-extrabold text-slate-800 border border-slate-200 hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-slate-500" />
                      Pesan
                    </span>
                    {messageUnreadCount > 0 ? (
                      <span className="min-w-6 h-6 px-2 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                        {messageUnreadCount > 99 ? '99+' : String(messageUnreadCount)}
                      </span>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      window.location.href = '/dashboard/notifications';
                    }}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-2xl text-sm font-extrabold text-slate-800 border border-slate-200 hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Bell className="w-4 h-4 text-slate-500" />
                      Notifikasi
                    </span>
                    {notificationUnreadCount > 0 ? (
                      <span className="min-w-6 h-6 px-2 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                        {notificationUnreadCount > 99 ? '99+' : String(notificationUnreadCount)}
                      </span>
                    ) : null}
                  </button>
                </>
              ) : null}

              <Link
                href="/cart"
                className="flex items-center justify-between px-3 py-3 rounded-2xl text-sm font-extrabold text-slate-800 border border-slate-200 hover:bg-slate-50"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-slate-500" />
                  Keranjang
                </span>
                {cartCount > 0 ? (
                  <span className="min-w-6 h-6 px-2 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                    {cartCount > 99 ? '99+' : String(cartCount)}
                  </span>
                ) : null}
              </Link>
            </div>

            <div className="border border-slate-200 rounded-3xl overflow-hidden">
              <button
                type="button"
                onClick={() => setElearningOpen((v) => !v)}
                className="w-full px-4 py-3 text-left text-sm font-extrabold text-slate-800 hover:bg-slate-50 flex items-center justify-between"
              >
                E-Learning
                <ChevronDown className={`w-4 h-4 transition-transform ${elearningOpen ? 'rotate-180' : ''}`} />
              </button>
              {elearningOpen ? (
                <div className="p-2 border-t border-slate-200 bg-white">
                  <Link
                    href="/courses"
                    className="block px-3 py-2 rounded-2xl text-sm font-extrabold text-slate-900 hover:bg-slate-50"
                  >
                    Semua Kursus
                  </Link>
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/courses?category=${encodeURIComponent(cat.slug)}`}
                      className="block px-3 py-2 rounded-2xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-3 rounded-2xl text-sm font-extrabold text-slate-800 border border-slate-200 hover:bg-slate-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {user ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                  } catch {
                  }
                  setUser(null);
                  setMobileOpen(false);
                  window.location.href = '/login';
                }}
                className="w-full px-4 py-3 rounded-2xl text-sm font-extrabold text-red-700 border border-slate-200 hover:bg-red-50"
              >
                Keluar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
