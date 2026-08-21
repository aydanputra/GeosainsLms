"use client";

import { useDashboardStore } from '../store/useDashboardStore';
import Sidebar from './Sidebar';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface MobileSidebarProps {
  role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
  currentUser?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
    isSuperAdmin?: boolean;
  } | null;
  initialVendorMenu?: {
    mode: 'NONE' | 'PENDING' | 'ACTIVE';
    isOwner: boolean;
  };
  initialSiteLogoUrl?: string;
  qaUnansweredCount?: number;
}

export default function MobileSidebar({ role, currentUser = null, initialVendorMenu, initialSiteLogoUrl = '', qaUnansweredCount }: MobileSidebarProps) {
  const { sidebarOpen, setSidebarOpen } = useDashboardStore();

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={clsx(
          "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden",
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Mobile Drawer */}
      <div 
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 shadow-xl transition-transform duration-300 ease-in-out md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full relative">
          <Sidebar
            role={role}
            qaUnansweredCount={qaUnansweredCount}
            currentUser={currentUser}
            initialVendorMenu={initialVendorMenu}
            initialSiteLogoUrl={initialSiteLogoUrl}
          />
          
          {/* Close button inside drawer for accessibility */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );
}
