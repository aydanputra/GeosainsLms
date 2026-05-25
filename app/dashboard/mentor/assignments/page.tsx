import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import MentorAssignments from '@/modules/dashboard/pages/mentor/MentorAssignments';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      assignment: {
        lesson: {
          module: {
            course: {
              instructorId: userId,
            },
          },
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      assignment: {
        include: {
          lesson: {
            include: {
              module: {
                include: {
                  course: { select: { title: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const formatted = submissions.map((s) => ({
    id: s.id,
    status: s.status,
    submittedAt: s.submittedAt.toISOString(),
    gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
    grade: s.grade,
    feedback: s.feedback,
    notes: s.notes,
    student: {
      id: s.user.id,
      name: s.user.name || s.user.email,
      email: s.user.email,
    },
    assignment: {
      id: s.assignment.id,
      title: s.assignment.title,
      lessonTitle: s.assignment.lesson.title,
      courseTitle: s.assignment.lesson.module.course.title,
    },
    downloadUrl: `/api/assignments/submissions/${s.id}/download`,
  }));

  return <MentorAssignments submissions={formatted} />;
}
