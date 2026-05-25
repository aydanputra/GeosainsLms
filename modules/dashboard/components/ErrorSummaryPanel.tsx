"use client";

import { AlertCircle, X } from 'lucide-react';

interface ErrorSummaryPanelProps {
  errors: string[];
  onClose?: () => void;
}

export default function ErrorSummaryPanel({ errors, onClose }: ErrorSummaryPanelProps) {
  if (!errors || errors.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-red-800 mb-1">Gagal Mempublikasikan Kursus</h3>
          <p className="text-xs text-red-700 mb-2">Silakan perbaiki masalah berikut sebelum melanjutkan:</p>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-xs text-red-700 font-medium">
                {error}
              </li>
            ))}
          </ul>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
