import { Prisma } from '@prisma/client';
import { prisma } from '@/utils/prisma';

type PrismaLike = Prisma.TransactionClient | typeof prisma;

export async function getCourseAggregates(client: PrismaLike, courseId: string) {
  const lessons = await client.lesson.findMany({
    where: { module: { courseId } },
    select: { duration: true },
  });

  const totalLessons = lessons.length;
  const totalDuration = lessons.reduce((sum, lesson) => sum + (Number(lesson.duration) || 0), 0);

  return {
    totalLessons,
    totalDuration,
  };
}

export async function syncCourseAggregates(client: PrismaLike, courseId: string) {
  const aggregates = await getCourseAggregates(client, courseId);

  await client.course.update({
    where: { id: courseId },
    data: {
      totalLessons: aggregates.totalLessons,
      totalDuration: aggregates.totalDuration,
    },
  });

  return aggregates;
}
