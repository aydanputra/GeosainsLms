"use client";

import CourseWizard from './wizard/CourseWizard';

export default function CourseForm({ courseId }: { courseId?: string }) {
  return <CourseWizard initialCourseId={courseId} />;
}
