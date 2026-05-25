
import { prisma } from '@/utils/prisma';
import { generateUniqueSerial } from '../utils/serial';

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Checks if a user has completed a course and issues a certificate if eligible.
 * Idempotent: Returns existing certificate if already issued.
 */
export async function issueCertificateIfEligible(userId: string, courseId: string) {
  const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
  const settings = safeParse(settingsPage?.content);
  const certificatesEnabled = settings['certificatesEnabled'] !== false;
  if (!certificatesEnabled) return null;

  // 1. Check if certificate already exists
  const existing = await prisma.certificate.findUnique({
    where: {
      userId_courseId: { userId, courseId }
    }
  });

  if (existing) return existing;

  const course = (await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        include: {
          lessons: {
            select: {
              id: true,
              quiz: { select: { id: true, passingGrade: true } },
              assignment: { select: { id: true, passingGrade: true } },
            },
          },
        },
      }
    }
  })) as any;

  if (!course) throw new Error('Course not found');
  if (course.certificateEnabled === false) return null;

  const modules: any[] = Array.isArray(course.modules) ? course.modules : [];
  const lessons: any[] = modules.flatMap((m: any) => (Array.isArray(m?.lessons) ? m.lessons : []));
  if (lessons.length === 0) return null;

  const lessonIds = lessons.map((l: any) => l.id).filter(Boolean);
  const completed = await prisma.userProgress.findMany({
    where: { userId, lessonId: { in: lessonIds }, completed: true },
    select: { lessonId: true },
  });
  const completedSet = new Set(completed.map((p) => p.lessonId));

  if (lessonIds.some((id) => !completedSet.has(id))) return null;

  const quizLessons = lessons.filter((l) => l.quiz?.id);
  const quizIds = quizLessons.map((l) => l.quiz!.id);
  const quizBest = quizIds.length
    ? await prisma.quizAttempt.groupBy({
        by: ['quizId'],
        where: { userId, quizId: { in: quizIds }, completedAt: { not: null } },
        _max: { score: true },
      })
    : [];
  const bestScoreByQuizId = new Map(quizBest.map((r) => [r.quizId, r._max.score ?? null]));

  for (const l of quizLessons) {
    const passingGrade = l.quiz?.passingGrade ?? 80;
    const best = bestScoreByQuizId.get(l.quiz!.id);
    if (typeof best !== 'number' || best < passingGrade) return null;
  }

  const assignmentLessons = lessons.filter((l) => l.assignment?.id);
  const assignmentIds = assignmentLessons.map((l) => l.assignment!.id);
  const assignmentBest = assignmentIds.length
    ? await prisma.assignmentSubmission.groupBy({
        by: ['assignmentId'],
        where: {
          userId,
          assignmentId: { in: assignmentIds },
          status: 'GRADED',
          grade: { not: null },
        },
        _max: { grade: true },
      })
    : [];
  const bestGradeByAssignmentId = new Map(assignmentBest.map((r) => [r.assignmentId, r._max.grade ?? null]));

  for (const l of assignmentLessons) {
    const passingGrade = l.assignment?.passingGrade ?? 0;
    const best = bestGradeByAssignmentId.get(l.assignment!.id);
    if (typeof best !== 'number' || best < passingGrade) return null;
  }

  // 3. Issue Certificate
  // Using upsert for idempotency and concurrency safety
  // The @@unique([userId, courseId]) constraint in DB ensures only one certificate exists
  const serial = await generateUniqueSerial();
  
  try {
    return await prisma.certificate.upsert({
        where: {
            userId_courseId: { userId, courseId }
        },
        update: {
            // Do not update anything if it exists, to preserve original issuedAt/completedAt/serial
        },
        create: {
            userId,
            courseId,
            instructorId: course.instructorId,
            serial,
            completedAt: new Date(),
        }
    });
  } catch (error) {
      // If upsert fails (e.g. serial collision), we should retry or just return existing
      // But since serial is unique, a collision on serial would throw.
      // If race condition on userId_courseId, upsert handles it.
      // We'll fallback to findUnique just in case.
      return prisma.certificate.findUnique({
          where: { userId_courseId: { userId, courseId } }
      });
  }
}

export async function getCertificateBySerial(serial: string) {
  return prisma.certificate.findUnique({
    where: { serial },
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { title: true, instructor: { select: { name: true } } } }
    }
  });
}
