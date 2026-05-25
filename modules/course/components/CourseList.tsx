"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Course {
  id: string;
  slug?: string | null;
  title: string;
  description: string;
  price: number;
  instructor: {
    name: string;
  };
}

export default function CourseList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/courses')
      .then((res) => res.json())
      .then((data) => {
        setCourses(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading courses...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {courses.map((course) => (
        <div key={course.id} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-semibold mb-2">{course.title}</h3>
          <p className="text-gray-600 mb-4 line-clamp-2">{course.description}</p>
          <div className="flex justify-between items-center">
            <span className="text-indigo-600 font-bold">
              {course.price === 0 ? 'Free' : `$${course.price}`}
            </span>
            <Link 
              href={course.slug ? `/courses/${course.slug}` : '/courses'}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
            >
              View Course
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
