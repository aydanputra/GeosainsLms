"use client";

import ReferralDashboard from '../../../affiliate/components/ReferralDashboard';

interface StudentAffiliateProps {
  stats: any;
}

export default function StudentAffiliate({ stats }: StudentAffiliateProps) {
  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Program Afiliasi</h1>
        <p className="text-sm text-slate-600 mt-1">Bagikan link afiliasi dan pantau performa serta saldo komisi.</p>
      </div>
      <ReferralDashboard initialStats={stats} />
    </div>
  );
}
