-- CreateTable
CREATE TABLE "MentorWithdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mode" TEXT NOT NULL DEFAULT 'MANUAL',
    "provider" TEXT,
    "externalId" TEXT,
    "disbursementId" TEXT,
    "bankCode" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountHolderName" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentorWithdrawal_userId_idx" ON "MentorWithdrawal"("userId");

-- CreateIndex
CREATE INDEX "MentorWithdrawal_status_idx" ON "MentorWithdrawal"("status");

-- CreateIndex
CREATE INDEX "MentorWithdrawal_createdAt_idx" ON "MentorWithdrawal"("createdAt");

-- AddForeignKey
ALTER TABLE "MentorWithdrawal" ADD CONSTRAINT "MentorWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
