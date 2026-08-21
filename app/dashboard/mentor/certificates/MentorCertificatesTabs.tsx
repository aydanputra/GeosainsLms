"use client";

import { useEffect, useState, type ReactNode } from 'react';

type Tab = 'ALL' | 'POLICY';

type MentorCertificatesTabsProps = {
  initialTab: Tab;
  allContent: ReactNode;
  policyContent: ReactNode;
};

export default function MentorCertificatesTabs({
  initialTab,
  allContent,
  policyContent,
}: MentorCertificatesTabsProps) {
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setTab(params.get('tab') === 'policy' ? 'POLICY' : 'ALL');
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const updateTab = (nextTab: Tab) => {
    setTab(nextTab);

    const url = new URL(window.location.href);
    if (nextTab === 'POLICY') {
      url.searchParams.set('tab', 'policy');
    } else {
      url.searchParams.set('tab', 'all');
    }

    window.history.replaceState(window.history.state, '', url.toString());
  };

  return (
    <>
      <div className="px-6 border-t border-slate-100">
        <div className="flex items-center gap-6 text-sm font-extrabold">
          <button
            type="button"
            onClick={() => updateTab('ALL')}
            className={tab === 'ALL' ? 'py-4 border-b-2 border-indigo-600 text-indigo-700' : 'py-4 text-slate-700 hover:text-slate-900'}
          >
            Semua Sertifikat
          </button>
          <button
            type="button"
            onClick={() => updateTab('POLICY')}
            className={tab === 'POLICY' ? 'py-4 border-b-2 border-indigo-600 text-indigo-700' : 'py-4 text-slate-700 hover:text-slate-900'}
          >
            Kebijakan Sertifikat
          </button>
        </div>
      </div>

      {tab === 'ALL' ? allContent : policyContent}
    </>
  );
}
