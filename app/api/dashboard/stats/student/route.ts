import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

function parseRange(searchParams: URLSearchParams): { from: Date; to: Date; range: '7d' | '30d' | '90d' } {
  const rangeRaw = String(searchParams.get('range') || '').trim().toLowerCase();
  const to = new Date();
  const from = new Date(to);
  if (rangeRaw === '7d') from.setDate(to.getDate() - 6);
  else if (rangeRaw === '90d') from.setDate(to.getDate() - 89);
  else from.setDate(to.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  const range = rangeRaw === '7d' || rangeRaw === '90d' ? (rangeRaw as '7d' | '90d') : '30d';
  return { from, to, range };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'STUDENT' && user.role !== 'MENTOR' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { from, to, range } = parseRange(req.nextUrl.searchParams);
    const userId = String(user.id);

    const [avgQuizAgg, quizzesCompleted, assignmentsPending, certificates, courseRows, progressDailyRaw, quizDailyRaw] =
      await Promise.all([
        prisma.quizAttempt.aggregate({ where: { userId, completedAt: { not: null } }, _avg: { score: true } }),
        prisma.quizAttempt.count({ where: { userId, completedAt: { not: null } } }),
        prisma.assignmentSubmission.count({ where: { userId, status: 'PENDING' } }),
        prisma.certificate.count({ where: { userId } }),
        prisma.$queryRaw<
          Array<{
            courseId: string;
            title: string;
            slug: string;
            thumbnailUrl: string | null;
            totalLessons: number;
            completedLessons: number;
            lastActivityAt: Date | null;
            enrolledAt: Date;
          }>
        >`
          SELECT
            c.id AS "courseId",
            c.title AS "title",
            c.slug AS "slug",
            c."thumbnailUrl" AS "thumbnailUrl",
            COUNT(l.id)::int AS "totalLessons",
            COUNT(up.id) FILTER (WHERE up.completed = true)::int AS "completedLessons",
            MAX(up."updatedAt") AS "lastActivityAt",
            e."createdAt" AS "enrolledAt"
          FROM "Enrollment" e
          JOIN "Course" c ON c.id = e."courseId"
          LEFT JOIN "Module" m ON m."courseId" = c.id
          LEFT JOIN "Lesson" l ON l."moduleId" = m.id
          LEFT JOIN "UserProgress" up ON up."lessonId" = l.id AND up."userId" = e."userId"
          WHERE e."userId" = ${userId} AND c."deletedAt" IS NULL
          GROUP BY c.id, c.title, c.slug, c."thumbnailUrl", e."createdAt"
          ORDER BY e."createdAt" DESC
        `,
        prisma.$queryRaw<Array<{ day: Date; lessonsCompleted: number }>>`
          SELECT date_trunc('day', up."updatedAt") AS day, COUNT(*)::int AS "lessonsCompleted"
          FROM "UserProgress" up
          WHERE up."userId" = ${userId} AND up.completed = true AND up."updatedAt" >= ${from} AND up."updatedAt" <= ${to}
          GROUP BY 1
          ORDER BY 1
        `,
        prisma.$queryRaw<Array<{ day: Date; quizzesCompleted: number }>>`
          SELECT date_trunc('day', qa."completedAt") AS day, COUNT(*)::int AS "quizzesCompleted"
          FROM "QuizAttempt" qa
          WHERE qa."userId" = ${userId} AND qa."completedAt" IS NOT NULL AND qa."completedAt" >= ${from} AND qa."completedAt" <= ${to}
          GROUP BY 1
          ORDER BY 1
        `,
      ]);

    const avgQuizScore = Math.round(avgQuizAgg._avg.score ?? 0);

    const courses = (Array.isArray(courseRows) ? courseRows : []).map((r) => {
      const totalLessons = Number(r.totalLessons) || 0;
      const completedLessons = Number(r.completedLessons) || 0;
      const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const lastActivityAt = r.lastActivityAt ? (r.lastActivityAt instanceof Date ? r.lastActivityAt.toISOString() : new Date(String(r.lastActivityAt)).toISOString()) : null;
      const enrolledAt = r.enrolledAt instanceof Date ? r.enrolledAt.toISOString() : new Date(String(r.enrolledAt)).toISOString();
      return {
        id: String(r.courseId),
        title: String(r.title || ''),
        slug: String(r.slug || ''),
        thumbnailUrl: typeof r.thumbnailUrl === 'string' ? r.thumbnailUrl : null,
        totalLessons,
        completedLessons,
        progressPercent,
        status: progressPercent >= 100 ? 'Selesai' : progressPercent > 0 ? 'Sedang Berjalan' : 'Belum Mulai',
        lastActivityAt,
        enrolledAt,
      };
    });

    const enrolledCourses = courses.length;
    const completedCourses = courses.filter((c) => c.progressPercent >= 100).length;
    const inProgressCourses = courses.filter((c) => c.progressPercent < 100).length;

    const byDay = new Map<string, { day: string; lessonsCompleted: number; quizzesCompleted: number }>();
    for (const r of Array.isArray(progressDailyRaw) ? progressDailyRaw : []) {
      const dayIso = r.day instanceof Date ? r.day.toISOString() : new Date(String(r.day)).toISOString();
      byDay.set(dayIso, { day: dayIso, lessonsCompleted: Number((r as any).lessonsCompleted) || 0, quizzesCompleted: 0 });
    }
    for (const r of Array.isArray(quizDailyRaw) ? quizDailyRaw : []) {
      const dayIso = r.day instanceof Date ? r.day.toISOString() : new Date(String(r.day)).toISOString();
      const prev = byDay.get(dayIso) || { day: dayIso, lessonsCompleted: 0, quizzesCompleted: 0 };
      byDay.set(dayIso, { ...prev, quizzesCompleted: Number((r as any).quizzesCompleted) || 0 });
    }
    const daily = Array.from(byDay.values()).sort((a, b) => (a.day < b.day ? -1 : 1));

    return NextResponse.json({
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      completedCourses,
      inProgressCourses,
      totalScore: avgQuizScore,
      totals: {
        enrolledCourses,
        completedCourses,
        inProgressCourses,
        certificates,
        avgQuizScore,
        quizzesCompleted,
        assignmentsPending,
      },
      daily,
      courses,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
