import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CourseDetail from './CourseDetail';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: any) => <div>{children}</div>,
  Droppable: ({ children }: any) => children({ innerRef: vi.fn(), droppableProps: {}, placeholder: null }),
  Draggable: ({ children }: any) => children({ innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} }),
}));

describe('CourseDetail Component', () => {
  const mockCourse = {
    id: 'course-1',
    title: 'Kursus Geologi',
    description: 'Belajar geologi dasar',
    instructorId: 'mentor-1',
    price: 100000,
    status: 'DRAFT',
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
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'ok' }),
    }) as any;
  });

  it('renders course title and admin tabs', () => {
    render(<CourseDetail course={mockCourse} mentors={[{ id: 'mentor-1', name: 'Dr. Budi' }]} />);

    expect(screen.getByText('Kursus Geologi')).toBeDefined();
    expect(screen.getByText('Kelola konten dan pengaturan kursus Anda.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Informasi Dasar' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Kurikulum' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Pengaturan' })).toBeDefined();
  });

  it('shows curriculum modules after switching tabs', () => {
    render(<CourseDetail course={mockCourse} mentors={[{ id: 'mentor-1', name: 'Dr. Budi' }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Kurikulum' }));

    expect(screen.getByText('Susunan Kurikulum')).toBeDefined();
    expect(screen.getByText('Pengenalan')).toBeDefined();
    expect(screen.getByText('Video Intro')).toBeDefined();
  });

  it('adds a new module', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-mod', title: 'Modul Baru', order: 2 }),
    });

    render(<CourseDetail course={mockCourse} mentors={[{ id: 'mentor-1', name: 'Dr. Budi' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kurikulum' }));
    fireEvent.click(screen.getByText('Tambah Modul'));

    const input = screen.getByPlaceholderText('Contoh: Pengenalan Geologi Dasar');
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

  it('deletes a lesson from curriculum', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true });

    render(<CourseDetail course={mockCourse} mentors={[{ id: 'mentor-1', name: 'Dr. Budi' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kurikulum' }));

    const deleteBtn = screen.getByTitle('Hapus Pelajaran');
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/courses/course-1/lessons/less-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
