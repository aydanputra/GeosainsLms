-- CreateEnum
CREATE TYPE "CouponFunding" AS ENUM ('STORE', 'MARKETPLACE', 'SPLIT');

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "funding" "CouponFunding" NOT NULL DEFAULT 'STORE',
ADD COLUMN     "marketplaceSharePercent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountMarketplaceTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "discountStoreTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "discountMarketplaceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "discountStoreAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
