import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CourseForm from './CourseForm';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('CourseForm Component', () => {
  const mockMentors = [
    { id: '1', name: 'Dr. Budi' },
    { id: '2', name: 'Siti MSc' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form elements correctly', () => {
    render(<CourseForm mentors={mockMentors} />);
    expect(screen.getByText('Tambah Kursus Baru')).toBeDefined();
    expect(screen.getByLabelText('Judul Kursus')).toBeDefined();
    expect(screen.getByLabelText('Deskripsi')).toBeDefined();
    expect(screen.getByLabelText('Mentor')).toBeDefined();
    expect(screen.getByLabelText('Harga (IDR)')).toBeDefined();
  });

  it('shows validation errors for invalid input', async () => {
    render(<CourseForm mentors={mockMentors} />);
    const submitButton = screen.getByText('Simpan Kursus');
    
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Judul kursus minimal 3 karakter')).toBeDefined();
      expect(screen.getByText('Deskripsi minimal 10 karakter')).toBeDefined();
      expect(screen.getByText('Wajib memilih mentor')).toBeDefined();
    });
  });

  it('submits form with valid data', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-course' }),
    });

    render(<CourseForm mentors={mockMentors} />);

    fireEvent.change(screen.getByLabelText('Judul Kursus'), { target: { value: 'Kursus Baru' } });
    fireEvent.change(screen.getByLabelText('Deskripsi'), { target: { value: 'Deskripsi kursus yang cukup panjang.' } });
    fireEvent.change(screen.getByLabelText('Mentor'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Harga (IDR)'), { target: { value: '100000' } });

    fireEvent.click(screen.getByText('Simpan Kursus'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/courses', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Kursus Baru')
      }));
    });
  });
});
