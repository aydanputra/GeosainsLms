import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCourse, submitQuiz, generateCertificate } from '../api/service';
import { prisma } from '@/utils/prisma';

vi.mock('@/modules/certificates/api/service', () => ({
  issueCertificateIfEligible: vi.fn(),
}));

// Mock dependencies
vi.mock('@/utils/prisma', () => ({
  prisma: {
    page: {
      findUnique: vi.fn(),
    },
    course: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    lesson: {
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
    },
    quizAttempt: {
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('Course Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.page.findUnique as any).mockResolvedValue(null);
    (prisma.lesson.findUnique as any).mockResolvedValue({ id: 'lesson-1', module: { courseId: 'course-1' } });
    (prisma.quizAttempt.count as any).mockResolvedValue(0);
    (prisma.quizAttempt.create as any).mockResolvedValue({ id: 'attempt-1' });
    (prisma.$transaction as any).mockImplementation(async (callback: any) =>
      callback({
        quizAttempt: prisma.quizAttempt,
        userProgress: prisma.userProgress,
      })
    );
  });

  describe('createCourse', () => {
    it('should create a course successfully and sanitize description', async () => {
      const mockCourse = {
        title: 'New Course',
        instructorId: 'user-1',
        description: '<p>Aman</p><script>alert(1)</script>',
        price: 0,
        subscriptionEligible: false,
        status: 'DRAFT' as const,
        level: 'BEGINNER' as const,
        enableQA: true,
        isPublic: false,
        reviewsEnabled: true,
        certificateEnabled: true,
        dripEnabled: false,
        dripType: 'NONE' as const,
      };
      (prisma.course.create as any).mockResolvedValue({ id: '1', ...mockCourse });

      const result = await createCourse(mockCourse);

      expect(prisma.course.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: 'New Course',
          description: '<p>Aman</p>',
        }),
      }));
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
      (prisma.userProgress.create as any).mockResolvedValue({ completed: true, lessonId: 'lesson-1' });

      // Note: the implementation expects answers array. [0, 1] means Q1 answer is index 0, Q2 answer is index 1
      const result = await submitQuiz('user-1', 'lesson-1', [0, 1]);

      expect(prisma.quiz.findUnique).toHaveBeenCalledWith({
        where: { lessonId: 'lesson-1' },
        include: { questions: { orderBy: { order: 'asc' } } },
      });
      expect(prisma.userProgress.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          lessonId: 'lesson-1',
          completed: true,
        },
      });
      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
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
      const { issueCertificateIfEligible } = await import('@/modules/certificates/api/service');
      (issueCertificateIfEligible as any).mockResolvedValue({ code: 'CERT-123' });

      const result = await generateCertificate('user-1', 'course-1');

      expect(issueCertificateIfEligible).toHaveBeenCalledWith('user-1', 'course-1');
      expect(result).toHaveProperty('code', 'CERT-123');
    });

    it('should throw error if course not completed', async () => {
      const mockCourse = {
        id: 'course-1',
        certificateEnabled: true,
      };
      (prisma.course.findUnique as any).mockResolvedValue(mockCourse);
      const { issueCertificateIfEligible } = await import('@/modules/certificates/api/service');
      (issueCertificateIfEligible as any).mockResolvedValue(null);

      await expect(generateCertificate('user-1', 'course-1')).rejects.toThrow('Kursus belum selesai');
    });
  });
});
