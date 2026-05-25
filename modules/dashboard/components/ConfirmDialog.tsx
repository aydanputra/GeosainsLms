"use client";

import { AlertTriangle, Loader2, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  content?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description = '',
  content,
  confirmText = "Konfirmasi",
  cancelText = "Batal",
  variant = 'danger',
  isLoading = false
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      confirmBtn: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    },
    warning: {
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      confirmBtn: 'bg-yellow-600 hover:bg-yellow-700 text-white focus:ring-yellow-500',
    },
    info: {
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    }
  };

  const currentStyle = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${currentStyle.iconBg} flex-shrink-0`}>
              <AlertTriangle className={`w-6 h-6 ${currentStyle.iconColor}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
              {content ? (
                <div className="text-slate-600 text-sm leading-relaxed">{content}</div>
              ) : (
                <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
              )}
            </div>
            <button 
              onClick={onClose}
              disabled={isLoading}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-white hover:border-slate-300 border border-transparent transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={twMerge(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
              currentStyle.confirmBtn
            )}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
