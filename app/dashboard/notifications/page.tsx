"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowUpRight, Bell, Check, Loader2 } from 'lucide-react';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function parseNotificationMessage(message: string): { text: string; href: string | null } {
  const lines = String(message || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let href: string | null = null;
  const kept: string[] = [];

  for (const line of lines) {
    if (line.startsWith('LINK:')) {
      const candidate = line.slice('LINK:'.length).trim();
      if (candidate) href = candidate;
      continue;
    }
    kept.push(line);
  }

  return { text: kept.join('\n'), href };
}

function NotificationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);
  const kind = useMemo(() => {
    const raw = searchParams.get('kind');
    if (raw === 'messages' || raw === 'alerts') return raw;
    return null;
  }, [searchParams]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = kind ? `/api/notifications?kind=${kind}` : '/api/notifications';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/notifications');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat notifikasi');
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      setItems(
        list.map((n: any) => ({
          id: String(n.id),
          title: String(n.title || ''),
          message: String(n.message || ''),
          read: Boolean(n.read),
          createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date(n.createdAt).toISOString(),
        }))
      );
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat notifikasi');
    } finally {
      setIsLoading(false);
    }
  }, [kind, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const markAllRead = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true, ...(kind ? { kind } : {}) }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/notifications');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal menandai notifikasi');
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      router.refresh();
      toast.success('Semua notifikasi ditandai terbaca');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menandai notifikasi');
    } finally {
      setIsUpdating(false);
    }
  };

  const markOneRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/notifications');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal menandai notifikasi');
      router.refresh();
    } catch (e: any) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
      toast.error(e?.message || 'Gagal menandai notifikasi');
    }
  };

  const openLink = async (n: NotificationItem) => {
    const meta = parseNotificationMessage(n.message);
    if (!meta.href) return;
    if (!n.read) await markOneRead(n.id);
    router.push(meta.href);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{kind === 'messages' ? 'Pesan' : 'Notifikasi'}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {kind === 'messages'
              ? 'Aktivitas Q&A terbaru (pertanyaan dan balasan).'
              : kind === 'alerts'
                ? 'Aktivitas terbaru (pembelian, tugas, pengumuman, dan lainnya).'
                : 'Aktivitas terbaru (Q&A, pengumuman, dan lainnya).'}
          </p>
        </div>
        <button
          onClick={markAllRead}
          disabled={isUpdating || unreadCount === 0}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          Tandai Semua
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex items-center justify-center text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Memuat...
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-slate-600 text-sm">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Bell className="w-5 h-5" />
            </div>
            <div className="mt-3 font-bold text-slate-900">Belum ada notifikasi</div>
            <div className="mt-1 text-slate-600">Notifikasi akan muncul saat ada aktivitas baru.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {items.map((n) => {
              const meta = parseNotificationMessage(n.message);
              return (
                <div key={n.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <button
                      onClick={() => (n.read ? null : markOneRead(n.id))}
                      className="min-w-0 text-left flex-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{n.title}</div>
                        {!n.read ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shrink-0">
                            BARU
                          </span>
                        ) : null}
                        {n.read ? (
                          <span className="text-slate-400 shrink-0" title="Sudah dibaca">
                            <Check className="w-4 h-4" />
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{meta.text}</div>
                      <div className="text-xs text-slate-500 mt-2">{formatDate(n.createdAt)}</div>
                    </button>

                    {meta.href ? (
                      <button
                        onClick={() => openLink(n)}
                        className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        Buka
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="p-6" />}>
      <NotificationsPageContent />
    </Suspense>
  );
}
