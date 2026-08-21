import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../components/Sidebar';
import Cards from '../components/Cards';
import Table from '../components/Tables';
import { useDashboardStore } from '../store/useDashboardStore';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/admin',
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

describe('Dashboard Components', () => {
  beforeEach(() => {
    useDashboardStore.setState({ sidebarOpen: true, user: { id: '1', name: 'Admin', email: 'admin@test.com', role: 'ADMIN' } });
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  describe('Sidebar', () => {
    it('should render admin links correctly', () => {
      render(<Sidebar role="ADMIN" />);
      expect(screen.getByText('Beranda')).toBeDefined();
      expect(screen.getByText('Manajemen Kursus')).toBeDefined();
      expect(screen.getAllByText('User').length).toBeGreaterThan(0);
    });

    it('should render article menu for super admin', () => {
      useDashboardStore.setState({
        sidebarOpen: true,
        user: { id: '1', name: 'Super Admin', email: 'superadmin@test.com', role: 'ADMIN', isSuperAdmin: true },
      });
      render(<Sidebar role="ADMIN" />);
      expect(screen.getByText('Artikel')).toBeDefined();
    });

    it('should render mentor links correctly', () => {
      render(<Sidebar role="MENTOR" />);
      expect(screen.getByText('Dashboard')).toBeDefined();
      expect(screen.getByText('Mentor')).toBeDefined();
      fireEvent.click(screen.getByText('Mentor'));
      expect(screen.getByText('Kursus Saya')).toBeDefined();
    });
  });

  describe('Cards', () => {
    it('should render metrics correctly', () => {
      const metrics = [
        { label: 'Total Users', value: 100 },
        { label: 'Revenue', value: '$5000' },
      ];
      render(<Cards metrics={metrics} />);
      expect(screen.getByText('Total Users')).toBeDefined();
      expect(screen.getByText('100')).toBeDefined();
      expect(screen.getByText('Revenue')).toBeDefined();
      expect(screen.getByText('$5000')).toBeDefined();
    });

    it('should show loading state', () => {
      const { container } = render(<Cards metrics={[]} isLoading={true} />);
      expect(container.getElementsByClassName('animate-pulse').length).toBe(4);
    });
  });

  describe('Table', () => {
    const columns = [
      { header: 'Name', accessorKey: 'name' },
      { header: 'Role', accessorKey: 'role' },
    ];
    const data = [
      { name: 'John Doe', role: 'Admin' },
      { name: 'Jane Smith', role: 'User' },
    ];

    it('should render table with data', () => {
      render(<Table columns={columns} data={data} />);
      expect(screen.getByText('John Doe')).toBeDefined();
      expect(screen.getByText('Jane Smith')).toBeDefined();
      expect(screen.getByText('Name')).toBeDefined();
    });

    it('should render actions if provided', () => {
      const onDetail = vi.fn();
      render(
        <Table
          columns={columns}
          data={data}
          actions={(row) => <button onClick={() => onDetail(row)}>Detail</button>}
        />
      );
      const detailButtons = screen.getAllByText('Detail');
      expect(detailButtons.length).toBe(2);
      fireEvent.click(detailButtons[0]);
      expect(onDetail).toHaveBeenCalledWith(data[0]);
    });
  });
});
