-- CreateEnum
CREATE TYPE "DripType" AS ENUM ('NONE', 'SCHEDULE', 'AFTER_ENROLLMENT', 'SEQUENTIAL');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "dripDays" INTEGER,
ADD COLUMN     "dripEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dripType" "DripType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "enrollmentEndDate" TIMESTAMP(3),
ADD COLUMN     "maxStudents" INTEGER,
ADD COLUMN     "validityDays" INTEGER;
