"use client";
/* eslint-disable @next/next/no-img-element */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Bell, Check, Loader2, Mail, SendHorizonal, Trash2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useDashboardStore } from '@/modules/dashboard/store/useDashboardStore';
import ConfirmDialog from '@/modules/dashboard/components/ConfirmDialog';

type Kind = 'messages' | 'alerts';
type MessageView = 'dm' | 'products' | 'admin';
type AlertView = 'enrollments' | 'purchases' | 'general';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

type DirectThread = {
  id: string;
  peer: { id: string; name: string; email: string; avatarUrl: string | null; role: string };
  lastMessageAt: string | null;
  lastMessageText: string | null;
  lastMessageSenderId: string | null;
  unreadCount: number;
  isContextThread: boolean;
};

type DirectMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string; email: string; avatarUrl: string | null; role: string };
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function isNearBottom(el: HTMLElement) {
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  return distance < 120;
}

function parseNotificationMessage(message: string): { text: string; href: string | null; preview: string } {
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

  const text = kept.join('\n');
  const preview = (kept[0] || '').trim();
  return { text, href, preview };
}

function parseChatPayload(message: string): {
  text: string;
  href: string | null;
  preview: string;
  courseTitle: string | null;
  slug: string | null;
  commentId: string | null;
} {
  const lines = String(message || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let href: string | null = null;
  let courseTitle: string | null = null;
  let slug: string | null = null;
  let commentId: string | null = null;
  const kept: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    const lower = line.toLowerCase();
    if (lower.startsWith('link:')) {
      const candidate = line.slice('LINK:'.length).trim();
      if (candidate) href = candidate;
      continue;
    }
    if (lower.startsWith('kursus:')) {
      const candidate = line.slice('Kursus:'.length).trim();
      if (candidate) courseTitle = candidate;
      continue;
    }
    if (lower.startsWith('slug:')) {
      const candidate = line.slice('Slug:'.length).trim();
      if (candidate) slug = candidate;
      continue;
    }
    if (lower.startsWith('comment_id:')) {
      const candidate = line.slice('COMMENT_ID:'.length).trim();
      if (candidate) commentId = candidate;
      continue;
    }
    if (lower.startsWith('user:') && (courseTitle || slug || href)) continue;
    kept.push(line);
  }

  const text = kept.join('\n');
  const preview = (kept[0] || courseTitle || '').trim();
  return { text, href, preview, courseTitle, slug, commentId };
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function isProductOrServiceThread(t: DirectThread) {
  if (typeof t.isContextThread === 'boolean') return t.isContextThread;
  const meta = parseChatPayload(String(t.lastMessageText || ''));
  if (meta.courseTitle || meta.slug || meta.href || meta.commentId) return true;
  const raw = String(t.lastMessageText || '').toLowerCase();
  return raw.includes('comment_id:') || raw.includes('kursus:') || raw.includes('produk:') || raw.includes('slug:');
}

function isContextMessage(body: string) {
  const meta = parseChatPayload(String(body || ''));
  if (meta.courseTitle || meta.slug || meta.href || meta.commentId) return true;
  const raw = String(body || '').toLowerCase();
  return raw.includes('comment_id:') || raw.includes('kursus:') || raw.includes('produk:') || raw.includes('slug:') || raw.includes('link:');
}

function classifyNotification(n: NotificationItem): { kind: Kind; view: MessageView | AlertView } {
  const title = String(n.title || '').trim();
  const titleLower = title.toLowerCase();
  const meta = parseNotificationMessage(n.message);
  const textLower = meta.text.toLowerCase();

  const isAdminMessage =
    titleLower.startsWith('admin') ||
    titleLower.startsWith('kebijakan') ||
    titleLower.startsWith('program') ||
    titleLower.startsWith('promo') ||
    titleLower.startsWith('diskon');

  const isDirectMessage = titleLower.startsWith('pesan dari') || titleLower.startsWith('dm') || titleLower.startsWith('direct message');
  const isQa = titleLower.startsWith('q&a') || titleLower.startsWith('balasan dari');
  const isCourseOrProductMessage =
    titleLower === 'pesan kursus' ||
    titleLower === 'komentar kursus' ||
    titleLower.startsWith('komentar') ||
    titleLower.includes('kursus') ||
    titleLower.includes('produk') ||
    textLower.includes('kursus:') ||
    textLower.includes('produk:') ||
    textLower.includes('slug:');

  const isEnrollment = titleLower.startsWith('pendaftaran') || titleLower.includes('enroll');
  const isPurchase =
    titleLower.startsWith('pesanan') || titleLower.startsWith('pembelian') || titleLower.includes('order') || textLower.includes('order:');

  if (isAdminMessage) return { kind: 'messages', view: 'admin' };
  if (isDirectMessage) return { kind: 'messages', view: 'dm' };
  if (isEnrollment) return { kind: 'alerts', view: 'enrollments' };
  if (isPurchase) return { kind: 'alerts', view: 'purchases' };
  if (isQa || isCourseOrProductMessage) return { kind: 'messages', view: 'products' };
  return { kind: 'alerts', view: 'general' };
}

function InboxPage({ redirectPath }: { redirectPath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useDashboardStore();
  const myId = user?.id ? String(user.id) : null;
  const pushLogin = () => router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  const dmScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const isPollingRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsMobile(Boolean(mq.matches));
    apply();
    const onChange = () => apply();
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const kind: Kind = useMemo(() => {
    const raw = searchParams.get('tab');
    if (raw === 'alerts') return 'alerts';
    return 'messages';
  }, [searchParams]);

  const view = useMemo((): MessageView | AlertView => {
    const raw = searchParams.get('view');
    if (kind === 'messages') {
      if (raw === 'products' || raw === 'admin') return raw;
      return 'dm';
    }
    if (raw === 'purchases' || raw === 'general') return raw;
    return 'enrollments';
  }, [kind, searchParams]);

  const isChatView = kind === 'messages' && (view === 'dm' || view === 'products' || view === 'admin');

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');

  const [threads, setThreads] = useState<DirectThread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [isLoadingDmMessages, setIsLoadingDmMessages] = useState(false);
  const [dmDraft, setDmDraft] = useState('');
  const [isSendingDm, setIsSendingDm] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const clearMeta = useMemo(() => {
    const label =
      kind === 'messages'
        ? view === 'products'
          ? 'Produk'
          : view === 'admin'
            ? 'Admin'
            : 'Direct'
        : view === 'enrollments'
          ? 'Pendaftaran'
          : view === 'purchases'
            ? 'Pembelian'
            : 'Umum';

    const title =
      kind === 'messages'
        ? view === 'products'
          ? 'Hapus semua riwayat Produk?'
          : view === 'admin'
            ? 'Hapus semua riwayat Admin?'
            : 'Hapus semua riwayat Direct?'
        : `Hapus semua riwayat ${label}?`;

    const description =
      kind === 'messages'
        ? view === 'products'
          ? 'Ini akan menghapus riwayat pesan Produk & Layanan dan juga menghapus komentar terkait di halaman detail kursus. Tindakan ini tidak bisa dibatalkan.'
          : view === 'admin'
            ? 'Ini akan menghapus riwayat pesan dengan Admin dan notifikasi Admin. Tindakan ini tidak bisa dibatalkan.'
            : 'Ini akan menghapus semua riwayat Direct Message. Tindakan ini tidak bisa dibatalkan.'
        : `Ini akan menghapus semua notifikasi pada tab ${label}. Tindakan ini tidak bisa dibatalkan.`;

    return { label, title, description };
  }, [kind, view]);

  const openClearDialog = () => setClearDialogOpen(true);

  const filteredThreads = useMemo(() => {
    if (!isChatView) return [];
    const q = normalizeQuery(search);
    const wantAdmin = view === 'admin';
    const wantProducts = view === 'products';
    return threads
      .filter((t) => (wantAdmin ? String(t.peer.role) === 'ADMIN' : String(t.peer.role) !== 'ADMIN'))
      .filter((t) => {
        if (wantAdmin) return true;
        if (wantProducts) return isProductOrServiceThread(t);
        if (view === 'dm') return !isProductOrServiceThread(t);
        return true;
      })
      .filter((t) => (unreadOnly ? Number(t.unreadCount || 0) > 0 : true))
      .filter((t) => {
        if (!q) return true;
        const hay = `${t.peer.name}\n${t.peer.email}\n${t.lastMessageText || ''}`.toLowerCase();
        return hay.includes(q);
      });
  }, [isChatView, threads, unreadOnly, search, view]);

  const filteredItems = useMemo(() => {
    const q = normalizeQuery(search);
    return items
      .filter((n) => {
        const bucket = classifyNotification(n);
        return bucket.kind === kind && bucket.view === view;
      })
      .filter((n) => (unreadOnly ? !n.read : true))
      .filter((n) => {
        if (!q) return true;
        const meta = parseNotificationMessage(n.message);
        const hay = `${n.title}\n${meta.text}`.toLowerCase();
        return hay.includes(q);
      });
  }, [items, kind, view, unreadOnly, search]);

  const unreadCount = useMemo(() => {
    if (isChatView) {
      const threadUnread = filteredThreads.reduce((sum, t) => sum + (Number(t.unreadCount || 0) || 0), 0);
      const notifUnread = view === 'admin' ? filteredItems.filter((n) => !n.read).length : 0;
      return threadUnread + notifUnread;
    }
    return filteredItems.filter((n) => !n.read).length;
  }, [filteredItems, filteredThreads, isChatView, view]);

  const active = useMemo(() => {
    if (isMobile && !isChatView && !selectedId) return null;
    const id = selectedId || filteredItems[0]?.id || null;
    if (!id) return null;
    return filteredItems.find((n) => n.id === id) || items.find((n) => n.id === id) || null;
  }, [filteredItems, isChatView, isMobile, items, selectedId]);

  const activeThread = useMemo(() => {
    if (!isChatView) return null;
    if ((view === 'admin' || view === 'products') && selectedId) return null;
    const idFromQuery = searchParams.get('threadId');
    const queryId = typeof idFromQuery === 'string' && idFromQuery ? idFromQuery : null;
    if (queryId) return threads.find((t) => t.id === queryId) || null;

    if (isMobile && !activeThreadId) return null;
    const preferred = activeThreadId && filteredThreads.some((t) => t.id === activeThreadId) ? activeThreadId : null;
    const id = preferred || filteredThreads[0]?.id || null;
    if (!id) return null;
    return filteredThreads.find((t) => t.id === id) || null;
  }, [activeThreadId, filteredThreads, isChatView, isMobile, searchParams, selectedId, threads, view]);

  const showMobileDetail = useMemo(() => {
    if (!isMobile) return false;
    if (!isChatView) return false;
    if (selectedId && active) return true;
    return Boolean(activeThread?.id);
  }, [active, activeThread?.id, isChatView, isMobile, selectedId]);

  const activeChatContext = useMemo(() => {
    if (view !== 'products') return null;
    const fromThread = activeThread?.lastMessageText ? parseChatPayload(String(activeThread.lastMessageText || '')) : null;
    if (fromThread && (fromThread.courseTitle || fromThread.slug || fromThread.href)) return fromThread;
    for (const msg of dmMessages) {
      const meta = parseChatPayload(msg.body);
      if (meta.courseTitle || meta.slug || meta.href) return meta;
    }
    return null;
  }, [activeThread?.lastMessageText, dmMessages, view]);

  const visibleDmMessages = useMemo(() => {
    if (view === 'products') return dmMessages.filter((m) => isContextMessage(m.body));
    if (view === 'dm') return dmMessages.filter((m) => !isContextMessage(m.body));
    return dmMessages;
  }, [dmMessages, view]);

  const load = async () => {
    setIsLoading(true);
    try {
      const url = `/api/notifications?limit=200`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        pushLogin();
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat');
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      const mapped = list.map((n: any) => ({
        id: String(n.id),
        title: String(n.title || ''),
        message: String(n.message || ''),
        read: Boolean(n.read),
        createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date(n.createdAt).toISOString(),
      }));
      setItems(mapped);
      setSelectedId(null);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isChatView) setSelectedId(filteredItems[0]?.id || null);
    else setSelectedId(null);
  }, [filteredItems, isChatView, kind, view]);

  const loadThreads = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setIsLoadingThreads(true);
    try {
      const res = await fetch('/api/messages/threads?limit=50', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        pushLogin();
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat pesan');
      const list = Array.isArray(data?.threads) ? data.threads : [];
      setThreads(
        list.map((t: any) => ({
          id: String(t.id),
          peer: {
            id: String(t.peer?.id || ''),
            name: String(t.peer?.name || t.peer?.email || ''),
            email: String(t.peer?.email || ''),
            avatarUrl:
              typeof t.peer?.avatarUrl === 'string' && t.peer.avatarUrl.trim() && t.peer.avatarUrl.trim().toLowerCase() !== 'null'
                ? t.peer.avatarUrl.trim()
                : null,
            role: String(t.peer?.role || ''),
          },
          lastMessageAt: t.lastMessageAt ? new Date(t.lastMessageAt).toISOString() : null,
          lastMessageText: typeof t.lastMessageText === 'string' ? t.lastMessageText : null,
          lastMessageSenderId: typeof t.lastMessageSenderId === 'string' ? t.lastMessageSenderId : null,
          unreadCount: Number(t.unreadCount || 0) || 0,
          isContextThread: Boolean(t.isContextThread),
        }))
      );
    } catch (e: any) {
      if (!silent) toast.error(e?.message || 'Gagal memuat pesan');
    } finally {
      if (!silent) setIsLoadingThreads(false);
    }
  };

  const loadThreadMessages = async (threadId: string, opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setIsLoadingDmMessages(true);
    try {
      const res = await fetch(`/api/messages/threads/${encodeURIComponent(threadId)}/messages?limit=50`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        pushLogin();
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat pesan');
      const list = Array.isArray(data?.messages) ? data.messages : [];
      setDmMessages(
        list.map((m: any) => ({
          id: String(m.id),
          body: String(m.body || ''),
          createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date(m.createdAt).toISOString(),
          sender: {
            id: String(m.sender?.id || ''),
            name: String(m.sender?.name || m.sender?.email || ''),
            email: String(m.sender?.email || ''),
            avatarUrl: typeof m.sender?.avatarUrl === 'string' ? m.sender.avatarUrl : null,
            role: String(m.sender?.role || ''),
          },
        }))
      );
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t)));
      if (!silent) router.refresh();
    } catch (e: any) {
      if (!silent) toast.error(e?.message || 'Gagal memuat pesan');
    } finally {
      if (!silent) setIsLoadingDmMessages(false);
    }
  };

  useEffect(() => {
    if (!isChatView) return;
    loadThreads();
  }, [isChatView]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isChatView) return;
    const threadId = searchParams.get('threadId');
    if (!threadId) return;
    const t = threads.find((x) => x.id === threadId);
    if (!t) return;
    const desired: MessageView = String(t.peer.role) === 'ADMIN' ? 'admin' : isProductOrServiceThread(t) ? 'products' : 'dm';
    if (String(view) === desired) return;
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', 'messages');
    sp.set('view', desired);
    router.push(`${redirectPath}?${sp.toString()}`);
  }, [isChatView, redirectPath, router, searchParams, threads, view]);

  useEffect(() => {
    if (!isChatView) return;
    if (!activeThread?.id) return;
    if (isLoadingDmMessages) return;
    const el = dmScrollRef.current;
    if (!el) return;
    if (!shouldAutoScrollRef.current) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [activeThread?.id, dmMessages, isChatView, isLoadingDmMessages]);

  useEffect(() => {
    if (!isChatView) return;
    const nextId = activeThread?.id || null;
    if (!nextId) {
      setActiveThreadId(null);
      setDmMessages([]);
      return;
    }
    setActiveThreadId(nextId);
    shouldAutoScrollRef.current = true;
    loadThreadMessages(nextId);
  }, [isChatView, activeThread?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isChatView) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        await loadThreads({ silent: true });
        if (activeThread?.id) {
          await loadThreadMessages(activeThread.id, { silent: true });
        }
      } finally {
        isPollingRef.current = false;
      }
    };

    tick();
    const id = window.setInterval(tick, 3500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeThread?.id, isChatView]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchRead = async (payload: any) => {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      pushLogin();
      return { ok: false, error: 'Unauthorized' };
    }
    if (!res.ok) return { ok: false, error: data?.error || 'Gagal memperbarui' };
    return { ok: true };
  };

  const markAllRead = async () => {
    if (isUpdating || unreadCount === 0) return;
    setIsUpdating(true);
    try {
      if (isChatView) {
        const ids = filteredThreads.filter((t) => Number(t.unreadCount || 0) > 0).map((t) => t.id);
        await Promise.all(ids.map((id) => fetch(`/api/messages/threads/${encodeURIComponent(id)}/read`, { method: 'POST' })));
        setThreads((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, unreadCount: 0 } : t)));
        if (view === 'admin') {
          const notifIds = filteredItems.filter((n) => !n.read).map((n) => n.id);
          if (notifIds.length > 0) {
            const res = await patchRead({ ids: notifIds });
            if (!res.ok) throw new Error(res.error);
            setItems((prev) => prev.map((n) => (notifIds.includes(n.id) ? { ...n, read: true } : n)));
          }
        }
      } else {
        const ids = filteredItems.filter((n) => !n.read).map((n) => n.id);
        const res = await patchRead({ ids });
        if (!res.ok) throw new Error(res.error);
        setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
      }
      router.refresh();
      toast.success('Semua ditandai terbaca');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menandai');
    } finally {
      setIsUpdating(false);
    }
  };

  const markOneRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const res = await patchRead({ ids: [id] });
    if (!res.ok) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    } else {
      router.refresh();
    }
  };

  const openTab = (next: Kind) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', next);
    sp.set('view', next === 'messages' ? 'dm' : 'enrollments');
    setSelectedId(null);
    setActiveThreadId(null);
    setDmMessages([]);
    router.push(`${redirectPath}?${sp.toString()}`);
  };

  const openView = (next: MessageView | AlertView) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', kind);
    sp.set('view', next);
    if (sp.has('threadId')) sp.delete('threadId');
    setSelectedId(null);
    setActiveThreadId(null);
    setDmMessages([]);
    router.push(`${redirectPath}?${sp.toString()}`);
  };

  const select = async (n: NotificationItem) => {
    setSelectedId(n.id);
    if (!n.read) await markOneRead(n.id);
  };

  const selectThread = async (t: DirectThread) => {
    setSelectedId(null);
    setActiveThreadId(t.id);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', 'messages');
    const nextView: MessageView = String(t.peer.role) === 'ADMIN' ? 'admin' : isProductOrServiceThread(t) ? 'products' : 'dm';
    sp.set('view', nextView);
    sp.set('threadId', t.id);
    router.push(`${redirectPath}?${sp.toString()}`);
  };

  const backToListMobile = () => {
    setSelectedId(null);
    setActiveThreadId(null);
    setDmMessages([]);
    const sp = new URLSearchParams(searchParams.toString());
    if (sp.has('threadId')) sp.delete('threadId');
    router.push(`${redirectPath}?${sp.toString()}`);
  };

  const selectAdminNotification = async (n: NotificationItem) => {
    setActiveThreadId(null);
    setDmMessages([]);
    setSelectedId(n.id);
    const sp = new URLSearchParams(searchParams.toString());
    if (sp.has('threadId')) sp.delete('threadId');
    router.push(`${redirectPath}?${sp.toString()}`);
    if (!n.read) await markOneRead(n.id);
  };

  const sendDm = async () => {
    if (!activeThread?.id) return;
    if (isSendingDm) return;
    const msg = dmDraft.trim();
    if (!msg) return;
    setIsSendingDm(true);
    shouldAutoScrollRef.current = true;
    try {
      const messageToSend =
        view === 'products' && activeChatContext
          ? [
              activeChatContext.courseTitle ? `Kursus: ${activeChatContext.courseTitle}` : null,
              activeChatContext.slug ? `Slug: ${activeChatContext.slug}` : null,
              activeChatContext.commentId ? `COMMENT_ID: ${activeChatContext.commentId}` : null,
              msg,
              activeChatContext.href ? `LINK:${activeChatContext.href}` : null,
            ]
              .filter(Boolean)
              .join('\n')
          : msg;

      const res = await fetch(`/api/messages/threads/${encodeURIComponent(activeThread.id)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal mengirim');
      setDmDraft('');
      await Promise.all([loadThreads(), loadThreadMessages(activeThread.id)]);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengirim');
    } finally {
      setIsSendingDm(false);
    }
  };

  const clearHistoryForCurrentTab = async () => {
    if (isClearingHistory) return;
    if (!myId) {
      toast.error('Anda harus login');
      return;
    }

    const label =
      kind === 'messages'
        ? view === 'products'
          ? 'Produk'
          : view === 'admin'
            ? 'Admin'
            : 'Direct'
        : view === 'enrollments'
          ? 'Pendaftaran'
          : view === 'purchases'
            ? 'Pembelian'
            : 'Umum';

    setIsClearingHistory(true);
    try {
      if (kind === 'messages') {
        if (view === 'admin') {
          const [resThreads, resNotif] = await Promise.all([
            fetch(`/api/messages/threads?scope=admin`, { method: 'DELETE' }),
            fetch(`/api/notifications?scope=admin`, { method: 'DELETE' }),
          ]);
          const dataThreads = await resThreads.json().catch(() => null);
          const dataNotif = await resNotif.json().catch(() => null);
          if (resThreads.status === 401 || resNotif.status === 401) {
            pushLogin();
            return;
          }
          if (!resThreads.ok) throw new Error(dataThreads?.error || 'Gagal menghapus riwayat');
          if (!resNotif.ok) throw new Error(dataNotif?.error || 'Gagal menghapus riwayat');
        } else {
          const scope = view === 'products' ? 'comments' : 'dm';
          const res = await fetch(`/api/messages/threads?scope=${encodeURIComponent(scope)}`, { method: 'DELETE' });
          const data = await res.json().catch(() => null);
          if (res.status === 401) {
            pushLogin();
            return;
          }
          if (!res.ok) throw new Error(data?.error || 'Gagal menghapus riwayat');
        }

        setSelectedId(null);
        setActiveThreadId(null);
        setDmMessages([]);
        await loadThreads();
      } else {
        const res = await fetch(`/api/notifications?scope=${encodeURIComponent(String(view))}`, { method: 'DELETE' });
        const data = await res.json().catch(() => null);
        if (res.status === 401) {
          pushLogin();
          return;
        }
        if (!res.ok) throw new Error(data?.error || 'Gagal menghapus riwayat');
      }

      setSelectedId(null);
      await load();
      router.refresh();
      toast.success(`Riwayat tab ${label} berhasil dihapus`);
      setClearDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus riwayat');
    } finally {
      setIsClearingHistory(false);
    }
  };

  const tabClass = (active: boolean) =>
    active
      ? 'py-3 text-sm font-extrabold border-b-2 transition-colors whitespace-nowrap text-indigo-700 border-indigo-600'
      : 'py-3 text-sm font-extrabold border-b-2 transition-colors whitespace-nowrap text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-200';

  const pillClass = (active: boolean) =>
    twMerge(
      'h-10 px-4 rounded-xl border text-xs font-extrabold transition-colors whitespace-nowrap shrink-0',
      active ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
    );

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="text-2xl font-bold text-slate-900 tracking-tight">Pesan & Notifikasi</div>
        </div>

        <div className="border-b border-slate-100 px-4 sm:px-6 overflow-x-auto">
          <div className="flex items-center gap-6 min-w-max">
            <button type="button" onClick={() => openTab('messages')} className={tabClass(kind === 'messages')}>
              Pesan
            </button>
            <button type="button" onClick={() => openTab('alerts')} className={tabClass(kind === 'alerts')}>
              Notifikasi
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {isChatView ? null : (
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
              <div className="flex-1">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={kind === 'messages' ? 'Cari pesan...' : 'Cari notifikasi...'}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUnreadOnly((v) => !v)}
                  className={pillClass(unreadOnly)}
                >
                  Belum dibaca
                </button>
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={isUpdating || unreadCount === 0}
                  className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-xs font-extrabold hover:bg-indigo-700 disabled:opacity-60"
                >
                  Tandai Semua
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max flex-nowrap">
              {kind === 'messages' ? (
                <>
                  <button type="button" onClick={() => openView('dm')} className={pillClass(view === 'dm')}>
                    <span className="hidden sm:inline">Direct Message</span>
                    <span className="sm:hidden">Direct</span>
                  </button>
                  <button type="button" onClick={() => openView('products')} className={pillClass(view === 'products')}>
                    <span className="hidden sm:inline">Produk & Layanan</span>
                    <span className="sm:hidden">Produk</span>
                  </button>
                  <button type="button" onClick={() => openView('admin')} className={pillClass(view === 'admin')}>
                    Admin
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => openView('enrollments')} className={pillClass(view === 'enrollments')}>
                    Pendaftaran
                  </button>
                  <button type="button" onClick={() => openView('purchases')} className={pillClass(view === 'purchases')}>
                    Pembelian
                  </button>
                  <button type="button" onClick={() => openView('general')} className={pillClass(view === 'general')}>
                    Umum
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-5">
            {isChatView ? (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] rounded-2xl border border-slate-200 overflow-hidden bg-white min-h-[520px] h-[calc(100vh-320px)]">
                <div
                  className={twMerge(
                    'flex flex-col min-h-0 lg:border-r lg:border-slate-100',
                    isMobile && showMobileDetail ? 'hidden' : ''
                  )}
                >
                  <div className="p-4 border-b border-slate-100">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-extrabold text-slate-900">Pesan</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold hover:bg-slate-50"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={openClearDialog}
                          disabled={isClearingHistory}
                          aria-label="Hapus riwayat"
                          className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-rose-700 font-extrabold hover:bg-rose-50 disabled:opacity-60 inline-flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Type your keyword"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button type="button" onClick={() => setUnreadOnly((v) => !v)} className={pillClass(unreadOnly)}>
                        Belum dibaca
                      </button>
                      <button
                        type="button"
                        onClick={markAllRead}
                        disabled={isUpdating || unreadCount === 0}
                        className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Tandai Semua
                      </button>
                    </div>
                  </div>

                  {isLoadingThreads ? (
                    <div className="flex-1 p-8 text-sm text-slate-500 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Memuat...
                    </div>
                  ) : filteredThreads.length === 0 && (view === 'admin' ? filteredItems.length === 0 : true) ? (
                    <div className="flex-1 p-10 text-center text-slate-600 text-sm">
                      <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div className="mt-3 font-bold text-slate-900">Belum ada percakapan</div>
                      <div className="mt-1 text-slate-600">
                        {view === 'products'
                          ? 'Pesan akan muncul saat ada pesan dari halaman kursus/produk.'
                          : view === 'admin'
                            ? 'Pesan akan muncul saat ada pesan dari admin.'
                            : 'Pesan akan muncul saat ada direct message baru.'}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      {view === 'admin' && filteredItems.length > 0 ? (
                        <>
                          <div className="px-4 py-2 text-[11px] font-extrabold text-slate-500 bg-slate-50 border-b border-slate-100">
                            Pengumuman Admin
                          </div>
                          {filteredItems.map((n) => {
                            const meta = parseNotificationMessage(n.message);
                            const isActive = selectedId === n.id;
                            return (
                              <button
                                key={`admin_notif_${n.id}`}
                                type="button"
                                onClick={() => selectAdminNotification(n)}
                                className={twMerge(
                                  'w-full text-left px-4 py-4 transition-colors border-b border-slate-100',
                                  isActive ? 'bg-emerald-50' : 'hover:bg-slate-50'
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className="h-11 w-11 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                                      <Bell className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="font-extrabold text-sm text-slate-900 truncate">{n.title}</div>
                                        {!n.read ? (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-extrabold shrink-0">
                                            BARU
                                          </span>
                                        ) : null}
                                      </div>
                                      {meta.preview ? <div className="text-xs text-slate-600 mt-1 truncate">{meta.preview}</div> : null}
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-slate-500 shrink-0">{formatDate(n.createdAt)}</div>
                                </div>
                              </button>
                            );
                          })}
                          {filteredThreads.length > 0 ? (
                            <div className="px-4 py-2 text-[11px] font-extrabold text-slate-500 bg-slate-50 border-b border-slate-100">
                              Direct Message Admin
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      {filteredThreads.map((t) => {
                        const isActive = activeThread?.id === t.id;
                        const when = t.lastMessageAt ? formatDate(t.lastMessageAt) : '';
                        const meta = parseChatPayload(String(t.lastMessageText || ''));
                        const preview = meta.preview;
                        const courseTitle = meta.courseTitle;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => selectThread(t)}
                            className={twMerge(
                              'w-full text-left px-4 py-4 transition-colors border-b border-slate-100',
                              isActive ? 'bg-emerald-50' : 'hover:bg-slate-50'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="h-11 w-11 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                                  {t.peer.avatarUrl ? (
                                    <img src={t.peer.avatarUrl} alt={t.peer.name || t.peer.email || ''} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="text-sm font-extrabold text-slate-600">
                                      {String(t.peer.name || t.peer.email || '?')
                                        .trim()
                                        .slice(0, 1)
                                        .toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-sm text-slate-900 truncate">{t.peer.name}</div>
                                  <div className="text-xs text-slate-500 truncate">{t.peer.email}</div>
                                  {view === 'products' && courseTitle ? (
                                    <div className="text-[11px] font-extrabold text-slate-700 mt-1 truncate">{courseTitle}</div>
                                  ) : null}
                                  {preview ? <div className="text-xs text-slate-600 mt-1 truncate">{preview}</div> : null}
                                </div>
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-2">
                                {when ? <div className="text-[10px] text-slate-500">{when}</div> : null}
                                {Number(t.unreadCount || 0) > 0 ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-extrabold">
                                    {Number(t.unreadCount || 0) > 99 ? '99+' : String(t.unreadCount)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={twMerge('flex flex-col min-h-0', isMobile && !showMobileDetail ? 'hidden' : '')}>
                  {selectedId && active ? (
                    <div className="flex-1 flex flex-col">
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 truncate">{active.title}</div>
                          <div className="text-xs text-slate-500 mt-1">{formatDate(active.createdAt)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedId(null)}
                          aria-label="Kembali"
                          className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shrink-0 inline-flex items-center justify-center"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto bg-white p-5">
                        {(() => {
                          const meta = parseNotificationMessage(active.message);
                          return (
                            <>
                              <div className="text-sm text-slate-700 whitespace-pre-wrap">{meta.text}</div>
                              {null}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ) : !activeThread ? (
                    <div className="flex-1 p-10 text-center text-slate-600 text-sm flex flex-col items-center justify-center">
                      <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div className="mt-3 font-bold text-slate-900">Pilih percakapan</div>
                      <div className="mt-1 text-slate-600">Klik salah satu chat untuk membuka percakapan.</div>
                    </div>
                  ) : (
                    <>
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {isMobile ? (
                            <button
                              type="button"
                              onClick={backToListMobile}
                              aria-label="Kembali"
                              className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shrink-0 inline-flex items-center justify-center"
                            >
                              <ArrowLeft className="w-4 h-4" />
                            </button>
                          ) : null}
                          <div className="h-10 w-10 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                            {activeThread.peer.avatarUrl ? (
                              <img src={activeThread.peer.avatarUrl} alt={activeThread.peer.name || activeThread.peer.email || ''} className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-sm font-extrabold text-slate-600">
                                {String(activeThread.peer.name || activeThread.peer.email || '?')
                                  .trim()
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 truncate">{activeThread.peer.name}</div>
                            <div className="text-xs text-slate-500 truncate">{activeThread.peer.email}</div>
                          </div>
                        </div>
                        {null}
                      </div>

                      {view === 'products' && activeChatContext ? (
                        <div className="px-5 pt-4">
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-emerald-700">Konteks</div>
                              <div className="mt-1 text-sm font-extrabold text-slate-900 truncate">
                                {activeChatContext.courseTitle || 'Produk / Kursus'}
                              </div>
                              {activeChatContext.slug ? <div className="text-xs text-slate-600 mt-1 truncate">{activeChatContext.slug}</div> : null}
                            </div>
                            {null}
                          </div>
                        </div>
                      ) : null}

                      <div
                        ref={dmScrollRef}
                        onScroll={() => {
                          const el = dmScrollRef.current;
                          if (!el) return;
                          shouldAutoScrollRef.current = isNearBottom(el);
                        }}
                        className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-5 py-4"
                      >
                        {isLoadingDmMessages ? (
                          <div className="p-8 text-sm text-slate-500 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Memuat...
                          </div>
                        ) : visibleDmMessages.length === 0 ? (
                          <div className="text-sm text-slate-600 text-center py-10">Belum ada pesan.</div>
                        ) : (
                          <div className="space-y-3">
                            {visibleDmMessages.map((m) => {
                              const isMe = Boolean(myId && m.sender.id === myId);
                              const meta = parseChatPayload(m.body);
                              const bodyText = meta.text || String(m.body || '');
                              return (
                                <div key={m.id} className={twMerge('flex', isMe ? 'justify-end' : 'justify-start')}>
                                  <div
                                    className={twMerge(
                                      'max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap shadow-sm',
                                      isMe
                                        ? 'bg-emerald-600 text-white rounded-br-md'
                                        : 'bg-white text-slate-900 rounded-bl-md border border-slate-200'
                                    )}
                                  >
                                    {bodyText}
                                    <div className={twMerge('text-[10px] mt-2', isMe ? 'text-emerald-100' : 'text-slate-500')}>
                                      {formatDate(m.createdAt)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="px-5 py-4 border-t border-slate-100 bg-white">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                            <textarea
                              value={dmDraft}
                              onChange={(e) => setDmDraft(e.target.value)}
                              rows={1}
                              placeholder="Tulis pesan..."
                              className="w-full resize-none bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={sendDm}
                            disabled={isSendingDm || dmDraft.trim().length === 0}
                            aria-label="Kirim"
                            className="h-11 w-11 rounded-full bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center justify-center"
                          >
                            {isSendingDm ? <Loader2 className="w-5 h-5 animate-spin" /> : <SendHorizonal className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 min-h-[520px] h-[calc(100vh-320px)]">
                <div
                  className={twMerge(
                    'rounded-2xl border border-slate-200 overflow-hidden bg-white flex flex-col min-h-0',
                    isMobile && active ? 'hidden' : ''
                  )}
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="text-sm font-extrabold text-slate-900">
                      {kind === 'messages'
                        ? view === 'dm'
                          ? 'Direct Message'
                          : view === 'admin'
                            ? 'Pesan Admin'
                            : 'Produk & Layanan'
                        : view === 'enrollments'
                          ? 'Pendaftaran'
                          : view === 'purchases'
                            ? 'Pembelian'
                            : 'Umum'}
                    </div>
                    {unreadCount > 0 ? (
                      <div className="text-xs font-bold text-slate-500">{unreadCount} belum dibaca</div>
                    ) : (
                      <div className="text-xs font-bold text-slate-500">Semua terbaca</div>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="flex-1 p-8 text-sm text-slate-500 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Memuat...
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="flex-1 p-10 text-center text-slate-600 text-sm flex flex-col items-center justify-center">
                      <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                        {kind === 'messages' ? <Mail className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                      </div>
                      <div className="mt-3 font-bold text-slate-900">Tidak ada data</div>
                      <div className="mt-1 text-slate-600">Coba ubah tab atau filter.</div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                      {filteredItems.map((n) => {
                        const meta = parseNotificationMessage(n.message);
                        const isActive = active?.id === n.id;
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => select(n)}
                            className={twMerge(
                              'w-full text-left px-4 py-3 transition-colors',
                              isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="font-extrabold text-sm text-slate-900 truncate">{n.title}</div>
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
                                {meta.preview ? <div className="text-xs text-slate-600 mt-1 truncate">{meta.preview}</div> : null}
                              </div>
                              <div className="text-[10px] text-slate-500 shrink-0">{formatDate(n.createdAt)}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div
                  className={twMerge(
                    'rounded-2xl border border-slate-200 overflow-hidden bg-white flex flex-col min-h-0',
                    isMobile && !active ? 'hidden' : ''
                  )}
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {isMobile && active ? (
                        <button
                          type="button"
                          onClick={() => setSelectedId(null)}
                          aria-label="Kembali"
                          className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shrink-0 inline-flex items-center justify-center"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                      ) : null}
                      <div className="text-sm font-extrabold text-slate-900 truncate">Detail</div>
                    </div>
                  </div>

                  {!active ? (
                    <div className="flex-1 p-10 text-center text-slate-600 text-sm flex flex-col items-center justify-center">
                      <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                        {kind === 'messages' ? <Mail className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                      </div>
                      <div className="mt-3 font-bold text-slate-900">Pilih item</div>
                      <div className="mt-1 text-slate-600">Klik salah satu item di daftar untuk melihat detailnya.</div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900">{active.title}</div>
                          <div className="text-xs text-slate-500 mt-1">{formatDate(active.createdAt)}</div>
                        </div>
                        {!active.read ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shrink-0">
                            BARU
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 text-sm text-slate-700 whitespace-pre-wrap">{parseNotificationMessage(active.message).text}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={clearDialogOpen}
        onClose={() => {
          if (isClearingHistory) return;
          setClearDialogOpen(false);
        }}
        onConfirm={clearHistoryForCurrentTab}
        title={clearMeta.title}
        description={clearMeta.description}
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={isClearingHistory}
      />
    </div>
  );
}

export default function MentorInboxPage() {
  return (
    <Suspense fallback={<div className="p-6" />}>
      <InboxPage redirectPath="/dashboard/mentor/inbox" />
    </Suspense>
  );
}
