
import { prisma } from './utils/prisma';

async function auditLatestCourse() {
  try {
    const course = await prisma.course.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        modules: {
          include: {
            lessons: true
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!course) {
      console.log("No courses found.");
      return;
    }

    console.log("Latest Course ID:", course.id);
    console.log("Title:", course.title);
    console.log("Modules Count:", course.modules.length);
    
    course.modules.forEach((mod, idx) => {
      console.log(`Module ${idx + 1}: ${mod.title} (Lessons: ${mod.lessons.length})`);
      mod.lessons.forEach((les, lIdx) => {
          console.log(`  - Lesson ${lIdx + 1}: ${les.title} (Type: ${les.type})`);
      });
    });

  } catch (error) {
    console.error("Audit failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

auditLatestCourse();
