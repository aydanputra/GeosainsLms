"use client";

import { twMerge } from 'tailwind-merge';
import { MoreHorizontal } from 'lucide-react';

interface TableColumn {
  header: React.ReactNode;
  accessorKey: string;
  cell?: (value: any, row: any) => React.ReactNode;
  className?: string;
}

interface TableProps {
  columns: TableColumn[];
  data: any[];
  isLoading?: boolean;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  actions?: (row: any) => React.ReactNode;
}

export default function Table({ columns, data, isLoading, onEdit, onDelete, actions }: TableProps) {
  void onEdit;
  void onDelete;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-white rounded-2xl shadow-sm animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-12 text-center">
        <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <MoreHorizontal className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Tidak ada data</h3>
        <p className="text-slate-500 mt-1 text-sm">Belum ada data yang tersedia untuk ditampilkan saat ini.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto pb-4">
      <table className="w-full border-separate border-spacing-y-3 px-1">
        <thead>
          <tr className="bg-gradient-to-r from-blue-900 to-blue-600 rounded-2xl shadow-sm">
            {columns.map((col, index) => (
              <th 
                key={index} 
                className={twMerge(
                  "px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider first:rounded-l-2xl last:rounded-r-2xl",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
            {actions && <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wider rounded-r-2xl">Aksi</th>}
          </tr>
        </thead>
        <tbody className="space-y-4">
          {data.map((row, rowIndex) => (
            <tr 
              key={rowIndex} 
              className="group bg-white hover:bg-indigo-50/30 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 rounded-2xl"
            >
              {columns.map((col, colIndex) => (
                <td 
                  key={colIndex} 
                  className={twMerge(
                    "px-6 py-5 text-sm text-slate-700 border-t border-b border-slate-100 first:border-l first:rounded-l-2xl last:border-r last:rounded-r-2xl group-hover:border-indigo-100/50 transition-colors",
                    col.className
                  )}
                >
                  {col.cell ? col.cell(row[col.accessorKey], row) : row[col.accessorKey]}
                </td>
              ))}
              {actions && (
                <td className="px-6 py-5 text-right border-t border-b border-r border-slate-100 rounded-r-2xl group-hover:border-indigo-100/50 transition-colors">
                  {actions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
