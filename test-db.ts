import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://admin:password123@localhost:5432/geosains_lms?schema=public",
    },
  },
});

async function main() {
  try {
    console.log('Testing connection...');
    await prisma.$connect();
    console.log('✅ Connected to database successfully!');
    
    const count = await prisma.category.count();
    console.log(`✅ Found ${count} categories.`);
    
    const newCat = await prisma.category.create({
      data: {
        name: `Test Category ${Date.now()}`,
        slug: `test-category-${Date.now()}`
      }
    });
    console.log('✅ Created test category:', newCat);
    
    await prisma.category.delete({ where: { id: newCat.id } });
    console.log('✅ Deleted test category.');
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
