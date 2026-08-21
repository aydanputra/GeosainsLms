import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminShop from './AdminShop';

describe('AdminShop Component', () => {
  const mockProducts = [
    { id: '1', name: 'Buku Geologi', price: 150000, stock: 10, sold: 0, revenue: 0, category: 'BOOKS', vendorId: 'v1' },
    { id: '2', name: 'Palu Geologi', price: 350000, stock: 0, sold: 0, revenue: 0, category: 'MERCH', vendorId: 'v1' },
  ];

  beforeEach(() => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.startsWith('/api/shop/products/')) {
        return Promise.resolve({ ok: true, json: async () => ({ message: 'Produk berhasil dihapus' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('renders product list correctly', () => {
    render(<AdminShop products={mockProducts} initialVendors={[{ id: 'v1', name: 'Vendor A' }]} />);
    expect(screen.getAllByText('Buku Geologi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Palu Geologi').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Stok:\s*0|0 Unit/).length).toBeGreaterThan(0);
  });

  it('filters products by search', () => {
    render(<AdminShop products={mockProducts} initialVendors={[{ id: 'v1', name: 'Vendor A' }]} />);
    const searchInput = screen.getByPlaceholderText('Cari produk...');
    
    fireEvent.change(searchInput, { target: { value: 'Palu' } });
    expect(screen.getAllByText('Palu Geologi').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Buku Geologi')).toHaveLength(0);
  });

  it('handles delete action', async () => {
    render(<AdminShop products={mockProducts} initialVendors={[{ id: 'v1', name: 'Vendor A' }]} />);
    const deleteButtons = screen.getAllByTitle('Hapus');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus' }).at(-1)!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/shop/products/1', { method: 'DELETE' });
    });
    await waitFor(() => {
      expect(screen.queryAllByText('Buku Geologi')).toHaveLength(0);
    });
  });
});
