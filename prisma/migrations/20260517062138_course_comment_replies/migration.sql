-- CreateTable
CREATE TABLE "CourseCommentReply" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseCommentReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseCommentReply_commentId_createdAt_idx" ON "CourseCommentReply"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseCommentReply_userId_idx" ON "CourseCommentReply"("userId");

-- AddForeignKey
ALTER TABLE "CourseCommentReply" ADD CONSTRAINT "CourseCommentReply_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CourseComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCommentReply" ADD CONSTRAINT "CourseCommentReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
