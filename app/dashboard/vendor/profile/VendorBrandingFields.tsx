"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';

type VendorImageFieldProps = {
  inputName: string;
  label: string;
  initialUrl?: string | null;
  aspectClassName?: string;
  icon?: 'UPLOAD' | 'IMAGE';
};

export function VendorImageField({ inputName, label, initialUrl, aspectClassName, icon = 'UPLOAD' }: VendorImageFieldProps) {
  const [url, setUrl] = useState<string>(typeof initialUrl === 'string' ? initialUrl : '');
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const thumb = useMemo(() => (url && url.trim() ? url : ''), [url]);
  const canDelete = Boolean(thumb);

  return (
    <div className="space-y-2">
      <input type="hidden" name={inputName} value={url} />

      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-600">{label}</div>
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700 inline-flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>

      <div
        className={`relative w-full rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden ${aspectClassName || 'h-28'}`}
        role="button"
        tabIndex={0}
        onClick={() => setIsPickerOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setIsPickerOpen(true);
        }}
      >
        {thumb ? <img src={thumb} alt={label} className="absolute inset-0 w-full h-full object-cover" /> : null}
        {!thumb ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <div className="w-12 h-12 rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
                {icon === 'IMAGE' ? <ImageIcon className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
              </div>
              <div className="text-xs font-bold">{`Upload ${label}`}</div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/10" />
        )}

        {canDelete ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUrl('');
            }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-white flex items-center justify-center"
            title="Hapus"
            aria-label="Hapus"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      <MediaPickerModal isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} onSelect={(item) => setUrl(item.url)} initialTab="UPLOAD" />
    </div>
  );
}

type Props = {
  initialLogoUrl?: string | null;
  initialCoverUrl?: string | null;
};

export default function VendorBrandingFields({ initialLogoUrl, initialCoverUrl }: Props) {
  return (
    <div className="space-y-4">
      <VendorImageField inputName="logoUrl" label="Logo" initialUrl={initialLogoUrl} icon="UPLOAD" aspectClassName="h-28" />
      <VendorImageField inputName="coverUrl" label="Cover" initialUrl={initialCoverUrl} icon="IMAGE" aspectClassName="aspect-[16/7]" />
    </div>
  );
}
