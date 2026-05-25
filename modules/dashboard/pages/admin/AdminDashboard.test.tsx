import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminDashboard from './AdminDashboard';

// Mock dependencies
vi.mock('../../api/service', () => ({
  useAdminStats: () => ({ data: null, isLoading: false }),
  useAdminOrders: () => ({ data: null, isLoading: false }),
}));

// Mock Link component since it's used in AdminDashboard
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('AdminDashboard Component', () => {
  const mockStats = {
    totalUsers: 100,
    totalCourses: 50,
    totalOrders: 200,
    revenue: 15000000,
    netSalesTotal: 12000000,
    marketplaceFeeTotal: 2500000,
    activeStudents: 80,
    pendingWithdrawals: 5,
  };

  const mockOrders = [
    { id: 'ORD-123', userId: 'User A', total: 50000, status: 'PAID' },
    { id: 'ORD-124', userId: 'User B', total: 75000, status: 'PENDING' },
  ];

  it('renders dashboard title correctly', () => {
    render(<AdminDashboard stats={mockStats} orders={mockOrders} />);
    expect(screen.getByText('Dashboard Overview')).toBeDefined();
  });

  it('renders statistics cards with correct values', () => {
    render(<AdminDashboard stats={mockStats} orders={mockOrders} />);
    expect(screen.getByText('Total Pengguna')).toBeDefined();
    expect(screen.getByText('100')).toBeDefined();
    expect(screen.getByText('Total Kursus')).toBeDefined();
    expect(screen.getByText('50')).toBeDefined();
    expect(screen.getByText('Total Transaksi')).toBeDefined();
    expect(screen.getByText('Fee Marketplace')).toBeDefined();
    // Check formatted currency (simplified check)
    expect(screen.getByText(/IDR/)).toBeDefined(); 
  });

  it('renders recent orders table', () => {
    render(<AdminDashboard stats={mockStats} orders={mockOrders} />);
    expect(screen.getByText('Aktivitas Terbaru')).toBeDefined();
    expect(screen.getByText('ORD-123')).toBeDefined();
    expect(screen.getByText('User A')).toBeDefined();
    expect(screen.getByText('LUNAS')).toBeDefined(); // 'PAID' is mapped to 'LUNAS'
  });

  it('renders quick links', () => {
    render(<AdminDashboard stats={mockStats} orders={mockOrders} />);
    expect(screen.getByText('Quick Actions')).toBeDefined();
    expect(screen.getByText('Manajemen Kursus')).toBeDefined();
    expect(screen.getByText('Manajemen Pengguna')).toBeDefined();
    expect(screen.getByText('Order')).toBeDefined();
  });
});
