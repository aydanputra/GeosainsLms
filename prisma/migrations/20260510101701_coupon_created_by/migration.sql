-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "Coupon_createdById_idx" ON "Coupon"("createdById");

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
