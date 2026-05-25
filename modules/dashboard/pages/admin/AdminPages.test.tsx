import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminPages from './AdminPages';

describe('AdminPages Component', () => {
  const mockPages = [
    { id: '1', title: 'Tentang Kami', slug: 'about-us', published: true },
    { id: '2', title: 'Kebijakan Privasi', slug: 'privacy-policy', published: false },
  ];

  it('renders pages list correctly', () => {
    render(<AdminPages pages={mockPages} />);
    expect(screen.getByText('Tentang Kami')).toBeDefined();
    expect(screen.getByText('about-us')).toBeDefined();
    expect(screen.getByText('Terbit')).toBeDefined();
  });

  it('filters pages by search', () => {
    render(<AdminPages pages={mockPages} />);
    const searchInput = screen.getByPlaceholderText('Cari halaman...');
    
    fireEvent.change(searchInput, { target: { value: 'Kebijakan' } });
    expect(screen.getByText('Kebijakan Privasi')).toBeDefined();
    expect(screen.queryByText('Tentang Kami')).toBeNull();
  });

  it('handles delete action', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockImplementation(() => true);
    const alertSpy = vi.spyOn(window, 'alert');
    alertSpy.mockImplementation(() => {});

    render(<AdminPages pages={mockPages} />);
    const deleteButtons = screen.getAllByText('Hapus');
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Halaman berhasil dihapus (simulasi)');
  });
});
