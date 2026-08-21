"use client";
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-slate-300" strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 max-w-sm mb-8 leading-relaxed">{description}</p>
      
      {action && (
        <button
          onClick={action.onClick}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
