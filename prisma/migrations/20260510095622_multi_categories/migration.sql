-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
