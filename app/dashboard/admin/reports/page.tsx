import { Suspense } from 'react';
import AdminReports from '@/modules/dashboard/pages/admin/AdminReports';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6" />}>
      <AdminReports />
    </Suspense>
  );
}
