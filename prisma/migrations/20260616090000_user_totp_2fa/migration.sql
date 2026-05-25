-- AlterTable
ALTER TABLE "User"
ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecretEnc" TEXT,
ADD COLUMN     "totpVerifiedAt" TIMESTAMP(3);

