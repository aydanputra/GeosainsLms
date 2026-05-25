-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('ALL', 'COURSES', 'PRODUCTS', 'COURSE_CATEGORIES', 'PRODUCT_CATEGORIES', 'VENDORS');

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "courseCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "courseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "maxDiscount" DOUBLE PRECISION,
ADD COLUMN     "productCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "scope" "CouponScope" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "usageLimitPerUser" INTEGER,
ADD COLUMN     "vendorIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

-- CreateIndex
CREATE INDEX "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_userId_idx" ON "CouponRedemption"("couponId", "userId");

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
