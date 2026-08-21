import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CourseForm from './CourseForm';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('@/components/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Deskripsi Lengkap Editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@/hooks/useAutosave', () => ({
  useAutosave: () => ({
    status: 'idle',
    lastSavedTime: null,
    updateData: vi.fn(),
    save: vi.fn().mockResolvedValue(true),
    retry: vi.fn(),
  }),
}));

describe('CourseForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/me') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ user: { role: 'ADMIN' } }),
        } as Response);
      }

      if (url === '/api/categories') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 'cat-1', name: 'Geologi' }],
        } as Response);
      }

      if (url === '/api/users?role=MENTOR') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 'mentor-1', name: 'Dr. Budi', role: 'MENTOR' }],
        } as Response);
      }

      if (url === '/api/users?role=ADMIN') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }

      if (url === '/api/dashboard/admin/course-reports?tab=courses&limit=200') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ courses: [] }),
        } as Response);
      }

      if (url === '/api/course-settings') {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        } as Response);
      }

      if (url === '/api/courses') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'new-course', title: 'Kursus Geologi Dasar' }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response);
    }) as any;
  });

  it('renders wizard shell and current step fields', async () => {
    render(<CourseForm />);

    expect(await screen.findByText('Buat Kursus Baru')).toBeDefined();
    expect(screen.getAllByText('Informasi Dasar').length).toBeGreaterThan(0);
    expect(screen.getByText('Media & Preview')).toBeDefined();
    expect(screen.getByText('Review & Publish')).toBeDefined();
    expect(screen.getByText('Judul Kursus')).toBeDefined();
    expect(screen.getByText('Deskripsi Lengkap')).toBeDefined();
    expect(screen.getByText('Mentor / Instruktur')).toBeDefined();
    expect(screen.getByText('Kategori')).toBeDefined();
  });

  it('shows validation errors for invalid input', async () => {
    render(<CourseForm />);

    fireEvent.click(await screen.findByText('Lanjut'));

    await waitFor(() => {
      expect(screen.getByText('Judul minimal 5 karakter')).toBeDefined();
      expect(screen.getByText('Deskripsi minimal 20 karakter')).toBeDefined();
      expect(screen.getByText('Pilih minimal 1 kategori')).toBeDefined();
    });
  });

  it('submits first wizard step with valid data', async () => {
    render(<CourseForm />);

    fireEvent.change(await screen.findByPlaceholderText('Contoh: Geologi Dasar untuk Pemula'), {
      target: { value: 'Kursus Geologi Dasar' },
    });
    fireEvent.change(screen.getByLabelText('Deskripsi Lengkap Editor'), {
      target: { value: 'Deskripsi kursus geologi yang cukup panjang untuk lolos validasi.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pilih Kategori...' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Geologi' }));

    fireEvent.click(screen.getByText('Lanjut'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/courses', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Kursus Geologi Dasar'),
      }));
    });

    expect(window.scrollTo).toHaveBeenCalled();
  });
});
