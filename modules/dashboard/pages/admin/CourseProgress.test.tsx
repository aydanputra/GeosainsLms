import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CourseProgress from './CourseProgress';

describe('CourseProgress Component', () => {
  const mockProgress = [
    { id: 's1', studentName: 'Budi Santoso', email: 'budi@test.com', progress: 100, completed: true },
    { id: 's2', studentName: 'Siti Aminah', email: 'siti@test.com', progress: 50, completed: false },
  ];

  it('renders student list', () => {
    render(<CourseProgress progressData={mockProgress} />);
    expect(screen.getAllByText('Budi Santoso').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Siti Aminah').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Selesai').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Berjalan').length).toBeGreaterThan(0);
  });

  it('shows certificate button only for completed students', () => {
    render(<CourseProgress progressData={mockProgress} />);
    expect(screen.getAllByText('Lihat Sertifikat')).toHaveLength(2);
    expect(screen.getByText('Belum Selesai')).toBeDefined();
  });

  it('handles certificate generation', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<CourseProgress progressData={mockProgress} />);
    
    fireEvent.click(screen.getAllByText('Lihat Sertifikat')[0]);
    expect(alertSpy).toHaveBeenCalledWith('Sertifikat berhasil dibuat (simulasi)');
  });
});
