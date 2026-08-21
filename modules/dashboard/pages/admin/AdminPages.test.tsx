import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminPages from './AdminPages';

describe('AdminPages Component', () => {
  const mockPages = [
    { id: '1', title: 'Tentang Kami', slug: 'about-us', published: true },
    { id: '2', title: 'Kebijakan Privasi', slug: 'privacy-policy', published: false },
  ];

  beforeEach(() => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/pages') {
        return Promise.resolve({ ok: true, json: async () => mockPages.slice(1) });
      }
      if (url === '/api/pages/1') {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('renders pages list correctly', () => {
    render(<AdminPages pages={mockPages} />);
    expect(screen.getAllByText('Tentang Kami').length).toBeGreaterThan(0);
    expect(screen.getAllByText('/about-us').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Terbit').length).toBeGreaterThan(0);
  });

  it('filters pages by search', () => {
    render(<AdminPages pages={mockPages} />);
    const searchInput = screen.getByPlaceholderText('Cari halaman...');
    
    fireEvent.change(searchInput, { target: { value: 'Kebijakan' } });
    expect(screen.getAllByText('Kebijakan Privasi').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Tentang Kami')).toHaveLength(0);
  });

  it('handles delete action', async () => {
    render(<AdminPages pages={mockPages} />);
    const deleteButtons = screen.getAllByTitle('Hapus');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus' }).at(-1)!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/pages/1', { method: 'DELETE' });
    });
    await waitFor(() => {
      expect(screen.queryAllByText('Tentang Kami')).toHaveLength(0);
    });
  });
});
