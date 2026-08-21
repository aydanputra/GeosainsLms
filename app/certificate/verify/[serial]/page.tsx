
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Download, FileText, Calendar, User, Link as LinkIcon, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function CertificateVerifyPage({ params }: { params: Promise<{ serial: string }> }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [serial, setSerial] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    // Check session (mock check for now, ideally call /api/auth/me or check cookie)
    // We can assume if download fails with 401, user is not logged in.
    // But for UI state, we might want to check upfront.
    // For now, let's rely on download action to handle auth redirect if needed.
    
    params.then(p => {
        setSerial(p.serial);
        fetch(`/api/certificates/verify/${p.serial}`)
        .then(res => {
            if (res.ok) return res.json();
            throw new Error('Invalid');
        })
        .then(data => {
            if (data.valid) setData(data);
            else setError(true);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    });
  }, [params]);

  const handleDownload = async () => {
      // Optimistic check: if we know user isn't logged in, redirect. 
      // But since we don't have global state here easily, let's try the endpoint.
      
      // Open in new tab? If it's a download, it's fine. 
      // But if it redirects to login, new tab is bad.
      // Let's try fetch first to check status.
      try {
          const res = await fetch(`/api/certificates/${serial}/download`, { method: 'HEAD' });
          if (res.status === 401) {
              toast.error('Silakan login untuk mengunduh sertifikat.');
              router.push(`/login?next=/certificate/verify/${serial}`);
              return;
          }
          if (res.status === 403) {
              toast.error('Anda tidak memiliki izin untuk mengunduh sertifikat ini.');
              return;
          }
          
          // If OK, trigger real download
          window.open(`/api/certificates/${serial}/download`, '_blank');
      } catch {
          toast.error('Gagal mengunduh sertifikat.');
      }
  };

  const copyLink = () => {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
      toast.success('Link verifikasi disalin!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Sertifikat Tidak Ditemukan</h1>
            <p className="text-slate-500">Nomor seri sertifikat tidak valid atau belum terdaftar dalam sistem kami.</p>
          </div>
          <Link 
            href="/"
            className="block w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Valid Badge */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-center gap-2 text-emerald-700 font-medium">
          <CheckCircle className="w-5 h-5" />
          Sertifikat Terverifikasi Valid
        </div>

        {/* Certificate Card */}
        <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-100">
          <div className="bg-slate-900 text-white p-8 text-center space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            <div className="relative z-10">
                <FileText className="w-12 h-12 mx-auto text-indigo-400 mb-4" />
                <h1 className="text-3xl font-bold">Certificate of Completion</h1>
                <p className="text-slate-400 font-mono mt-2 tracking-widest">{data.serial}</p>
            </div>
          </div>
          
          <div className="p-8 md:p-12 space-y-8 text-center">
            <div className="space-y-2">
              <p className="text-slate-500 text-sm uppercase tracking-wider font-semibold">Diberikan kepada</p>
              <h2 className="text-3xl font-bold text-slate-900">{data.studentName}</h2>
            </div>

            <div className="w-16 h-1 bg-slate-100 mx-auto rounded-full"></div>

            <div className="space-y-2">
              <p className="text-slate-500 text-sm uppercase tracking-wider font-semibold">Telah menyelesaikan kursus</p>
              <h3 className="text-2xl font-bold text-indigo-600">{data.courseTitle}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100 text-left">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-600">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Instruktur</p>
                  <p className="font-medium text-slate-900">{data.instructorName}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Tanggal Selesai</p>
                  <p className="font-medium text-slate-900">{new Date(data.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
            </div>

            <div className="pt-8 flex flex-col md:flex-row items-center justify-center gap-4">
              <button 
                onClick={handleDownload}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 w-full md:w-auto justify-center"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              
              <button 
                onClick={copyLink}
                className="inline-flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl font-bold hover:bg-slate-50 transition-all w-full md:w-auto justify-center"
              >
                <LinkIcon className="w-5 h-5" />
                Salin Link
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-4">
                *Login diperlukan untuk mengunduh sertifikat (Hanya Pemilik/Admin)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
