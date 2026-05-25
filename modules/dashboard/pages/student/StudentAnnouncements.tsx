"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { Pin } from 'lucide-react';

type AnnouncementItem = {
  id: string;
  courseTitle: string;
  title: string;
  content: string | null;
  pinned: boolean;
  createdAt: string;
  authorName: string;
  isRead: boolean;
};

export default function StudentAnnouncements({ announcements }: { announcements: AnnouncementItem[] }) {
  const [items, setItems] = useState<AnnouncementItem[]>(announcements);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    try {
      const res = await fetch(`/api/announcements/${id}/read`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setItems((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: false } : a)));
        toast.error(data?.error || 'Gagal menandai terbaca');
      }
    } catch {
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: false } : a)));
      toast.error('Gagal menandai terbaca');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
        <p className="text-slate-500 text-sm mt-1">Pengumuman terbaru dari kursus yang kamu ikuti.</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-slate-600 text-sm">Belum ada pengumuman.</div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <button
              key={a.id}
              onClick={() => (a.isRead ? null : markRead(a.id))}
              className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {a.pinned ? <Pin className="w-4 h-4 text-amber-600 flex-shrink-0" /> : null}
                    <div className="font-bold text-slate-900 truncate">{a.title}</div>
                    {!a.isRead ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                        BARU
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {a.courseTitle} • {a.authorName} • {new Date(a.createdAt).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
              {a.content ? <div className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{a.content}</div> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
