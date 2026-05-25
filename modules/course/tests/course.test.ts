import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCourse, getCourses, submitQuiz, generateCertificate } from '../api/service';
import { prisma } from '@/utils/prisma';

// Mock dependencies
vi.mock('@/utils/prisma', () => ({
  prisma: {
    course: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    userProgress: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    certificate: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    quiz: {
      findUnique: vi.fn(),
    }
  },
}));

describe('Course Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCourse', () => {
    it('should create a course successfully', async () => {
      const mockCourse = {
        title: 'New Course',
        instructorId: 'user-1',
      };
      (prisma.course.create as any).mockResolvedValue({ id: '1', ...mockCourse });

      const result = await createCourse(mockCourse);

      expect(prisma.course.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id', '1');
    });
  });

  describe('submitQuiz', () => {
    it('should calculate score and save progress', async () => {
      const mockQuiz = {
        id: 'quiz-1',
        questions: [
          { id: 'q1', correctAnswer: 0 },
          { id: 'q2', correctAnswer: 1 },
        ],
      };
      (prisma.quiz.findUnique as any).mockResolvedValue(mockQuiz);
      (prisma.userProgress.findUnique as any).mockResolvedValue(null);
      (prisma.userProgress.create as any).mockResolvedValue({ completed: true, score: 100 });

      // Note: the implementation expects answers array. [0, 1] means Q1 answer is index 0, Q2 answer is index 1
      await submitQuiz('user-1', 'lesson-1', [0, 1]);

      expect(prisma.quiz.findUnique).toHaveBeenCalledWith({ where: { lessonId: 'lesson-1' }, include: { questions: true } });
      // Score should be 100% (2/2 correct)
      expect(prisma.userProgress.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ score: 100 })
      }));
    });
  });

  describe('generateCertificate', () => {
    it('should generate certificate if course completed', async () => {
      // Mock getCourseProgress logic implicitly or mock the function if possible.
      // Since getCourseProgress is exported from the same file, mocking it requires careful setup or testing the full flow.
      // Here we will mock the prisma calls inside getCourseProgress.
      
      const mockCourse = {
        id: 'course-1',
        modules: [
          { lessons: [{ id: 'l1' }] }
        ]
      };
      (prisma.course.findUnique as any).mockResolvedValue(mockCourse);
      (prisma.userProgress.findMany as any).mockResolvedValue([{ lessonId: 'l1', completed: true }]);
      (prisma.certificate.findUnique as any).mockResolvedValue(null);
      (prisma.certificate.create as any).mockResolvedValue({ code: 'CERT-123' });

      const result = await generateCertificate('user-1', 'course-1');

      expect(prisma.certificate.create).toHaveBeenCalled();
      expect(result).toHaveProperty('code', 'CERT-123');
    });

    it('should throw error if course not completed', async () => {
      const mockCourse = {
        id: 'course-1',
        modules: [
          { lessons: [{ id: 'l1' }] }
        ]
      };
      (prisma.course.findUnique as any).mockResolvedValue(mockCourse);
      (prisma.userProgress.findMany as any).mockResolvedValue([]); // No progress

      await expect(generateCertificate('user-1', 'course-1')).rejects.toThrow('Course not completed');
    });
  });
});
