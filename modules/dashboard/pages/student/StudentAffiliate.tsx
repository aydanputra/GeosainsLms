"use client";

import ReferralDashboard from '../../../affiliate/components/ReferralDashboard';

interface StudentAffiliateProps {
  stats: any;
  isMentor?: boolean;
}

export default function StudentAffiliate({ stats, isMentor = false }: StudentAffiliateProps) {
  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Program Afiliasi</h1>
        <p className="text-sm text-slate-600 mt-1">
          {isMentor
            ? 'Sebagai mentor, Anda juga bisa menjadi affiliator untuk kursus atau produk milik mentor lain dari halaman ini.'
            : 'Bagikan link afiliasi dan pantau performa serta saldo komisi.'}
        </p>
      </div>
      <ReferralDashboard initialStats={stats} />
    </div>
  );
}
