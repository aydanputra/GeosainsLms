-- CreateEnum
CREATE TYPE "ManualPaymentStatus" AS ENUM ('NONE', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "manualPaymentNote" TEXT,
ADD COLUMN     "manualPaymentProofMediaId" TEXT,
ADD COLUMN     "manualPaymentProofUrl" TEXT,
ADD COLUMN     "manualPaymentReviewedAt" TIMESTAMP(3),
ADD COLUMN     "manualPaymentReviewedById" TEXT,
ADD COLUMN     "manualPaymentStatus" "ManualPaymentStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "manualPaymentSubmittedAt" TIMESTAMP(3);
