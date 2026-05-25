-- AlterTable
ALTER TABLE "PageView" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "PageView_productId_createdAt_idx" ON "PageView"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "PageView_vendorId_createdAt_idx" ON "PageView"("vendorId", "createdAt");

-- AddForeignKey
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "ShopVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
