import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Certificate Builder | GeoSains LMS',
};

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[9999] bg-white">{children}</div>;
}

