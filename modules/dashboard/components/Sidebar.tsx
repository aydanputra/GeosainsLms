"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useDashboardStore } from '../store/useDashboardStore';
import { 
  LayoutDashboard, 
  BookOpen, 
  ShoppingBag, 
  ShoppingCart, 
  FileText, 
  Globe, 
  ImageIcon,
  BarChart2, 
  Settings,
  CircleUser,
  GraduationCap,
  Award,
  DollarSign,
  Eye,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Megaphone,
  MessageSquare,
  Mail
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Image from 'next/image';

type DashboardUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
  isSuperAdmin?: boolean;
};

interface SidebarProps {
  role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
  currentUser?: DashboardUser | null;
  initialVendorMenu?: {
    mode: 'NONE' | 'PENDING' | 'ACTIVE';
    isOwner: boolean;
  };
  initialSiteLogoUrl?: string;
  qaUnansweredCount?: number;
}

export default function Sidebar({ role, currentUser = null, initialVendorMenu, initialSiteLogoUrl = '', qaUnansweredCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { sidebarCollapsed, toggleSidebarCollapse, setSidebarOpen, startNavigation } = useDashboardStore();
  const user = currentUser;
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [siteLogoUrl, setSiteLogoUrl] = useState<string>(initialSiteLogoUrl);
  const [vendorMenu, setVendorMenu] = useState<{ mode: 'NONE' | 'PENDING' | 'ACTIVE'; isOwner: boolean }>(
    initialVendorMenu || {
      mode: 'NONE',
      isOwner: false,
    }
  );

  // Close mobile sidebar on route change
  if (typeof window !== 'undefined') {
    // Basic effect for demo, in real app use useEffect
  }

  const toggleSubmenu = (label: string) => {
    if (sidebarCollapsed) {
        toggleSidebarCollapse(); // Auto expand if clicking submenu while collapsed
        setExpandedMenus([label]);
    } else {
        setExpandedMenus(prev => 
            prev.includes(label) ? prev.filter(item => item !== label) : [...prev, label]
        );
    }
  };

  const adminLinks = user?.isSuperAdmin
    ? [
        { href: '/dashboard/admin', label: 'Beranda', icon: LayoutDashboard },
        { href: '/dashboard/admin/inbox', label: 'Pesan & Notifikasi', icon: MessageSquare },
        {
          label: 'Manajemen Kursus',
          icon: BookOpen,
          submenu: [
            { href: '/dashboard/admin/courses', label: 'Daftar Kursus' },
            { href: '/dashboard/admin/courses/new', label: 'Tambah Kursus' },
            { href: '/dashboard/admin/courses/students', label: 'Siswa' },
            { href: '/dashboard/admin/assignments', label: 'Tugas' },
            { href: '/dashboard/admin/enrollments', label: 'Pendaftaran' },
            { href: '/dashboard/admin/quiz-attempts', label: 'Percobaan Kuis' },
            { href: '/dashboard/admin/instructors', label: 'Instruktur' },
            { href: '/dashboard/admin/course-reports', label: 'Laporan' },
            { href: '/dashboard/admin/courses/categories', label: 'Kategori Kursus' },
            { href: '/dashboard/admin/courses/announcements', label: 'Pengumuman' },
            { href: '/dashboard/admin/courses/qa', label: 'Tanya Jawab' },
            { href: '/dashboard/admin/gradebook', label: 'Buku Nilai' },
            { href: '/dashboard/admin/evaluations', label: 'Evaluasi' },
            { href: '/dashboard/admin/courses/settings', label: 'Pengaturan Kursus' },
          ],
        },
        {
          label: 'Manajemen Toko',
          icon: ShoppingBag,
          submenu: [
            { href: '/dashboard/admin/shop', label: 'Kelola Produk' },
            { href: '/dashboard/admin/shop/categories', label: 'Kategori Produk' },
            { href: '/dashboard/admin/shop/vendors', label: 'Manajemen Vendor' },
          ],
        },
        {
          label: 'Operasional',
          icon: BarChart2,
          submenu: [
            { href: '/dashboard/admin/sales', label: 'Penjualan' },
            { href: '/dashboard/admin/sales/orders', label: 'Order' },
            { href: '/dashboard/admin/sales/withdraw', label: 'Withdraw' },
          ],
        },
        {
          label: 'Artikel',
          icon: FileText,
          submenu: [
            { href: '/dashboard/admin/blog', label: 'Semua Artikel' },
            { href: '/dashboard/admin/blog/new', label: 'Tambah Artikel' },
            { href: '/dashboard/admin/blog/categories', label: 'Kategori Artikel' },
            { href: '/dashboard/admin/blog/tags', label: 'Tag Artikel' },
          ],
        },
        { href: '/dashboard/admin/affiliate', label: 'Affiliate', icon: Megaphone },
        { href: '/dashboard/admin/pages', label: 'Halaman / Situs', icon: Globe },
        { href: '/dashboard/admin/reports', label: 'Laporan & Analitik', icon: ClipboardList },
        { href: '/dashboard/admin/audit', label: 'Audit Log', icon: Eye },
        { href: '/dashboard/admin/settings', label: 'Pengaturan Platform', icon: Settings },
        {
          id: 'ADMIN_USER_GROUP',
          label: 'User',
          icon: CircleUser,
          submenu: [
            { href: '/dashboard/profile', label: 'Profil Saya' },
            { href: '/dashboard/settings', label: 'Pengaturan' },
            { href: '/dashboard/admin/users', label: 'Manajemen User' },
          ],
        },
      ]
    : [
        { href: '/dashboard/admin', label: 'Beranda', icon: LayoutDashboard },
        { href: '/dashboard/admin/inbox', label: 'Pesan & Notifikasi', icon: MessageSquare },
        { 
          label: 'Manajemen Kursus',
          icon: BookOpen,
          submenu: [
            { href: '/dashboard/admin/courses', label: 'Daftar Kursus' },
            { href: '/dashboard/admin/courses/students', label: 'Siswa' },
            { href: '/dashboard/admin/assignments', label: 'Tugas' },
            { href: '/dashboard/admin/enrollments', label: 'Pendaftaran' },
            { href: '/dashboard/admin/quiz-attempts', label: 'Percobaan Kuis' },
            { href: '/dashboard/admin/instructors', label: 'Instruktur' },
            { href: '/dashboard/admin/course-reports', label: 'Laporan' },
            { href: '/dashboard/admin/courses/categories', label: 'Kategori Kursus' },
            { href: '/dashboard/admin/courses/announcements', label: 'Pengumuman' },
            { href: '/dashboard/admin/courses/qa', label: 'Tanya Jawab' },
            { href: '/dashboard/admin/gradebook', label: 'Buku Nilai' },
            { href: '/dashboard/admin/evaluations', label: 'Evaluasi' },
          ]
        },
        {
          label: 'Marketing',
          icon: Megaphone,
          submenu: [
            { href: '/dashboard/admin/courses/coupons?view=discounts', label: 'Diskon' },
            { href: '/dashboard/admin/courses/coupons?view=coupons', label: 'Kupon' },
            { href: '/dashboard/admin/affiliate', label: 'Affiliate' },
          ],
        },
        {
          label: 'Penjualan',
          icon: BarChart2,
          submenu: [
            { href: '/dashboard/admin/sales', label: 'Dashboard' },
            { href: '/dashboard/admin/sales/products', label: 'Produk' },
            { href: '/dashboard/admin/sales/orders', label: 'Order' },
            { href: '/dashboard/admin/sales/withdraw', label: 'Withdraw' },
          ],
        },
        {
          label: 'Manajemen Toko',
          icon: ShoppingBag,
          submenu: [
            { href: '/dashboard/admin/shop', label: 'Kelola Produk' },
            { href: '/dashboard/admin/shop/categories', label: 'Kategori Produk' },
            { href: '/dashboard/admin/shop/vendors', label: 'Manajemen Vendor' },
          ],
        },
        {
          label: 'Artikel',
          icon: FileText,
          submenu: [
            { href: '/dashboard/admin/blog', label: 'Semua Artikel' },
            { href: '/dashboard/admin/blog/new', label: 'Tambah Artikel' },
            { href: '/dashboard/admin/blog/categories', label: 'Kategori Artikel' },
            { href: '/dashboard/admin/blog/tags', label: 'Tag Artikel' },
          ],
        },
        { href: '/dashboard/admin/pages', label: 'Halaman / Situs', icon: Globe },
        { href: '/dashboard/admin/media', label: 'Media', icon: ImageIcon },
        { href: '/dashboard/admin/reports', label: 'Analytics', icon: BarChart2 },
        {
          id: 'ADMIN_USER_GROUP',
          label: 'User',
          icon: CircleUser,
          submenu: [
            { href: '/dashboard/profile', label: 'Profil Saya' },
            { href: '/dashboard/settings', label: 'Pengaturan' },
            { href: '/dashboard/admin/users', label: 'Manajemen User' },
          ],
        },
      ];

  const links = {
    ADMIN: adminLinks,
    MENTOR: [
      { type: 'section', label: 'Dashboard' },
      { href: '/dashboard/mentor', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/dashboard/mentor/inbox', label: 'Pesan & Notifikasi', icon: MessageSquare },
      { href: '/dashboard/mentor/analytics', label: 'Analytics', icon: BarChart2 },

      { type: 'section', label: 'Mentor' },
      {
        id: 'MENTOR_GROUP',
        label: 'Mentor',
        icon: GraduationCap,
        submenu: [
          { href: '/dashboard/mentor/courses', label: 'Kursus Saya' },
          { href: '/dashboard/admin/courses/categories', label: 'Kategori Kursus' },
          { href: '/dashboard/mentor/quizzes', label: 'Kuis' },
          { href: '/dashboard/mentor/assignments', label: 'Tugas' },
          { href: '/dashboard/mentor/evaluations', label: 'Evaluasi' },
          { href: '/dashboard/mentor/announcements', label: 'Pengumuman' },
          { href: '/dashboard/mentor/qa', label: 'Tanya Jawab' },
          { href: '/dashboard/mentor/students', label: 'Siswa' },
          { href: '/dashboard/mentor/gradebook', label: 'Buku Nilai' },
          { href: '/dashboard/mentor/certificates', label: 'Sertifikat' },
        ],
      },

      { type: 'section', label: 'Pembelajaran Saya' },
      {
        id: 'MENTOR_STUDENT_GROUP',
        label: 'Siswa',
        icon: BookOpen,
        submenu: [
          { href: '/dashboard/student', label: 'Dashboard Belajar' },
          { href: '/dashboard/student/analytics', label: 'Progress Belajar' },
          { href: '/dashboard/student/courses', label: 'Kursus Diikuti' },
          { href: '/dashboard/student/orders', label: 'Riwayat Pembelian' },
          { href: '/dashboard/student/quizzes', label: 'Kuis Saya' },
          { href: '/dashboard/student/certificates', label: 'Sertifikat Saya' },
          { href: '/dashboard/student/affiliate', label: 'Affiliate Saya' },
        ],
      },

      { type: 'section', label: 'Vendor' },
      {
        id: 'VENDOR_GROUP',
        label: 'Vendor',
        icon: ShoppingBag,
        submenu: [{ href: '/dashboard/vendor', label: 'Dashboard Vendor' }],
      },

      { type: 'section', label: 'Artikel' },
      {
        id: 'ARTICLE_GROUP',
        label: 'Artikel',
        icon: FileText,
        submenu: [
          { href: '/dashboard/mentor/blog', label: 'Semua Artikel' },
          { href: '/dashboard/mentor/blog/new', label: 'Tambah Artikel' },
          { href: '/dashboard/mentor/blog/categories', label: 'Kategori Artikel' },
          { href: '/dashboard/mentor/blog/tags', label: 'Tag Artikel' },
        ],
      },

      { type: 'section', label: 'Marketing' },
      {
        id: 'MARKETING_GROUP',
        label: 'Marketing',
        icon: Megaphone,
        submenu: [
          { href: '/dashboard/mentor/marketing/coupons?view=discounts', label: 'Diskon' },
          { href: '/dashboard/mentor/marketing/coupons?view=coupons', label: 'Kupon' },
          { href: '/dashboard/mentor/marketing/affiliate', label: 'Affiliate' },
        ],
      },

      { type: 'section', label: 'Penjualan' },
      {
        id: 'SALES_GROUP',
        label: 'Penjualan',
        icon: BarChart2,
        submenu: [
          { href: '/dashboard/mentor/sales/products', label: 'Produk' },
          { href: '/dashboard/mentor/sales/orders', label: 'Order' },
          { href: '/dashboard/mentor/sales/withdraw', label: 'Withdraw' },
        ],
      },

      { type: 'section', label: 'User' },
      {
        id: 'USER_GROUP',
        label: 'User',
        icon: CircleUser,
        submenu: [
          { href: '/dashboard/profile', label: 'Profil Saya' },
          { href: '/dashboard/settings', label: 'Pengaturan' },
        ],
      },
    ],
    STUDENT: [
      { href: '/dashboard/student', label: 'Beranda', icon: LayoutDashboard },
      { href: '/dashboard/student/inbox', label: 'Pesan & Notifikasi', icon: Mail },
      { href: '/dashboard/student/analytics', label: 'Analytics', icon: BarChart2 },
      { href: '/dashboard/student/courses', label: 'Kursus Saya', icon: BookOpen },
      { href: '/dashboard/student/orders', label: 'Riwayat Pembelian', icon: ShoppingCart },
      { href: '/dashboard/student/quizzes', label: 'Kuis Saya', icon: ClipboardList },
      { href: '/dashboard/student/announcements', label: 'Pengumuman', icon: Megaphone },
      { href: '/dashboard/student/qa', label: 'Tanya Jawab', icon: MessageSquare },
      { href: '/dashboard/student/certificates', label: 'Sertifikat', icon: Award },
      { href: '/dashboard/student/affiliate', label: 'Afiliasi', icon: DollarSign },
      {
        id: 'STUDENT_USER_GROUP',
        label: 'User',
        icon: CircleUser,
        submenu: [
          { href: '/dashboard/profile', label: 'Profil Saya' },
          { href: '/dashboard/settings', label: 'Pengaturan' },
        ],
      },
    ],
    VENDOR: [
      { href: '/dashboard/vendor', label: 'Beranda', icon: LayoutDashboard },
      { href: '/dashboard/vendor/analytics', label: 'Analytics', icon: BarChart2 },
      {
        label: 'Manajemen Toko',
        icon: ShoppingBag,
        submenu: [
          { href: '/dashboard/vendor/shop', label: 'Kelola Produk' },
          { href: '/dashboard/vendor/team', label: 'Tim Vendor' },
        ],
      },
      { href: '/dashboard/settings', label: 'Pengaturan', icon: Settings },
    ],
  };

  const currentLinks = links[role] || [];
  const computedLinks = (() => {
    if (role === 'ADMIN' || role === 'VENDOR') return currentLinks;
    if (role !== 'MENTOR') {
      if (vendorMenu.mode !== 'ACTIVE') return currentLinks;
      return [
        ...currentLinks,
        {
          label: 'Manajemen Toko',
          icon: ShoppingBag,
          submenu: [
            { href: '/dashboard/vendor', label: 'Beranda Toko' },
            { href: '/dashboard/vendor/shop', label: 'Kelola Produk' },
            ...(vendorMenu.isOwner ? [{ href: '/dashboard/vendor/team', label: 'Tim Vendor' }] : []),
          ],
        },
      ];
    }

    return currentLinks.map((link: any) => {
      if (link?.id !== 'VENDOR_GROUP' || !link?.submenu) return link;
      if (vendorMenu.mode === 'NONE') {
        return {
          ...link,
          submenu: [{ href: '/dashboard/vendor', label: 'Daftar sebagai Vendor' }],
        };
      }
      if (vendorMenu.mode !== 'ACTIVE') {
        return {
          ...link,
          submenu: [{ href: '/dashboard/vendor', label: 'Status Vendor' }],
        };
      }
      return {
        ...link,
        submenu: [
          { href: '/dashboard/vendor', label: 'Dashboard Vendor' },
          { href: '/dashboard/vendor/profile', label: 'Profil Vendor' },
          { href: '/dashboard/vendor/shop', label: 'Produk' },
          { href: '/dashboard/admin/shop/categories', label: 'Kategori Produk' },
          ...(vendorMenu.isOwner ? [{ href: '/dashboard/vendor/team', label: 'Tim Vendor' }] : []),
        ],
      };
    });
  })();
  const qaBadgeText = qaUnansweredCount > 99 ? '99+' : String(qaUnansweredCount);

  const isHrefActive = (href: string) => {
    if (!href) return false;
    try {
      const url = new URL(href, 'http://local');
      if (url.pathname !== pathname) return false;

      for (const [key, value] of url.searchParams.entries()) {
        if (searchParams.get(key) !== value) return false;
      }

      if (typeof window !== 'undefined' && url.hash) {
        if (window.location.hash !== url.hash) return false;
      }

      return true;
    } catch {
      return href === pathname;
    }
  };
  const onNavigate = (href: string) => {
    if (!href) return;
    if (!isHrefActive(href)) startNavigation();
    setSidebarOpen(false);
  };

  useEffect(() => {
    setSiteLogoUrl(initialSiteLogoUrl || '');
  }, [initialSiteLogoUrl]);

  useEffect(() => {
    if (role === 'ADMIN' || role === 'VENDOR') {
      setVendorMenu({ mode: 'NONE', isOwner: false });
      return;
    }
    setVendorMenu(
      initialVendorMenu || {
        mode: 'NONE',
        isOwner: false,
      }
    );
  }, [initialVendorMenu, role]);

  return (
    <aside 
      className={clsx(
        "bg-slate-900 text-slate-300 border-r border-slate-800 shadow-xl transition-all duration-300 ease-in-out flex flex-col h-full",
        "w-full"
      )}
    >
      {/* Header Logo */}
        <div className="h-16 flex items-center justify-center border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
          {siteLogoUrl ? (
            <div className={clsx("relative h-9 w-40 transition-all duration-300", sidebarCollapsed ? "md:w-10" : "w-40")}>
              <Image src={siteLogoUrl} alt="Logo" fill unoptimized className="object-contain" sizes="160px" />
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-hidden">
              <GraduationCap className="w-8 h-8 text-indigo-500 flex-shrink-0" />
              <span 
                className={clsx(
                  "text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent transition-opacity duration-300",
                  sidebarCollapsed ? "md:opacity-0 md:w-0" : "opacity-100"
                )}
              >
                GeoSains
              </span>
            </div>
          )}
        </div>
        
        {/* Navigation Menu */}
        <nav className="flex-1 py-6 px-3 pb-32 overflow-y-auto overflow-x-hidden scrollbar-minimal" style={{ scrollbarGutter: 'stable' }}>
          <ul className="space-y-1">
            {computedLinks.filter((l: any) => l?.type !== 'section').map((link: any, index: number) => {
              const Icon = link.icon;
              const isActive = (typeof link.href === 'string' && isHrefActive(link.href)) || (link.submenu && link.submenu.some((sub: any) => isHrefActive(sub.href)));
              const isExpanded = !sidebarCollapsed && (isActive || expandedMenus.includes(link.label));

              return (
                <li key={index} className="relative group">
                  {link.submenu ? (
                    <div className="space-y-1">
                      <button
                        onClick={() => toggleSubmenu(link.label)}
                        className={twMerge(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                          isActive ? "bg-indigo-600/10 text-indigo-400" : "hover:bg-slate-800 hover:text-white"
                        )}
                        title={sidebarCollapsed ? link.label : undefined}
                      >
                        <div className="flex items-center gap-3">
                          {Icon && <Icon className={twMerge("w-5 h-5 transition-colors flex-shrink-0", isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-white")} />}
                          <span 
                            className={clsx(
                              "font-medium text-sm transition-all duration-200 whitespace-nowrap",
                              sidebarCollapsed ? "md:opacity-0 md:w-0 md:hidden" : "opacity-100"
                            )}
                          >
                            {link.label}
                          </span>
                        </div>
                        {!sidebarCollapsed && (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          )
                        )}
                      </button>
                      
                      {/* Submenu */}
                      <div 
                        className={clsx(
                          "overflow-hidden transition-all duration-300 relative",
                          isExpanded && !sidebarCollapsed ? "max-h-[2000px] opacity-100 z-10" : "max-h-0 opacity-0"
                        )}
                      >
                        <ul className="pl-4 space-y-1 mt-1 relative before:absolute before:left-[1.25rem] before:top-0 before:bottom-0 before:w-px before:bg-slate-800">
                          {link.submenu.map((subItem: any, subIndex: number) => {
                            const isSubActive = isHrefActive(subItem.href);
                            const showQaBadge =
                              qaUnansweredCount > 0 &&
                              typeof subItem?.label === 'string' &&
                              subItem.label.toLowerCase() === 'q&a';
                            return (
                              <li key={`${subItem.href}-${subItem.label || subIndex}`} className="relative">
                                <Link
                                  href={subItem.href}
                                  onClick={() => onNavigate(subItem.href)} // Auto close on mobile + show loading
                                  className={twMerge(
                                    "block px-4 py-2 rounded-md transition-colors text-sm ml-4 relative truncate flex items-center gap-2",
                                    isSubActive 
                                      ? "text-white font-medium bg-indigo-600/10" 
                                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                                  )}
                                >
                                  {subItem.label}
                                  {showQaBadge ? (
                                    <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                                      {qaBadgeText}
                                    </span>
                                  ) : null}
                                </Link>
                                {isSubActive && (
                                  <span className="w-2 h-2 rounded-full bg-indigo-500 absolute left-[1.01rem] top-1/2 -translate-y-1/2 ring-4 ring-slate-900 shadow-[0_0_8px_rgba(99,102,241,0.8)] z-10"></span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <Link
                      href={link.href}
                      onClick={() => onNavigate(link.href)} // Auto close on mobile + show loading
                      className={twMerge(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden",
                        isActive 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" 
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      )}
                      title={sidebarCollapsed ? link.label : undefined}
                    >
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-500 opacity-100 -z-10" />
                      )}
                      {Icon && <Icon className={twMerge("w-5 h-5 transition-colors flex-shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />}
                      <span 
                        className={clsx(
                          "font-medium text-sm transition-all duration-200 whitespace-nowrap",
                          sidebarCollapsed ? "md:opacity-0 md:w-0 md:hidden" : "opacity-100"
                        )}
                      >
                        {link.label}
                      </span>
                      {qaUnansweredCount > 0 &&
                      typeof link?.label === 'string' &&
                      link.label.toLowerCase() === 'q&a' &&
                      !sidebarCollapsed ? (
                        <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                          {qaBadgeText}
                        </span>
                      ) : null}
                      {qaUnansweredCount > 0 &&
                      typeof link?.label === 'string' &&
                      link.label.toLowerCase() === 'q&a' &&
                      sidebarCollapsed ? (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-slate-900" />
                      ) : null}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* Footer User Profile */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky bottom-0">
          {(() => {
            const profileHref = '/dashboard/profile';
            return (
          <Link
            href={profileHref}
            onClick={() => onNavigate(profileHref)}
            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors overflow-hidden"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {user?.name?.[0] || role[0]}
            </div>
            <div 
              className={clsx(
                "flex-1 min-w-0 transition-all duration-200",
                sidebarCollapsed ? "md:opacity-0 md:w-0 md:hidden" : "opacity-100"
              )}
            >
              <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email || ''}</p>
            </div>
            {!sidebarCollapsed && (
              <Settings className="w-4 h-4 text-slate-500 hover:text-white transition-colors flex-shrink-0" />
            )}
          </Link>
            );
          })()}
          {!sidebarCollapsed && (
            <div className="text-[10px] text-slate-600 text-center mt-4 font-medium tracking-widest uppercase">
              &copy; 2026 GeoSains LMS
            </div>
          )}
        </div>
      </aside>
  );
}
