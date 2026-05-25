/*
  Warnings:

  - You are about to drop the column `code` on the `Certificate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[serial]` on the table `Certificate` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `completedAt` to the `Certificate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `instructorId` to the `Certificate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serial` to the `Certificate` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Certificate_code_key";

-- AlterTable
ALTER TABLE "Certificate" DROP COLUMN "code",
ADD COLUMN     "completedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "instructorId" TEXT NOT NULL,
ADD COLUMN     "serial" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_serial_key" ON "Certificate"("serial");
