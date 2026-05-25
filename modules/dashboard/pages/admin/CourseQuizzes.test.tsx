import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseQuizzes from './CourseQuizzes';

describe('CourseQuizzes Component', () => {
  const mockQuizzes = [
    { id: 'q1', title: 'Quiz Modul 1', questionCount: 10 },
    { id: 'q2', title: 'Quiz Akhir', questionCount: 25 },
  ];

  it('renders quiz list', () => {
    render(<CourseQuizzes courseId="c1" quizzes={mockQuizzes} />);
    expect(screen.getByText('Daftar Quiz Kursus')).toBeDefined();
    expect(screen.getByText('Quiz Modul 1')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
  });

  it('renders action buttons', () => {
    render(<CourseQuizzes courseId="c1" quizzes={mockQuizzes} />);
    expect(screen.getAllByText('Lihat Soal')).toBeDefined();
    expect(screen.getAllByText('Edit')).toBeDefined();
    expect(screen.getAllByText('Hapus')).toBeDefined();
  });
});
