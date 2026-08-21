import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import MentorDashboard from '@/modules/dashboard/pages/mentor/MentorDashboard';
import { getMentorRevenueSummary } from '@/modules/dashboard/api/performance';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  const courseWhere = { instructorId: userId, deletedAt: null as null };
  const revenueSummary = await getMentorRevenueSummary(userId);
  const { scope, productsSold, totalEarning, platformFeeTotal, affiliateFeeTotal } = revenueSummary;

  const [totalBundles, publishedPosts, totalProducts] = await Promise.all([
    scope.courseIds.length ? prisma.courseBundle.count({ where: { published: true, courseIds: { hasSome: scope.courseIds } } }) : 0,
    prisma.post.count({ where: { authorId: userId, published: true } }),
    scope.vendorIds.length ? prisma.product.count({ where: { vendorId: { in: scope.vendorIds } } }) : 0,
  ]);

  const [totalCourses, enrolledStudents, coursesRaw, notificationsRaw, recentEnrollmentsRaw, pendingSubmissionsRaw] = await Promise.all([
    prisma.course.count({ where: courseWhere }),
    prisma.enrollment.count({ where: { course: courseWhere } }),
    prisma.course.findMany({
      where: courseWhere,
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: { id: true, title: true, slug: true, status: true, price: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, message: true, read: true, createdAt: true },
    }),
    prisma.enrollment.findMany({
      where: { course: courseWhere },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        course: { select: { title: true, slug: true } },
      },
    }),
    prisma.assignmentSubmission.findMany({
      where: { status: 'PENDING', assignment: { lesson: { module: { course: courseWhere } } } },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        submittedAt: true,
        user: { select: { name: true, email: true } },
        assignment: {
          select: {
            title: true,
            lesson: {
              select: {
                title: true,
                module: { select: { course: { select: { title: true, slug: true } } } },
              },
            },
          },
        },
      },
    }),
  ]);

  const courseIdsForTable = coursesRaw.map((course) => course.id);
  const enrollmentAgg =
    courseIdsForTable.length > 0
      ? await prisma.enrollment.groupBy({
          by: ['courseId'],
          where: { courseId: { in: courseIdsForTable } },
          _count: { _all: true },
        })
      : [];

  const enrollmentsByCourseId = new Map<string, number>(enrollmentAgg.map((row) => [row.courseId, row._count._all]));
  const courses = coursesRaw.map((course) => ({
    id: course.id,
    title: course.title,
    published: course.status === 'PUBLISHED',
    price: course.price,
    students: enrollmentsByCourseId.get(course.id) || 0,
  }));

  const notifications = notificationsRaw.map((notification) => ({
    ...notification,
    createdAt: notification.createdAt.toISOString(),
  }));

  const recentEnrollments = recentEnrollmentsRaw.map((enrollment) => ({
    id: enrollment.id,
    createdAt: enrollment.createdAt.toISOString(),
    studentName: enrollment.user?.name || enrollment.user?.email || 'Siswa',
    studentEmail: enrollment.user?.email || '',
    courseTitle: enrollment.course?.title || '-',
    courseSlug: enrollment.course?.slug || '',
  }));

  const pendingSubmissions = pendingSubmissionsRaw.map((submission) => ({
    id: submission.id,
    submittedAt: submission.submittedAt.toISOString(),
    studentName: submission.user?.name || submission.user?.email || 'Siswa',
    studentEmail: submission.user?.email || '',
    courseTitle: submission.assignment?.lesson?.module?.course?.title || '-',
    courseSlug: submission.assignment?.lesson?.module?.course?.slug || '',
    assignmentTitle: submission.assignment?.title || 'Tugas',
    lessonTitle: submission.assignment?.lesson?.title || 'Pelajaran',
  }));

  return (
    <MentorDashboard
      stats={{
        totalCourses,
        enrolledStudents,
        totalBundles,
        totalProducts,
        productsSold,
        totalEarning,
        publishedPosts,
        platformFeeTotal,
        affiliateFeeTotal,
      }}
      courses={courses}
      notifications={notifications}
      recentEnrollments={recentEnrollments}
      pendingSubmissions={pendingSubmissions}
    />
  );
}
