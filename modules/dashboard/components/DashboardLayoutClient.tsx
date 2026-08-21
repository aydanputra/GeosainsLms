"use client";

import { useDashboardStore } from '../store/useDashboardStore';
import Sidebar from './Sidebar';
import MobileSidebar from './MobileSidebar';
import Topbar from './Topbar';
import { clsx } from 'clsx';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type DashboardUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
  isSuperAdmin?: boolean;
};

type VendorMenuState = {
  mode: 'NONE' | 'PENDING' | 'ACTIVE';
  isOwner: boolean;
};

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
  initialUser?: DashboardUser | null;
  initialVendorMenu?: VendorMenuState;
  initialSiteLogoUrl?: string;
  qaUnansweredCount?: number;
  notificationUnreadCount?: number;
}

export default function DashboardLayoutClient({
  children,
  role,
  initialUser = null,
  initialVendorMenu = { mode: 'NONE', isOwner: false },
  initialSiteLogoUrl = '',
  qaUnansweredCount = 0,
  notificationUnreadCount = 0,
}: DashboardLayoutClientProps) {
  const { sidebarCollapsed, sidebarOpen, setSidebarOpen, setUser, clearUser, isNavigating, stopNavigation } = useDashboardStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams?.toString() ?? '';
  const [resolvedUser, setResolvedUser] = useState<DashboardUser | null>(initialUser);
  // Check if we are in the course wizard (new course or edit course wizard)
  const isWizardPage = pathname?.includes('/dashboard/admin/courses/new') || pathname?.includes('/dashboard/admin/wizard');

  useEffect(() => {
    if (initialUser) {
      setResolvedUser(initialUser);
      setUser(initialUser);
      return;
    }
    setResolvedUser(null);
    clearUser();
  }, [initialUser, setUser, clearUser]);

  useEffect(() => {
    const sync = () => {
      if (window.innerWidth >= 768 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [sidebarOpen, setSidebarOpen]);

  useEffect(() => {
    if (initialUser) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        const data = await res.json().catch(() => ({ user: null }));
        if (!active) return;
        const u = data?.user;
        if (u && typeof u.id === 'string' && typeof u.email === 'string' && typeof u.role === 'string') {
          const allowedRoles = new Set(['ADMIN', 'MENTOR', 'STUDENT', 'VENDOR']);
          const normalizedRole = (allowedRoles.has(u.role) ? u.role : 'STUDENT') as 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
          const nextUser = {
            id: u.id,
            name: typeof u.name === 'string' && u.name ? u.name : u.email.split('@')[0],
            email: u.email,
            avatarUrl: typeof u.avatarUrl === 'string' ? u.avatarUrl : null,
            role: normalizedRole,
            isSuperAdmin: Boolean((u as any)?.isSuperAdmin),
          };
          setResolvedUser(nextUser);
          setUser(nextUser);
        } else if (res.status === 401) {
          setResolvedUser(null);
          clearUser();
        }
      } catch {
        if (!active) return;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };

    load();
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname, initialUser, setUser, clearUser]);

  useEffect(() => {
    stopNavigation();
  }, [pathname, searchParamsKey, stopNavigation]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar (Drawer) */}
      <MobileSidebar
        role={role}
        qaUnansweredCount={qaUnansweredCount}
        currentUser={resolvedUser}
        initialVendorMenu={initialVendorMenu}
        initialSiteLogoUrl={initialSiteLogoUrl}
      />

      {/* Desktop Sidebar (Static Column) */}
      <div className={clsx(
        "hidden md:block transition-all duration-300 ease-in-out sticky top-0 h-screen",
        sidebarCollapsed ? "w-20" : "w-64"
      )}>
        <Sidebar
          role={role}
          qaUnansweredCount={qaUnansweredCount}
          currentUser={resolvedUser}
          initialVendorMenu={initialVendorMenu}
          initialSiteLogoUrl={initialSiteLogoUrl}
        />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
        {isNavigating ? <div className="top-loading-bar" role="progressbar" aria-label="Memuat" /> : null}
        <Topbar
          role={role}
          currentUser={resolvedUser}
          qaUnansweredCount={qaUnansweredCount}
          notificationUnreadCount={notificationUnreadCount}
        />
        <main 
          className={clsx(
            "flex-1 w-full",
            // overflow-x-hidden breaks sticky positioning in children because it sets overflow-y to auto
            // We disable it for Wizard page to allow sticky sidebar
            !isWizardPage && "overflow-x-hidden",
            // Centralize padding in layout for consistency
            "py-4 md:py-6 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto w-full"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
