import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Topbar from '../components/Topbar';
import Sidebar from '../components/Sidebar';
import { useDashboardStore } from '../../dashboard/store/useDashboardStore';
import { useCartStore } from '../../shop/store/useCartStore';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/admin',
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
}));

describe('Layout Components', () => {
  beforeEach(() => {
    useDashboardStore.setState({ user: null });
    useCartStore.setState({ items: [] });
  });

  describe('Topbar', () => {
    it('should render navigation links', () => {
      render(<Topbar />);
      expect(screen.getByText('Dashboard')).toBeDefined();
      expect(screen.getByText('Courses')).toBeDefined();
      expect(screen.getByText('Shop')).toBeDefined();
    });

    it('should show login/register when logged out', () => {
      render(<Topbar />);
      expect(screen.getByText('Log in')).toBeDefined();
      expect(screen.getByText('Sign up')).toBeDefined();
    });

    it('should show user menu when logged in', () => {
      useDashboardStore.setState({ user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'STUDENT' } });
      render(<Topbar />);
      expect(screen.getByText('Test User')).toBeDefined();
    });

    it('should show cart count', () => {
      useCartStore.setState({ items: [{ id: 'line-1', productId: '1', name: 'P1', price: 10, quantity: 3, type: 'PHYSICAL' }] });
      render(<Topbar />);
      expect(screen.getByText('3')).toBeDefined();
    });
  });

  describe('Sidebar', () => {
    it('should not render if no user', () => {
      const { container } = render(<Sidebar />);
      expect(container.firstChild).toBeNull();
    });

    it('should render role-based links', () => {
      useDashboardStore.setState({ user: { id: '1', name: 'Admin', email: 'admin@test.com', role: 'ADMIN' } });
      render(<Sidebar />);
      expect(screen.getByText('Overview')).toBeDefined();
      expect(screen.getByText('Settings')).toBeDefined();
    });
  });
});
