-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "affiliateReferralId" TEXT;

-- CreateIndex
CREATE INDEX "Order_affiliateCode_idx" ON "Order"("affiliateCode");

-- CreateIndex
CREATE INDEX "Order_affiliateReferralId_idx" ON "Order"("affiliateReferralId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_affiliateReferralId_fkey" FOREIGN KEY ("affiliateReferralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;
