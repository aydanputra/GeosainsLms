import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminShop from './AdminShop';

describe('AdminShop Component', () => {
  const mockProducts = [
    { id: '1', name: 'Buku Geologi', price: 150000, stock: 10 },
    { id: '2', name: 'Palu Geologi', price: 350000, stock: 0 },
  ];

  it('renders product list correctly', () => {
    render(<AdminShop products={mockProducts} />);
    expect(screen.getByText('Buku Geologi')).toBeDefined();
    expect(screen.getByText('Palu Geologi')).toBeDefined();
    expect(screen.getByText('Habis')).toBeDefined();
  });

  it('filters products by search', () => {
    render(<AdminShop products={mockProducts} />);
    const searchInput = screen.getByPlaceholderText('Cari produk...');
    
    fireEvent.change(searchInput, { target: { value: 'Palu' } });
    expect(screen.getByText('Palu Geologi')).toBeDefined();
    expect(screen.queryByText('Buku Geologi')).toBeNull();
  });

  it('handles delete action', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockImplementation(() => true);
    const alertSpy = vi.spyOn(window, 'alert');
    alertSpy.mockImplementation(() => {});

    render(<AdminShop products={mockProducts} />);
    const deleteButtons = screen.getAllByText('Hapus');
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Produk berhasil dihapus (simulasi)');
  });
});
