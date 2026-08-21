"use client";

import Link from 'next/link';
import Cards from '../../components/Cards';
import Table from '../../components/Tables';
import { useAdminStats, useAdminOrders } from '../../api/service';
import { useDashboardStore } from '../../store/useDashboardStore';
import { BookOpen, Users, ShoppingBag, ShoppingCart, BarChart2, ArrowRight, Clock, Zap, Settings, DollarSign, Eye, Globe, CircleUser, FileText } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface AdminDashboardProps {
  stats: {
    totalUsers: number;
    totalCourses: number;
    totalOrders: number;
    revenue: number;
    netSalesTotal?: number;
    marketplaceFeeTotal?: number;
    activeStudents: number;
    pendingWithdrawals: number;
  };
  orders: any[];
}

export default function AdminDashboard({ stats: initialStats, orders: initialOrders }: AdminDashboardProps) {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: orders, isLoading: ordersLoading } = useAdminOrders();
  const { user } = useDashboardStore();

  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const ordersHref = '/dashboard/admin/sales/orders';

  const displayedStats = stats || initialStats;
  const displayedOrders = orders || initialOrders;

  const metrics = [
    { label: 'Total Pengguna', value: displayedStats?.totalUsers || 0, color: 'bg-blue-500', description: 'Total pengguna terdaftar' },
    { label: 'Total Kursus', value: displayedStats?.totalCourses || 0, color: 'bg-green-500', description: 'Kursus tersedia' },
    { label: 'Total Pesanan', value: displayedStats?.totalOrders || 0, color: 'bg-yellow-500', description: 'Pesanan berhasil dibayar' },
    { label: 'Total Transaksi', value: `IDR ${displayedStats?.revenue?.toLocaleString('id-ID') || 0}`, color: 'bg-purple-500', description: 'Total transaksi (dibayar)' },
    { label: 'Fee Marketplace', value: `IDR ${Number(displayedStats?.marketplaceFeeTotal || 0).toLocaleString('id-ID')}`, color: 'bg-yellow-600', description: 'Komisi dari kursus & produk' },
    { label: 'Siswa Aktif', value: displayedStats?.activeStudents || 0, color: 'bg-indigo-500', description: 'Siswa dengan enrollment aktif' },
    { label: 'Penarikan Tertunda', value: displayedStats?.pendingWithdrawals || 0, color: 'bg-red-500', description: 'Permintaan penarikan afiliasi' },
  ];

  const orderColumns = [
    { header: 'ID Pesanan', accessorKey: 'id',
      cell: (val: string) => <span className="font-mono text-xs text-slate-500">{val.substring(0, 8)}...</span>
    },
    { header: 'Pengguna', accessorKey: 'userId',
      cell: (val: string) => <div className="font-medium text-slate-900">{val}</div>
    }, 
    { header: 'Total', accessorKey: 'total', cell: (val: number) => `IDR ${val.toLocaleString('id-ID')}` },
    { header: 'Status', accessorKey: 'status', 
      cell: (val: string) => (
        <span className={twMerge(
          "px-2.5 py-0.5 rounded-full text-xs font-medium border",
          val === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' : 
          val === 'PENDING' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
          'bg-slate-100 text-slate-600 border-slate-200'
        )}>
          {val === 'PAID' ? 'LUNAS' : val === 'PENDING' ? 'MENUNGGU' : val}
        </span>
      ) 
    },
  ];

  const quickLinks = isSuperAdmin
    ? [
        { label: 'Pengaturan Platform', href: '/dashboard/admin/settings', color: 'bg-blue-600', icon: Settings },
        { label: 'Manajemen Kursus', href: '/dashboard/admin/courses', color: 'bg-sky-600', icon: BookOpen },
        { label: 'Artikel', href: '/dashboard/admin/blog', color: 'bg-amber-600', icon: FileText },
        { label: 'Manajemen Vendor', href: '/dashboard/admin/shop/vendors', color: 'bg-emerald-600', icon: ShoppingBag },
        { label: 'Halaman / Situs', href: '/dashboard/admin/pages', color: 'bg-cyan-600', icon: Globe },
        { label: 'Profil Saya', href: '/dashboard/profile', color: 'bg-fuchsia-600', icon: CircleUser },
        { label: 'Audit Log', href: '/dashboard/admin/audit', color: 'bg-slate-700', icon: Eye },
        { label: 'Manajemen Pengguna', href: '/dashboard/admin/users', color: 'bg-indigo-600', icon: Users },
        { label: 'Manajemen Pesanan', href: ordersHref, color: 'bg-purple-600', icon: ShoppingCart },
        { label: 'Withdraw (Admin)', href: '/dashboard/admin/sales/withdraw', color: 'bg-teal-600', icon: DollarSign },
      ]
    : [
        { label: 'Manajemen Kursus', href: '/dashboard/admin/courses', color: 'bg-blue-600', icon: BookOpen },
        { label: 'Manajemen Pengguna', href: '/dashboard/admin/users', color: 'bg-indigo-600', icon: Users },
        { label: 'Order', href: ordersHref, color: 'bg-purple-600', icon: ShoppingCart },
        { label: 'Laporan & Analitik', href: '/dashboard/admin/reports', color: 'bg-teal-600', icon: BarChart2 },
      ];

  return (
    <div className="space-y-10 pb-12 max-w-[1600px] mx-auto">
      {/* Modern Hero Section */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-900 to-blue-600 border border-blue-800 shadow-sm p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-40"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 opacity-40"></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">
              {isSuperAdmin ? 'Super Admin Dashboard' : 'Dashboard Overview'}
            </h1>
            <p className="text-sm text-blue-100 max-w-2xl leading-snug line-clamp-1 sm:line-clamp-none">
              {isSuperAdmin
                ? `Selamat datang kembali, ${user?.name || 'Super Admin'}! Pantau transaksi dan kelola operasional platform.`
                : `Selamat datang kembali, ${user?.name || 'Admin'}! Kelola kursus, pantau siswa, dan analisis performa platform Anda.`}
            </p>
          </div>
        </div>
      </div>
      
      {/* Cards Statistik */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          <BarChart2 className="w-4 h-4" />
          Key Metrics
        </div>
        <Cards metrics={metrics} isLoading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 items-stretch">
        <div className="space-y-8 flex flex-col h-full">
          {/* Aktivitas Terbaru (Tabel Pesanan) */}
          <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6 flex-1 flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                <Clock className="w-4 h-4" />
                Aktivitas Terbaru
              </div>
              <Link href={ordersHref} className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-all">
                Lihat Semua <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="flex-1 bg-slate-50 rounded-2xl p-4">
              <Table 
                columns={orderColumns} 
                data={displayedOrders?.slice(0, 5) || []} 
                isLoading={ordersLoading}
              />
            </div>
          </div>
        </div>

        {/* Quick Actions & Insights */}
        <div className="space-y-8 flex flex-col h-full">
          {/* Quick Actions */}
          <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6 flex-1 flex flex-col">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 w-fit">
              <Zap className="w-4 h-4" />
              Quick Actions
            </div>
            <div className="flex flex-col gap-3 flex-1">
              {quickLinks.map((link, index) => {
                const Icon = link.icon;
                return (
                  <Link 
                    key={index} 
                    href={link.href}
                    className="group flex items-center gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all duration-200 border border-transparent hover:border-slate-200"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 text-sm">
                        {link.label}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Akses cepat menu {link.label.toLowerCase()}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
