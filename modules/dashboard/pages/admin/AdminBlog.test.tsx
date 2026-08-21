import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminBlog from './AdminBlog';

vi.mock('next/link', () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

describe('AdminBlog Component', () => {
  const mockPosts = [
    { id: '1', title: 'Belajar Geologi', authorName: 'Dr. Budi', published: true, slug: 'belajar-geologi' },
    { id: '2', title: 'Tips GIS', authorName: 'Siti MSc', published: false, slug: 'tips-gis' },
  ];

  it('renders blog list correctly', () => {
    render(<AdminBlog posts={mockPosts} categories={[]} tags={[]} />);
    expect(screen.getAllByText('Belajar Geologi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tips GIS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Terbit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
  });

  it('filters posts by search', () => {
    render(<AdminBlog posts={mockPosts} categories={[]} tags={[]} />);
    const searchInput = screen.getByPlaceholderText('Cari artikel...');
    
    fireEvent.change(searchInput, { target: { value: 'Tips' } });
    expect(screen.getAllByText('Tips GIS').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Belajar Geologi')).toHaveLength(0);
  });

  it('handles delete action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Post deleted' }),
    });
    (globalThis as any).fetch = fetchMock;

    render(<AdminBlog posts={mockPosts} categories={[]} tags={[]} />);
    const deleteButtons = screen.getAllByTitle('Hapus');
    fireEvent.click(deleteButtons[0]);

    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus' }).at(-1)!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/blog/posts/1', { method: 'DELETE' });
    });
    await waitFor(() => {
      expect(screen.queryAllByText('Belajar Geologi')).toHaveLength(0);
    });
  });
});
