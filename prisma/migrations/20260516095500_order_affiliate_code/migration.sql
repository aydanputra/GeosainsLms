-- AlterTable
ALTER TABLE "Order" ADD COLUMN "affiliateCode" TEXT;

-- CreateIndex
CREATE INDEX "Order_affiliateCode_idx" ON "Order"("affiliateCode");
