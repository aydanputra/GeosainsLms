CREATE TABLE "CourseCoInstructor" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CourseCoInstructor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseCoInstructor_courseId_userId_key" ON "CourseCoInstructor"("courseId", "userId");
CREATE INDEX "CourseCoInstructor_courseId_idx" ON "CourseCoInstructor"("courseId");
CREATE INDEX "CourseCoInstructor_userId_idx" ON "CourseCoInstructor"("userId");

ALTER TABLE "CourseCoInstructor" ADD CONSTRAINT "CourseCoInstructor_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseCoInstructor" ADD CONSTRAINT "CourseCoInstructor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

