import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const courses = await prisma.course.findMany({
      select: { id: true, title: true, status: true, publishedAt: true }
    });
    console.log('Current Courses in DB:');
    console.table(courses);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();