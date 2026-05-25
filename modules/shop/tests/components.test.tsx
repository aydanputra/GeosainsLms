import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductCard from '../components/ProductCard';
import CartList from '../components/CartList';
import CheckoutSummary from '../components/CheckoutSummary';
import { useCartStore } from '../store/useCartStore';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

describe('Shop Components', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  describe('ProductCard', () => {
    const product = {
      id: '1',
      name: 'Test Product',
      description: 'Desc',
      price: 10000,
      imageUrl: null,
    };

    it('should render product details', () => {
      render(<ProductCard product={product} />);
      expect(screen.getByText('Test Product')).toBeDefined();
      expect(screen.getByText(/IDR\s*10[.,]000/)).toBeDefined();
    });

    it('should add to cart', () => {
      render(<ProductCard product={product} />);
      fireEvent.click(screen.getByLabelText('Tambah ke Keranjang'));
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].quantity).toBe(1);
    });
  });

  describe('CartList', () => {
    it('should show empty message when cart is empty', () => {
      render(<CartList />);
      expect(screen.getByText('Keranjang masih kosong')).toBeDefined();
    });

    it('should list items and update quantity', () => {
      useCartStore.setState({
        items: [{ id: 'line-1', productId: '1', name: 'P1', price: 100, quantity: 1, type: 'PHYSICAL' }],
      });
      render(<CartList />);
      
      expect(screen.getByText('P1')).toBeDefined();
      
      fireEvent.click(screen.getByLabelText('Tambah jumlah'));
      expect(useCartStore.getState().items[0].quantity).toBe(2);
      
      fireEvent.click(screen.getByText('Hapus'));
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('CheckoutSummary', () => {
    it('should calculate total correctly', () => {
      useCartStore.setState({
        items: [{ id: 'line-1', productId: '1', name: 'P1', price: 1000, quantity: 2, type: 'PHYSICAL' }],
      });
      render(<CheckoutSummary />);
      const totalElements = screen.getAllByText('IDR 2,000');
      expect(totalElements.length).toBeGreaterThan(0);
    });
  });
});
