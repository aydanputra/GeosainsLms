import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminCourses from './AdminCourses';

describe('AdminCourses Component', () => {
  const mockCourses = [
    { id: '1', title: 'Kursus Geologi', slug: 'kursus-geologi', instructorName: 'Dr. Budi', price: 500000, status: 'PUBLISHED', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: '2', title: 'Kursus GIS', slug: 'kursus-gis', instructorName: 'Siti MSc', price: 750000, status: 'DRAFT', createdAt: '2026-01-02T00:00:00.000Z' },
  ];

  beforeEach(() => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders course list correctly', () => {
    render(<AdminCourses courses={mockCourses} bundles={[]} />);
    expect(screen.getAllByText('Kursus Geologi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dr. Budi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aktif').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
  });

  it('filters courses by status', () => {
    render(<AdminCourses courses={mockCourses} bundles={[]} />);
    const filterSelect = screen.getAllByRole('combobox')[1];
    
    // Filter Published
    fireEvent.change(filterSelect, { target: { value: 'PUBLISHED' } });
    expect(screen.getAllByText('Kursus Geologi').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Kursus GIS')).toHaveLength(0);

    // Filter Draft
    fireEvent.change(filterSelect, { target: { value: 'DRAFT' } });
    expect(screen.queryAllByText('Kursus Geologi')).toHaveLength(0);
    expect(screen.getAllByText('Kursus GIS').length).toBeGreaterThan(0);
  });

  it('searches courses by title', () => {
    render(<AdminCourses courses={mockCourses} bundles={[]} />);
    const searchInput = screen.getByPlaceholderText('Cari kursus / bundel...');
    
    fireEvent.change(searchInput, { target: { value: 'GIS' } });
    expect(screen.queryAllByText('Kursus Geologi')).toHaveLength(0);
    expect(screen.getAllByText('Kursus GIS').length).toBeGreaterThan(0);
  });

  it('shows delete confirmation', async () => {
    render(<AdminCourses courses={mockCourses} bundles={[]} />);
    const deleteButtons = screen.getAllByTitle('Hapus');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/courses/1', { method: 'DELETE' });
    });
    await waitFor(() => {
      expect(screen.queryAllByText('Kursus Geologi')).toHaveLength(0);
    });
    expect(window.alert).toHaveBeenCalledWith('Kursus berhasil dihapus');
  });
});
