import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CourseDetail from './CourseDetail';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('CourseDetail Component', () => {
  const mockCourse = {
    id: 'course-1',
    title: 'Kursus Geologi',
    modules: [
      {
        id: 'mod-1',
        title: 'Pengenalan',
        order: 1,
        lessons: [
          { id: 'less-1', title: 'Video Intro', type: 'VIDEO' as const, order: 1 },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders course title and modules', () => {
    render(<CourseDetail course={mockCourse} />);
    expect(screen.getByText('Kursus Geologi - Kurikulum')).toBeDefined();
    expect(screen.getByText('Pengenalan')).toBeDefined();
    expect(screen.getByText('Video Intro')).toBeDefined();
  });

  it('shows add module form when button clicked', () => {
    render(<CourseDetail course={mockCourse} />);
    fireEvent.click(screen.getByText('+ Tambah Modul'));
    expect(screen.getByPlaceholderText('Contoh: Pengenalan Geologi')).toBeDefined();
  });

  it('adds a new module', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-mod', title: 'Modul Baru', order: 2 }),
    });

    render(<CourseDetail course={mockCourse} />);
    fireEvent.click(screen.getByText('+ Tambah Modul'));
    
    const input = screen.getByPlaceholderText('Contoh: Pengenalan Geologi');
    fireEvent.change(input, { target: { value: 'Modul Baru' } });
    fireEvent.click(screen.getByText('Simpan'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/courses/course-1/modules',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Modul Baru'),
        })
      );
    });
  });

  it('deletes a module', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true });
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockImplementation(() => true);

    render(<CourseDetail course={mockCourse} />);
    const deleteBtn = screen.getAllByText('Hapus')[0]; // First delete button (module)
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/courses/course-1/modules/mod-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
