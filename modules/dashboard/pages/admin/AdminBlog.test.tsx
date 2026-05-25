import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminBlog from './AdminBlog';

vi.mock('next/link', () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

describe('AdminBlog Component', () => {
  const mockPosts = [
    { id: '1', title: 'Belajar Geologi', authorName: 'Dr. Budi', published: true },
    { id: '2', title: 'Tips GIS', authorName: 'Siti MSc', published: false },
  ];

  it('renders blog list correctly', () => {
    render(<AdminBlog posts={mockPosts} />);
    expect(screen.getByText('Belajar Geologi')).toBeDefined();
    expect(screen.getByText('Tips GIS')).toBeDefined();
    expect(screen.getByText('Terbit')).toBeDefined();
    expect(screen.getByText('Draft')).toBeDefined();
  });

  it('filters posts by search', () => {
    render(<AdminBlog posts={mockPosts} />);
    const searchInput = screen.getByPlaceholderText('Cari artikel...');
    
    fireEvent.change(searchInput, { target: { value: 'Tips' } });
    expect(screen.getByText('Tips GIS')).toBeDefined();
    expect(screen.queryByText('Belajar Geologi')).toBeNull();
  });

  it('handles delete action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Post deleted' }),
    });
    (globalThis as any).fetch = fetchMock;

    render(<AdminBlog posts={mockPosts} />);
    const deleteButtons = screen.getAllByText('Hapus');
    fireEvent.click(deleteButtons[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/blog/posts/1', { method: 'DELETE' });
    });
    await waitFor(() => {
      expect(screen.queryByText('Belajar Geologi')).toBeNull();
    });
  });
});
