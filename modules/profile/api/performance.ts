import { getEnrolledCourses } from '@/modules/course/api/service';
import { prisma } from '@/utils/prisma';

function serializeProfileUser(user: any) {
  return {
    id: String(user.id),
    name: user.name ?? null,
    email: String(user.email),
    avatarUrl: user.avatarUrl ?? null,
    profileCoverUrl: user.profileCoverUrl ?? null,
    signatureUrl: user.signatureUrl ?? null,
    phone: user.phone ?? null,
    gender: user.gender ?? null,
    birthDate: user.birthDate ? user.birthDate.toISOString() : null,
    country: user.country ?? null,
    province: user.province ?? null,
    city: user.city ?? null,
    address: user.address ?? null,
    socialLinks: user.socialLinks ?? null,
    mentorJobTitle: user.mentorJobTitle ?? null,
    mentorBio: user.mentorBio ?? null,
    mentorSkills: Array.isArray(user.mentorSkills) ? user.mentorSkills : [],
    mentorEducations: user.mentorEducations ?? null,
    mentorExperiences: user.mentorExperiences ?? null,
    mentorAttachments: user.mentorAttachments ?? null,
    role: user.role,
    isSuperAdmin: Boolean(user.isSuperAdmin),
    totpEnabled: Boolean(user.totpEnabled),
    totpVerifiedAt: user.totpVerifiedAt ? user.totpVerifiedAt.toISOString() : null,
    createdAt: user.createdAt ? user.createdAt.toISOString() : null,
  };
}

async function getSelfLoginHistory(userId: string) {
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      actorId: userId,
      OR: [{ action: { startsWith: 'AUTH_LOGIN' } }, { action: 'AUTH_LOGOUT' }],
    },
    orderBy: { createdAt: 'desc' },
    take: 120,
    select: {
      id: true,
      actorId: true,
      action: true,
      ip: true,
      userAgent: true,
      metadata: true,
      createdAt: true,
      actor: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  const logoutBySessionId = new Map<string, string>();
  for (const log of Array.isArray(auditLogs) ? auditLogs : []) {
    if (log?.action !== 'AUTH_LOGOUT') continue;
    const meta: any = log?.metadata && typeof log.metadata === 'object' ? (log.metadata as any) : null;
    const sessionId = typeof meta?.sessionId === 'string' && meta.sessionId ? meta.sessionId : null;
    if (!sessionId) continue;
    const key = `${String((log as any)?.actorId || '')}:${sessionId}`;
    if (!logoutBySessionId.has(key)) {
      logoutBySessionId.set(key, new Date(log.createdAt as any).toISOString());
    }
  }

  return (Array.isArray(auditLogs) ? auditLogs : [])
    .filter((log) => typeof (log as any)?.action === 'string' && String((log as any).action).startsWith('AUTH_LOGIN'))
    .slice(0, 20)
    .map((log) => {
      const meta: any = log?.metadata && typeof log.metadata === 'object' ? (log.metadata as any) : {};
      const sessionId = typeof meta?.sessionId === 'string' && meta.sessionId ? meta.sessionId : null;
      const key = sessionId ? `${String((log as any)?.actorId || '')}:${sessionId}` : '';
      const sessionEnd = sessionId ? logoutBySessionId.get(key) || null : null;
      return {
        ...log,
        createdAt: new Date(log.createdAt as any).toISOString(),
        metadata: sessionEnd ? { ...meta, sessionEnd } : meta,
        actor: log.actor
          ? {
              ...log.actor,
              id: String(log.actor.id),
              name: log.actor.name ?? null,
              email: String(log.actor.email),
              role: log.actor.role ?? null,
            }
          : null,
      };
    });
}

async function getInitialStudentProfileData(userId: string) {
  const [enrolledCourses, avgQuizAgg, certificates] = await Promise.all([
    getEnrolledCourses(userId),
    prisma.quizAttempt.aggregate({ where: { userId, completedAt: { not: null } }, _avg: { score: true } }),
    prisma.certificate.findMany({
      where: { userId },
      include: {
        course: {
          select: { title: true, slug: true, thumbnailUrl: true },
        },
      },
      orderBy: { issuedAt: 'desc' },
    }),
  ]);

  const completedCourses = enrolledCourses.filter((course: any) => Number(course?.progress) >= 100).length;
  const inProgressCourses = enrolledCourses.length - completedCourses;

  return {
    initialStudentStats: {
      completedCourses,
      inProgressCourses,
      totalScore: Math.round(avgQuizAgg._avg.score ?? 0),
    },
    initialEnrolledCoursesData: enrolledCourses,
    initialCertificatesData: certificates.map((certificate: any) => ({
      ...certificate,
      issuedAt: certificate.issuedAt instanceof Date ? certificate.issuedAt.toISOString() : certificate.issuedAt,
    })),
  };
}

async function getInitialMentorProfileData(userId: string) {
  const [mentorCourses, mentorPosts, pendingSubmissions, enrolledStudents] = await Promise.all([
    prisma.course.findMany({
      where: { instructorId: userId, deletedAt: null },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.post.findMany({
      where: { authorId: userId, published: true },
      select: { id: true, title: true, slug: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.assignmentSubmission.count({
      where: {
        status: 'PENDING',
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
    }),
    prisma.enrollment.findMany({
      where: {
        course: {
          instructorId: userId,
          deletedAt: null,
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  return {
    initialMentorStats: {
      totalCourses: mentorCourses.length,
      enrolledStudents: enrolledStudents.length,
      pendingSubmissions,
    },
    initialMentorCoursesData: mentorCourses,
    initialMentorPostsData: mentorPosts.map((post) => ({
      ...post,
      createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
    })),
  };
}

export async function getProfilePageInitialData(userId: string) {
  const profileUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      profileCoverUrl: true,
      signatureUrl: true,
      phone: true,
      gender: true,
      birthDate: true,
      country: true,
      province: true,
      city: true,
      address: true,
      socialLinks: true,
      mentorJobTitle: true,
      mentorBio: true,
      mentorSkills: true,
      mentorEducations: true,
      mentorExperiences: true,
      mentorAttachments: true,
      role: true,
      isSuperAdmin: true,
      totpEnabled: true,
      totpVerifiedAt: true,
      createdAt: true,
    } as any,
  });

  if (!profileUser) return null;

  const serializedUser = serializeProfileUser(profileUser);
  const role = String((profileUser as { role?: unknown }).role ?? '');
  const [loginHistory, studentData, mentorData] = await Promise.all([
    getSelfLoginHistory(userId),
    role === 'STUDENT' ? getInitialStudentProfileData(userId) : Promise.resolve(null),
    role === 'MENTOR' || role === 'ADMIN' ? getInitialMentorProfileData(userId) : Promise.resolve(null),
  ]);

  return {
    initialUser: serializedUser,
    initialMeData: {
      user: serializedUser,
      loginHistory,
    },
    initialStudentStats: studentData?.initialStudentStats,
    initialEnrolledCoursesData: studentData?.initialEnrolledCoursesData,
    initialCertificatesData: studentData?.initialCertificatesData,
    initialMentorStats: mentorData?.initialMentorStats,
    initialMentorCoursesData: mentorData?.initialMentorCoursesData,
    initialMentorPostsData: mentorData?.initialMentorPostsData,
  };
}
