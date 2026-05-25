import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminCourses from './AdminCourses';

describe('AdminCourses Component', () => {
  const mockCourses = [
    { id: '1', title: 'Kursus Geologi', instructorName: 'Dr. Budi', price: 500000, published: true },
    { id: '2', title: 'Kursus GIS', instructorName: 'Siti MSc', price: 750000, published: false },
  ];

  it('renders course list correctly', () => {
    render(<AdminCourses courses={mockCourses} />);
    expect(screen.getByText('Kursus Geologi')).toBeDefined();
    expect(screen.getByText('Dr. Budi')).toBeDefined();
    expect(screen.getByText('Terbit')).toBeDefined();
    expect(screen.getByText('Draft')).toBeDefined();
  });

  it('filters courses by status', () => {
    render(<AdminCourses courses={mockCourses} />);
    const filterSelect = screen.getByRole('combobox');
    
    // Filter Published
    fireEvent.change(filterSelect, { target: { value: 'PUBLISHED' } });
    expect(screen.getByText('Kursus Geologi')).toBeDefined();
    expect(screen.queryByText('Kursus GIS')).toBeNull();

    // Filter Draft
    fireEvent.change(filterSelect, { target: { value: 'DRAFT' } });
    expect(screen.queryByText('Kursus Geologi')).toBeNull();
    expect(screen.getByText('Kursus GIS')).toBeDefined();
  });

  it('searches courses by title', () => {
    render(<AdminCourses courses={mockCourses} />);
    const searchInput = screen.getByPlaceholderText('Cari kursus...');
    
    fireEvent.change(searchInput, { target: { value: 'GIS' } });
    expect(screen.queryByText('Kursus Geologi')).toBeNull();
    expect(screen.getByText('Kursus GIS')).toBeDefined();
  });

  it('shows delete confirmation', () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockImplementation(() => true);
    const alertSpy = vi.spyOn(window, 'alert');
    alertSpy.mockImplementation(() => {});

    render(<AdminCourses courses={mockCourses} />);
    const deleteButtons = screen.getAllByText('Hapus');
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Kursus berhasil dihapus (simulasi)');
  });
});
