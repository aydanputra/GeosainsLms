"use client";

import { twMerge } from 'tailwind-merge';
import {
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  ShoppingCart,
  Wallet,
  UserCheck,
  AlertCircle,
  HelpCircle,
  Layers,
  ShoppingBag,
  FileText,
  PackageCheck,
  HandCoins,
  BarChart2,
  BadgePercent,
  Percent,
  Package,
} from 'lucide-react';

interface Metric {
  label: string;
  value: string | number;
  description?: string;
  color?: string; // e.g. 'bg-blue-500'
  trend?: {
    value: number; // percentage
    isPositive: boolean;
  };
  icon?: any;
}

interface CardsProps {
  metrics: Metric[];
  isLoading?: boolean;
}

// Map labels to specific icons if not provided
const getIcon = (label: string) => {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('pengguna') || lowerLabel.includes('users')) return Users;
  if (lowerLabel.includes('bundel') || lowerLabel.includes('bundle')) return Layers;
  if (lowerLabel.includes('kursus') || lowerLabel.includes('courses')) return BookOpen;
  if (lowerLabel.includes('siswa aktif') || lowerLabel.includes('active students')) return UserCheck;
  if (lowerLabel.includes('siswa') || lowerLabel.includes('students')) return Users;
  if (lowerLabel.includes('artikel') || lowerLabel.includes('post')) return FileText;
  if (lowerLabel.includes('produk terjual') || lowerLabel.includes('terjual') || lowerLabel.includes('sold')) return PackageCheck;
  if (lowerLabel.includes('produk') || lowerLabel.includes('products')) return ShoppingBag;
  if (lowerLabel.includes('fee platform') || lowerLabel.includes('platform fee')) return HandCoins;
  if (lowerLabel.includes('pesanan') || lowerLabel.includes('orders') || lowerLabel.includes('order')) return ShoppingCart;
  if (lowerLabel.includes('penjualan') || lowerLabel.includes('sales')) return BarChart2;
  if (lowerLabel.includes('komisi') || lowerLabel.includes('commission')) return Percent;
  if (lowerLabel.includes('diskon') || lowerLabel.includes('discount')) return BadgePercent;
  if (lowerLabel.includes('stok')) return Package;
  if (lowerLabel.includes('pendapatan') || lowerLabel.includes('revenue')) return Wallet;
  if (lowerLabel.includes('penarikan') || lowerLabel.includes('withdrawals') || lowerLabel.includes('withdraw')) return AlertCircle;
  return HelpCircle;
};

export default function Cards({ metrics, isLoading }: CardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 animate-pulse h-32">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
            <div className="h-8 bg-slate-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
      {metrics.map((metric, index) => {
        const Icon = metric.icon || getIcon(metric.label);
        const baseColor = metric.color || 'bg-indigo-500';
        
        // Extract color classes for gradient
        // Assuming format like 'bg-blue-500'
        const colorName = baseColor.replace('bg-', '').split('-')[0];
        const colorWeight = baseColor.split('-')[1] || '500';
        void colorWeight;
        const lowerLabel = metric.label.toLowerCase();
        const isRevenue = lowerLabel.includes('pendapatan') || lowerLabel.includes('revenue');

        return (
          <div 
            key={index} 
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 p-4 sm:p-6"
          >
            {/* Subtle Gradient Accent Background */}
            <div className={twMerge(
              "absolute top-0 right-0 p-16 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3",
              baseColor
            )}></div>

            <div className="flex items-center justify-between gap-4 relative z-10">
              <div className="flex-1 min-w-0">
                 {/* Title */}
                <p className="text-sm text-slate-700 font-semibold truncate mb-1">{metric.label}</p>
                
                {/* Value */}
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-slate-900 truncate">
                  {metric.value}
                </h3>
                
                {/* Description / Trend */}
                {(metric.description || metric.trend) && (
                  <div className="flex items-center gap-2 mt-1 sm:mt-2">
                    {metric.trend && (
                      <span className={twMerge(
                        "text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1",
                        metric.trend.isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        {metric.trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(metric.trend.value)}%
                      </span>
                    )}
                    {metric.description && (
                      <span className="text-xs text-slate-600 truncate max-w-full">{metric.description}</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Icon Container */}
              <div className={twMerge(
                "flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 group-hover:rotate-3",
                isRevenue ? 'bg-gradient-to-br from-green-50 to-green-100/50 text-green-600' : `bg-gradient-to-br from-${colorName}-50 to-${colorName}-100/50`,
                isRevenue ? '' : `text-${colorName}-600`
              )}>
                 <Icon className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
