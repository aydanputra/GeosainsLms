import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LessonViewer from '../components/LessonViewer';
import QuizPlayer from '../components/QuizPlayer';
import ProgressTracker from '../components/ProgressTracker';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('Course Player Components', () => {
  const renderWithQuery = (ui: ReactNode) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ score: 100, passed: true, attemptCount: 1 }),
    } as any);
  });

  describe('LessonViewer', () => {
    it('should render video when type is VIDEO', () => {
      const lesson = {
        id: '1',
        title: 'Intro Video',
        type: 'VIDEO',
        content: null,
        videoId: '123',
      };
      renderWithQuery(<LessonViewer lesson={lesson} onComplete={vi.fn()} />);
      const iframe = screen.getByTitle('Intro Video');
      expect(iframe).toBeDefined();
      expect(iframe.getAttribute('src')).toContain('embed/123');
    });

    it('should render content when present', () => {
      const lesson = {
        id: '1',
        title: 'Text Lesson',
        type: 'TEXT',
        content: '<p>Hello World</p>',
        videoId: null,
      };
      renderWithQuery(<LessonViewer lesson={lesson} onComplete={vi.fn()} />);
      expect(screen.getByText('Hello World')).toBeDefined();
    });
  });

  describe('QuizPlayer', () => {
    const quiz = {
      id: 'q1',
      lessonId: 'l1',
      questions: [
        {
          id: '1',
          text: 'What is 1+1?',
          options: [
            { id: 'o1', text: '1', order: 1 },
            { id: 'o2', text: '2', order: 2 },
          ],
        },
      ],
    };

    it('should submit quiz and render server score', async () => {
      const onComplete = vi.fn().mockResolvedValue(undefined);
      render(<QuizPlayer courseId="c1" quiz={quiz as any} onComplete={onComplete} />);
      
      // Select correct answer (index 1)
      fireEvent.click(screen.getByText('2'));
      fireEvent.click(screen.getByText('Submit Quiz'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/courses/c1/lessons/l1/quiz',
          expect.objectContaining({ method: 'POST' })
        );
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith({ score: 100, passed: true });
      });

      expect(await screen.findByText('Skor Anda: 100%')).toBeDefined();
    });

    it('should submit multi-correct answers as array', async () => {
      const onComplete = vi.fn().mockResolvedValue(undefined);
      const multiQuiz = {
        id: 'q2',
        lessonId: 'l2',
        questions: [
          {
            id: 'q',
            text: 'Select all correct options',
            multipleCorrect: true,
            options: [
              { id: 'a', text: 'A', order: 1 },
              { id: 'b', text: 'B', order: 2 },
              { id: 'c', text: 'C', order: 3 },
            ],
          },
        ],
      };

      render(<QuizPlayer courseId="c1" quiz={multiQuiz as any} onComplete={onComplete} />);

      fireEvent.click(screen.getAllByRole('button', { name: /A/ })[0]);
      fireEvent.click(screen.getAllByRole('button', { name: /C/ })[0]);
      fireEvent.click(screen.getByText('Submit Quiz'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const body = (global.fetch as any).mock.calls[0][1].body;
      const parsed = JSON.parse(body);
      expect(parsed.answers).toEqual([[0, 2]]);
    });
  });

  describe('ProgressTracker', () => {
    it('should display correct percentage', () => {
      render(<ProgressTracker completedLessons={1} totalLessons={2} currentLessonTitle="Lesson 2" />);
      expect(screen.getByText('50%')).toBeDefined();
      expect(screen.getByText('1/2')).toBeDefined();
    });
  });
});
