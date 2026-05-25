CREATE TYPE "QAThreadStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "QAThread" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "lessonId" TEXT,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "status" "QAThreadStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QAThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QAReply" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QAReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QAThread_courseId_idx" ON "QAThread"("courseId");
CREATE INDEX "QAThread_lessonId_idx" ON "QAThread"("lessonId");
CREATE INDEX "QAThread_authorId_idx" ON "QAThread"("authorId");
CREATE INDEX "QAThread_createdAt_idx" ON "QAThread"("createdAt");
CREATE INDEX "QAReply_threadId_idx" ON "QAReply"("threadId");
CREATE INDEX "QAReply_authorId_idx" ON "QAReply"("authorId");
CREATE INDEX "QAReply_createdAt_idx" ON "QAReply"("createdAt");

ALTER TABLE "QAThread" ADD CONSTRAINT "QAThread_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QAThread" ADD CONSTRAINT "QAThread_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QAThread" ADD CONSTRAINT "QAThread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QAReply" ADD CONSTRAINT "QAReply_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "QAThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QAReply" ADD CONSTRAINT "QAReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
