"use client";

import Table from '../../components/Tables';

interface StudentCertificatesProps {
  certificates: any[];
}

export default function StudentCertificates({ certificates }: StudentCertificatesProps) {
  const columns = [
    { header: 'Kursus', accessorKey: 'courseTitle' },
    { header: 'No. Seri', accessorKey: 'serial' },
    { header: 'Tanggal', accessorKey: 'issuedAt' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-slate-900">Sertifikat Saya</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table 
          columns={columns} 
          data={certificates} 
          isLoading={false}
          actions={(row) => (
            <div className="flex gap-4">
              <a 
                href={`/certificate/verify/${row.serial}`} 
                target="_blank"
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                Lihat
              </a>
              <a 
                href={`/api/certificates/${row.serial}/download`} 
                target="_blank"
                className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
              >
                Download PDF
              </a>
            </div>
          )}
        />
      </div>
    </div>
  );
}
