import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import StudentCourses from '@/modules/dashboard/pages/student/StudentCourses';
import { getEnrolledCourses } from '@/modules/course/api/service';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'STUDENT' && role !== 'ADMIN' && role !== 'MENTOR') return <div>Access Denied</div>;

  const formattedCourses = await getEnrolledCourses(userId);
  const courseIds = formattedCourses.map((course: any) => String(course.id)).filter(Boolean);

  const [courseMetaRows, reviewSummaryRows, myReviewRows] = courseIds.length
    ? await Promise.all([
        prisma.course.findMany({
          where: { id: { in: courseIds } },
          select: { id: true, reviewsEnabled: true },
        }),
        prisma.courseReview.groupBy({
          by: ['courseId'],
          where: { courseId: { in: courseIds } },
          _avg: { rating: true },
          _count: { rating: true },
        }),
        prisma.courseReview.findMany({
          where: { userId, courseId: { in: courseIds } },
          select: { courseId: true, rating: true, comment: true },
        }),
      ])
    : [[], [], []];

  const courseMetaMap = new Map(
    courseMetaRows.map((course) => [String(course.id), { reviewsEnabled: course.reviewsEnabled !== false }] as const)
  );
  const reviewSummaryMap = new Map(
    reviewSummaryRows.map((row) => [
      String(row.courseId),
      {
        ratingAvg: row._avg.rating ?? 0,
        ratingCount: row._count.rating ?? 0,
      },
    ] as const)
  );
  const myReviewMap = new Map(
    myReviewRows.map((row) => [
      String(row.courseId),
      {
        myRating: row.rating ?? null,
        myComment: row.comment ?? '',
      },
    ] as const)
  );

  const coursesWithReviewState = formattedCourses.map((course: any) => {
    const key = String(course.id);
    return {
      ...course,
      reviewsEnabled: courseMetaMap.get(key)?.reviewsEnabled !== false,
    };
  });

  const initialReviewState = courseIds.reduce<Record<string, { ratingAvg: number; ratingCount: number; myRating: number | null; myComment: string }>>(
    (acc, courseId) => {
      acc[courseId] = {
        ratingAvg: reviewSummaryMap.get(courseId)?.ratingAvg ?? 0,
        ratingCount: reviewSummaryMap.get(courseId)?.ratingCount ?? 0,
        myRating: myReviewMap.get(courseId)?.myRating ?? null,
        myComment: myReviewMap.get(courseId)?.myComment ?? '',
      };
      return acc;
    },
    {}
  );

  return <StudentCourses courses={coursesWithReviewState} initialReviewState={initialReviewState} />;
}
