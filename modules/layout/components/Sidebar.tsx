"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDashboardStore } from '../../dashboard/store/useDashboardStore';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useDashboardStore();

  if (!user) return null;

  const links = {
    ADMIN: [
      { href: '/dashboard/admin', label: 'Overview' },
      { href: '/dashboard/admin/courses', label: 'Courses' },
      { href: '/dashboard/admin/shop', label: 'Shop' },
      { href: '/dashboard/admin/blog', label: 'Blog' },
      { href: '/dashboard/admin/pages', label: 'Halaman / Situs' },
      { href: '/dashboard/admin/affiliate', label: 'Affiliate' },
      { href: '/dashboard/settings', label: 'Pengaturan' },
      { href: '/dashboard/admin/settings', label: 'Pengaturan Platform' },
    ],
    MENTOR: [
      { href: '/dashboard/mentor', label: 'Overview' },
      { href: '/dashboard/mentor/courses', label: 'My Courses' },
      { href: '/dashboard/admin/courses/categories', label: 'Course Categories' },
      { href: '/dashboard/mentor/lessons', label: 'Lessons' },
      { href: '/dashboard/mentor/quizzes', label: 'Quizzes' },
      { href: '/dashboard/mentor/students', label: 'Students' },
    ],
    STUDENT: [
      { href: '/dashboard/student', label: 'Overview' },
      { href: '/dashboard/student/courses', label: 'My Courses' },
      { href: '/dashboard/student/orders', label: 'Orders' },
      { href: '/dashboard/student/quizzes', label: 'My Quizzes' },
      { href: '/dashboard/student/certificates', label: 'Certificates' },
      { href: '/dashboard/student/affiliate', label: 'Affiliate' },
    ],
    VENDOR: [
      { href: '/dashboard/vendor', label: 'Overview' },
      { href: '/dashboard/vendor/shop', label: 'Shop' },
      { href: '/dashboard/vendor/team', label: 'Team' },
      { href: '/dashboard/settings', label: 'Settings' },
    ],
  };

  const currentLinks = links[user.role] || [];

  return (
    <div className="h-full">
      <nav className="p-4 space-y-1">
        {currentLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
              pathname === link.href
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
