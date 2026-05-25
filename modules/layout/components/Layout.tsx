"use client";

import { usePathname } from 'next/navigation';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Topbar />
      <div className="flex flex-1 relative">
        {isDashboard && (
          <aside className="w-64 bg-white border-r hidden md:block">
            <Sidebar />
          </aside>
        )}
        <main className={`flex-1 ${isDashboard ? 'p-6' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
