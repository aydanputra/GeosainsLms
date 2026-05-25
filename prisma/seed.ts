import { PrismaClient, Role, CourseStatus, CourseLevel, LessonType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Mock hash function to avoid import issues
const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10);
};

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-')   // Replace multiple - with single -
    .replace(/^-+/, '')       // Trim - from start of text
    .replace(/-+$/, '');      // Trim - from end of text
}

// Order status enum based on schema
const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  SHIPPED: 'SHIPPED',
  CANCELLED: 'CANCELLED',
};

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create Users
  console.log('Creating users...');
  
  // Create Admins
  const adminPassword = await hashPassword('admin123');
  const admins = [];
  for (let i = 1; i <= 5; i++) {
    admins.push(await prisma.user.upsert({
      where: { email: `admin${i}@geosains.com` },
      update: {},
      create: {
        email: `admin${i}@geosains.com`,
        name: `Admin User ${i}`,
        password: adminPassword,
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
      },
    }));
  }

  // Create Mentors
  const mentorPassword = await hashPassword('mentor123');
  const mentors = [];
  for (let i = 1; i <= 10; i++) {
    mentors.push(await prisma.user.upsert({
      where: { email: `mentor${i}@geosains.com` },
      update: {},
      create: {
        email: `mentor${i}@geosains.com`,
        name: `Mentor User ${i}`,
        password: mentorPassword,
        role: 'MENTOR',
        emailVerifiedAt: new Date(),
      },
    }));
  }

  // Create Students
  const studentPassword = await hashPassword('student123');
  const students = [];
  for (let i = 1; i <= 50; i++) {
    students.push(await prisma.user.upsert({
      where: { email: `student${i}@geosains.com` },
      update: {},
      create: {
        email: `student${i}@geosains.com`,
        name: `Student User ${i}`,
        password: studentPassword,
        role: 'STUDENT',
        emailVerifiedAt: new Date(),
      },
    }));
  }

  // Assign Affiliate Profiles to some students
  for (let i = 0; i < 20; i++) {
    const student = students[i];
    const existingProfile = await prisma.affiliateProfile.findUnique({
      where: { userId: student.id },
    });

    if (!existingProfile) {
      await prisma.affiliateProfile.create({
        data: {
          userId: student.id,
          code: `REF-${student.name?.split(' ')[2]}-${Math.floor(Math.random() * 1000)}`,
          balance: 0,
        },
      });
    }
  }

  // 2. Create Categories
  console.log('Creating categories...');
  const categoryNames = ['Geology Basics', 'Field Methods', 'Mineralogy', 'Petrology', 'Geophysics'];
  const categories = [];
  for (const name of categoryNames) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const category = await prisma.category.upsert({
      where: { name },
      update: { slug },
      create: {
        name,
        slug,
      },
    });
    categories.push(category);
    console.log(`Category created: ${category.name}`);
  }

  // 3. Create Courses
  console.log('Creating courses...');
  const courses = [];
  for (let i = 1; i <= 20; i++) {
    const mentor = mentors[Math.floor(Math.random() * mentors.length)];
    const category = categories[i % categories.length];
    const title = `Geology Course ${i}: ${['Basics', 'Advanced', 'Fieldwork', 'Mineralogy', 'Seismology'][i % 5]}`;
    const slug = slugify(`${title}-${i}`); // Ensure unique slug

    const existingCourse = await prisma.course.findUnique({ where: { slug } });
    if (existingCourse) {
      courses.push(existingCourse);
      continue;
    }

    const course = await prisma.course.create({
      data: {
        title,
        slug,
        description: 'Comprehensive guide to mastering geological concepts.',
        price: Math.floor(Math.random() * 500000) + 100000,
        instructorId: mentor.id,
        categoryId: category.id,
        status: i % 3 === 0 ? CourseStatus.DRAFT : CourseStatus.PUBLISHED,
        level: i % 2 === 0 ? CourseLevel.BEGINNER : CourseLevel.INTERMEDIATE,
        publishedAt: i % 3 !== 0 ? new Date() : null,
        totalLessons: 6, // 2 modules * 3 lessons
        totalDuration: 3600, // 1 hour dummy
        modules: {
          create: [
            {
              title: 'Module 1: Introduction',
              order: 1,
              lessons: {
                create: Array.from({ length: 3 }).map((_, j) => ({
                  title: `Lesson 1.${j + 1}`,
                  order: j + 1,
                  content: { type: 'doc', content: [{ type: 'paragraph', text: 'This is the lesson content.' }] }, // JSON content
                  type: j % 2 === 0 ? LessonType.VIDEO : LessonType.TEXT,
                  videoId: j % 2 === 0 ? 'dQw4w9WgXcQ' : null,
                  duration: 600,
                  isPreview: j === 0,
                })),
              },
            },
            {
              title: 'Module 2: Advanced Concepts',
              order: 2,
              lessons: {
                create: Array.from({ length: 3 }).map((_, j) => ({
                  title: `Lesson 2.${j + 1}`,
                  order: j + 1,
                  content: { type: 'doc', content: [{ type: 'paragraph', text: 'Advanced content here.' }] },
                  type: j % 2 === 0 ? LessonType.VIDEO : LessonType.TEXT,
                  videoId: (j % 2 === 0) ? 'dQw4w9WgXcQ' : null,
                  duration: 900,
                })),
              },
            },
          ],
        },
      },
    });
    courses.push(course);
  }

  // Enroll Students
  console.log('Enrolling students...');
  for (const course of courses) {
    const enrolledStudents = students.slice(0, Math.floor(Math.random() * 10) + 5);
    for (const student of enrolledStudents) {
      await prisma.enrollment.upsert({
        where: {
          userId_courseId: {
            userId: student.id,
            courseId: course.id,
          }
        },
        update: {},
        create: {
          userId: student.id,
          courseId: course.id,
        },
      });
    }
  }

  // 4. Shop Products
  console.log('Creating products...');
  const products = [];
  for (let i = 1; i <= 15; i++) {
    const existingProduct = await prisma.product.findFirst({ where: { name: `Geology Tool ${i}` } });
    if (existingProduct) {
      products.push(existingProduct);
      continue;
    }

    const product = await prisma.product.create({
      data: {
        name: `Geology Tool ${i}`,
        description: 'Essential tool for every geologist.',
        price: Math.floor(Math.random() * 1000000) + 50000,
        stock: Math.floor(Math.random() * 100),
      },
    });
    products.push(product);
  }

  // Create Orders
  console.log('Creating orders...');
  for (let i = 0; i < 20; i++) {
    const student = students[i];
    const orderItems = products.slice(0, Math.floor(Math.random() * 3) + 1);
    const total = orderItems.reduce((acc, p) => acc + p.price, 0);
    
    await prisma.order.create({
      data: {
        userId: student.id,
        total,
        status: Object.values(OrderStatus)[Math.floor(Math.random() * 3)] as any,
        items: {
          create: orderItems.map(p => ({
            productId: p.id,
            quantity: 1,
            price: p.price,
          })),
        },
      },
    });
  }

  // 5. Blog Posts
  console.log('Creating blog posts...');
  for (let i = 1; i <= 10; i++) {
    await prisma.post.upsert({
      where: { slug: `geology-news-${i}` },
      update: {},
      create: {
        title: `Geology News ${i}`,
        slug: `geology-news-${i}`,
        content: '<p>Latest updates from the field of earth sciences.</p>',
        published: true,
        authorId: admins[0].id,
      },
    });
  }

  // 6. Pages
  console.log('Creating pages...');
  const pages = [
    { title: 'Home', slug: 'home', blocks: [
      { type: 'HERO', content: JSON.stringify({ heading: 'Welcome to GeoSains', subheading: 'Your learning platform' }) },
      { type: 'FEATURES', content: JSON.stringify({ features: [{ title: 'Expert Mentors', description: 'Learn from the best' }] }) },
    ]},
    { title: 'About Us', slug: 'about', blocks: [
      { type: 'TEXT', content: JSON.stringify({ text: '<p>We are a team of geologists.</p>' }) },
    ]},
    { title: 'Careers', slug: 'careers', blocks: [
      { type: 'TEXT', content: JSON.stringify({ text: '<p>Join our team.</p>' }) },
    ]},
  ];

  for (const page of pages) {
    const existingPage = await (prisma as any).page.findUnique({ where: { slug: page.slug } });
    if (!existingPage) {
      await (prisma as any).page.create({
        data: {
          title: page.title,
          slug: page.slug,
          published: true,
          blocks: {
            create: page.blocks.map((b: any, idx: number) => ({
              type: b.type,
              content: b.content,
              order: idx,
            })),
          },
        },
      });
    }
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
