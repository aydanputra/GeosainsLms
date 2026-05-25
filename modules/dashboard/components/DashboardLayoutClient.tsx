"use client";

import { useDashboardStore } from '../store/useDashboardStore';
import Sidebar from './Sidebar';
import MobileSidebar from './MobileSidebar';
import Topbar from './Topbar';
import { clsx } from 'clsx';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
  qaUnansweredCount?: number;
  notificationUnreadCount?: number;
}

export default function DashboardLayoutClient({
  children,
  role,
  qaUnansweredCount = 0,
  notificationUnreadCount = 0,
}: DashboardLayoutClientProps) {
  const { sidebarCollapsed, sidebarOpen, setSidebarOpen, setUser, clearUser, isNavigating, stopNavigation } = useDashboardStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Check if we are in the course wizard (new course or edit course wizard)
  const isWizardPage = pathname?.includes('/dashboard/admin/courses/new') || pathname?.includes('/dashboard/admin/wizard');

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
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        const data = await res.json().catch(() => ({ user: null }));
        if (!active) return;
        const u = data?.user;
        if (u && typeof u.id === 'string' && typeof u.email === 'string' && typeof u.role === 'string') {
          const allowedRoles = new Set(['ADMIN', 'MENTOR', 'STUDENT', 'VENDOR']);
          const normalizedRole = allowedRoles.has(u.role) ? u.role : 'STUDENT';
          setUser({
            id: u.id,
            name: typeof u.name === 'string' && u.name ? u.name : u.email.split('@')[0],
            email: u.email,
            role: normalizedRole,
            isSuperAdmin: Boolean((u as any)?.isSuperAdmin),
          } as any);
        } else {
          clearUser();
        }
      } catch {
        if (!active) return;
        clearUser();
      }
    })();
    return () => {
      active = false;
    };
  }, [setUser, clearUser]);

  useEffect(() => {
    stopNavigation();
  }, [pathname, searchParams?.toString(), stopNavigation]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar (Drawer) */}
      <MobileSidebar role={role} qaUnansweredCount={qaUnansweredCount} />

      {/* Desktop Sidebar (Static Column) */}
      <div className={clsx(
        "hidden md:block transition-all duration-300 ease-in-out sticky top-0 h-screen",
        sidebarCollapsed ? "w-20" : "w-64"
      )}>
        <Sidebar role={role} qaUnansweredCount={qaUnansweredCount} />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
        {isNavigating ? <div className="top-loading-bar" role="progressbar" aria-label="Memuat" /> : null}
        <Topbar role={role} qaUnansweredCount={qaUnansweredCount} notificationUnreadCount={notificationUnreadCount} />
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
