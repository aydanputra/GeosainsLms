"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDashboardStore } from '@/modules/dashboard/store/useDashboardStore';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';
import { Loader2, Mail, MessageSquare, Plus, Search, Shield, User as UserIcon, X } from 'lucide-react';

function AdminInboxPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useDashboardStore();
  const myId = user?.id ? String(user.id) : null;
  const isSuperAdmin = Boolean((user as any)?.isSuperAdmin);
  const role = user?.role ? String(user.role) : null;
  const isAdmin = role === 'ADMIN';
  const accessDenied = Boolean(user && !isAdmin);

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) router.replace('/dashboard');
  }, [isAdmin, router, user]);

  type Ticket = {
    id: string;
    customer: { id: string; name: string; email: string; role: string };
    status: 'OPEN' | 'CLOSED';
    category: string | null;
    assignedToAdminId: string | null;
    assignee: { id: string; name: string; email: string; isSuperAdmin: boolean } | null;
    lastMessageAt: string | null;
    lastMessageText: string | null;
    lastMessageSenderId: string | null;
    createdAt: string | null;
  };

  type DirectMessage = {
    id: string;
    body: string;
    createdAt: string;
    sender: { id: string; name: string; email: string; avatarUrl: string | null; role: string };
  };

  type NotificationItem = {
    id: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
  };

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

  const tab = useMemo(() => {
    const raw = String(searchParams.get('tab') || '').toLowerCase();
    return raw === 'notifications' ? 'notifications' : 'tickets';
  }, [searchParams]);

  const view = useMemo(() => {
    const raw = String(searchParams.get('view') || '').toLowerCase();
    if (raw === 'mine' || raw === 'open' || raw === 'closed' || raw === 'all') return raw;
    return 'queue';
  }, [searchParams]);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketQuery, setTicketQuery] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const [ticketStartAt, setTicketStartAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [admins, setAdmins] = useState<Array<{ id: string; name: string; email: string; isSuperAdmin: boolean }>>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newUserQuery, setNewUserQuery] = useState('');
  const [newUsers, setNewUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [newLoadingUsers, setNewLoadingUsers] = useState(false);
  const [newSelectedUserId, setNewSelectedUserId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('PAYMENT');
  const [newMessage, setNewMessage] = useState('');
  const [newSubmitting, setNewSubmitting] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTargetId, setAssignTargetId] = useState<string>('');
  const [assignLoading, setAssignLoading] = useState(false);

  const [notifKind, setNotifKind] = useState<'alerts' | 'messages'>('alerts');
  const [notifUnreadOnly, setNotifUnreadOnly] = useState(false);
  const [notifQuery, setNotifQuery] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [selectedNotifId, setSelectedNotifId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);

  const activeTicket = useMemo(() => tickets.find((t) => t.id === selectedTicketId) || null, [tickets, selectedTicketId]);
  const activeNotification = useMemo(
    () => notifications.find((n) => n.id === selectedNotifId) || null,
    [notifications, selectedNotifId]
  );
  const canReply = useMemo(() => {
    if (!activeTicket) return false;
    if (activeTicket.status === 'CLOSED') return false;
    if (isSuperAdmin) return true;
    if (!myId) return false;
    if (!activeTicket.assignedToAdminId) return true;
    return activeTicket.assignedToAdminId === myId;
  }, [activeTicket, isSuperAdmin, myId]);

  const openTab = (next: 'tickets' | 'notifications') => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', next);
    if (next === 'tickets') sp.set('view', view);
    router.push(`/dashboard/admin/inbox?${sp.toString()}`);
  };

  const openView = (next: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', 'tickets');
    sp.set('view', next);
    router.push(`/dashboard/admin/inbox?${sp.toString()}`);
  };

  const loadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const qs = new URLSearchParams();
      qs.set('kind', notifKind);
      qs.set('limit', '100');
      if (notifUnreadOnly) qs.set('unreadOnly', '1');
      const res = await fetch(`/api/notifications?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/admin/inbox');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat notifikasi');
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      setNotifications(
        list.map((n: any) => ({
          id: String(n.id),
          title: String(n.title || ''),
          message: String(n.message || ''),
          read: Boolean(n.read),
          createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date(n.createdAt).toISOString(),
        }))
      );
      setNotifUnreadCount(typeof data?.unreadCount === 'number' ? data.unreadCount : 0);
      if (!selectedNotifId && list[0]?.id) setSelectedNotifId(String(list[0].id));
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat notifikasi');
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markNotificationsRead = async (opts: { all?: boolean; ids?: string[] }) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: notifKind, all: Boolean(opts.all), ids: Array.isArray(opts.ids) ? opts.ids : [] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/admin/inbox');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal update notifikasi');
      setNotifUnreadCount(typeof data?.unreadCount === 'number' ? data.unreadCount : 0);
      setNotifications((prev) =>
        prev.map((n) => {
          if (opts.all) return { ...n, read: true };
          if (opts.ids && opts.ids.includes(n.id)) return { ...n, read: true };
          return n;
        })
      );
    } catch (e: any) {
      toast.error(e?.message || 'Gagal update notifikasi');
    }
  };

  const deleteNotifications = async () => {
    const ok = window.confirm('Hapus semua notifikasi pada tab ini?');
    if (!ok) return;
    try {
      const res = await fetch(`/api/notifications?scope=${encodeURIComponent(notifKind)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/admin/inbox');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus notifikasi');
      setNotifications([]);
      setSelectedNotifId(null);
      setNotifUnreadCount(typeof data?.unreadCount === 'number' ? data.unreadCount : 0);
      toast.success('Notifikasi berhasil dihapus');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus notifikasi');
    }
  };

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await fetch(`/api/dashboard/admin/tickets?view=${encodeURIComponent(view)}&limit=100`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/admin/inbox');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat tiket');
      const list = Array.isArray(data?.tickets) ? data.tickets : [];
      setTickets(list);
      if (!selectedTicketId && list[0]?.id) setSelectedTicketId(String(list[0].id));
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat tiket');
    } finally {
      setLoadingTickets(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages/threads/${encodeURIComponent(ticketId)}/messages?limit=100`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/admin/inbox');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat pesan');
      const list = Array.isArray(data?.messages) ? data.messages : [];
      const ticket = data?.ticket || null;
      const startAt = ticket && typeof ticket.lastTicketCreatedAt === 'string' ? String(ticket.lastTicketCreatedAt) : null;
      setTicketStartAt(startAt || null);
      setMessages(
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
      autoScrollRef.current = true;
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat pesan');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!user || !isAdmin) return;
    if (tab !== 'tickets') return;
    loadTickets();
  }, [isAdmin, user, tab, view]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !isAdmin) return;
    if (tab !== 'notifications') return;
    loadNotifications();
  }, [isAdmin, user, tab, notifKind, notifUnreadOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !isAdmin) return;
    if (tab !== 'tickets') return;
    if (!selectedTicketId) return;
    loadMessages(selectedTicketId);
  }, [isAdmin, user, tab, selectedTicketId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeTicket?.id) return;
    setTicketStartAt(null);
    setMessages([]);
  }, [activeTicket?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!autoScrollRef.current) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [messages, ticketStartAt]);

  const visibleMessages = useMemo(() => {
    if (!ticketStartAt) return messages;
    const startMs = Date.parse(ticketStartAt);
    if (!Number.isFinite(startMs)) return messages;
    return messages.filter((m) => {
      const t = Date.parse(m.createdAt);
      return Number.isFinite(t) && t >= startMs;
    });
  }, [messages, ticketStartAt]);

  const filteredTickets = useMemo(() => {
    const q = ticketQuery.trim().toLowerCase();
    const base = Array.isArray(tickets) ? tickets : [];
    if (!q) return base;
    return base.filter((t) => `${t.customer?.name || ''} ${t.customer?.email || ''} ${t.category || ''}`.toLowerCase().includes(q));
  }, [ticketQuery, tickets]);

  const filteredNotifications = useMemo(() => {
    const q = notifQuery.trim().toLowerCase();
    const base = Array.isArray(notifications) ? notifications : [];
    if (!q) return base;
    return base.filter((n) => `${n.title} ${parseNotificationMessage(n.message).text}`.toLowerCase().includes(q));
  }, [notifQuery, notifications]);

  const send = async () => {
    if (!activeTicket?.id) return;
    if (sending) return;
    const msg = draft.trim();
    if (!msg) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/threads/${encodeURIComponent(activeTicket.id)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/admin/inbox');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal mengirim pesan');
      setDraft('');
      await Promise.all([loadTickets(), loadMessages(activeTicket.id)]);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  const ticketAction = async (ticketId: string, action: 'CLAIM' | 'CLOSE' | 'REOPEN', extra?: any) => {
    try {
      const res = await fetch(`/api/dashboard/admin/tickets/${encodeURIComponent(ticketId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(extra || {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/admin/inbox');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal memproses tiket');
      await loadTickets();
      toast.success(action === 'CLAIM' ? 'Tiket berhasil diambil' : action === 'CLOSE' ? 'Tiket ditutup' : 'Tiket dibuka kembali');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memproses tiket');
    }
  };

  const openAssign = async () => {
    if (!activeTicket?.id) return;
    if (!isSuperAdmin) return;
    setAssignTargetId(activeTicket.assignedToAdminId || '');
    if (admins.length === 0 && !loadingAdmins) {
      setLoadingAdmins(true);
      try {
        const res = await fetch('/api/users?role=ADMIN', { cache: 'no-store' });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error('Gagal memuat admin');
        const list = Array.isArray(data) ? data : [];
        setAdmins(
          list.map((u: any) => ({
            id: String(u.id),
            name: String(u.name || u.email || ''),
            email: String(u.email || ''),
            isSuperAdmin: Boolean(u.isSuperAdmin),
          }))
        );
      } catch (e: any) {
        toast.error(e?.message || 'Gagal memuat admin');
      } finally {
        setLoadingAdmins(false);
      }
    }
    setAssignOpen(true);
  };

  const doAssign = async () => {
    if (!activeTicket?.id) return;
    if (!assignTargetId) return;
    setAssignLoading(true);
    try {
      const res = await fetch(`/api/dashboard/admin/tickets/${encodeURIComponent(activeTicket.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ASSIGN', assignedToAdminId: assignTargetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/admin/inbox');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal assign tiket');
      setAssignOpen(false);
      await loadTickets();
      toast.success('Tiket berhasil di-assign');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal assign tiket');
    } finally {
      setAssignLoading(false);
    }
  };

  const openNew = async () => {
    setNewOpen(true);
    setNewSelectedUserId(null);
    setNewUserQuery('');
    setNewCategory('PAYMENT');
    setNewMessage('');
    if (newUsers.length === 0 && !newLoadingUsers) {
      setNewLoadingUsers(true);
      try {
        const res = await fetch('/api/users', { cache: 'no-store' });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error('Gagal memuat user');
        const list = Array.isArray(data) ? data : [];
        setNewUsers(
          list.map((u: any) => ({
            id: String(u.id),
            name: String(u.name || u.email || ''),
            email: String(u.email || ''),
            role: String(u.role || ''),
          }))
        );
      } catch (e: any) {
        toast.error(e?.message || 'Gagal memuat user');
      } finally {
        setNewLoadingUsers(false);
      }
    }
  };

  const filteredNewUsers = useMemo(() => {
    const q = newUserQuery.trim().toLowerCase();
    const list = Array.isArray(newUsers) ? newUsers : [];
    if (!q) return list.slice(0, 25);
    return list
      .filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q))
      .slice(0, 25);
  }, [newUserQuery, newUsers]);

  const createTicket = async () => {
    if (newSubmitting) return;
    const uid = newSelectedUserId;
    const msg = newMessage.trim();
    if (!uid) return toast.error('Pilih user');
    if (!msg) return toast.error('Pesan tidak boleh kosong');
    setNewSubmitting(true);
    try {
      const res = await fetch('/api/dashboard/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, message: msg, category: newCategory }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/admin/inbox');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal membuat tiket');
      const ticketId = typeof data?.ticketId === 'string' ? data.ticketId : null;
      setNewOpen(false);
      await loadTickets();
      if (ticketId) setSelectedTicketId(ticketId);
      toast.success('Tiket berhasil dibuat');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal membuat tiket');
    } finally {
      setNewSubmitting(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  };

  if (accessDenied) return <div>Access Denied</div>;

  const badge = (text: string, cls: string) => (
    <span className={twMerge('px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0', cls)}>{text}</span>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">Pesan & Notifikasi</div>
            <div className="text-sm text-slate-500 mt-1">Support inbox (tiket) untuk Admin & Super Admin.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" /> Buat Tiket
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 px-4 sm:px-6 overflow-x-auto">
          <div className="flex items-center gap-6 min-w-max">
            <button type="button" onClick={() => openTab('tickets')} className={twMerge('py-3 text-sm font-extrabold border-b-2', tab === 'tickets' ? 'text-indigo-700 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-200')}>
              Tiket
            </button>
            <button type="button" onClick={() => openTab('notifications')} className={twMerge('py-3 text-sm font-extrabold border-b-2', tab === 'notifications' ? 'text-indigo-700 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-200')}>
              Notifikasi
            </button>
          </div>
        </div>

        {tab === 'notifications' ? (
          <div className="p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setNotifKind('alerts')}
                  className={twMerge(
                    'h-10 px-4 rounded-xl border text-xs font-extrabold transition-colors whitespace-nowrap',
                    notifKind === 'alerts' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  Alert
                </button>
                <button
                  type="button"
                  onClick={() => setNotifKind('messages')}
                  className={twMerge(
                    'h-10 px-4 rounded-xl border text-xs font-extrabold transition-colors whitespace-nowrap',
                    notifKind === 'messages' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  Pesan
                </button>
                <label className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 inline-flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" checked={notifUnreadOnly} onChange={(e) => setNotifUnreadOnly(e.target.checked)} />
                  Unread saja
                </label>
                <div className="text-xs text-slate-500 font-medium">
                  Unread: <span className="font-extrabold text-slate-700">{notifUnreadCount}</span>
                </div>
              </div>
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  value={notifQuery}
                  onChange={(e) => setNotifQuery(e.target.value)}
                  placeholder="Cari notifikasi..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => markNotificationsRead({ all: true })}
                  className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Tandai semua terbaca
                </button>
                <button
                  type="button"
                  onClick={deleteNotifications}
                  className="h-10 px-4 rounded-xl bg-rose-600 text-xs font-extrabold text-white hover:bg-rose-700"
                >
                  Hapus semua
                </button>
                <button type="button" onClick={loadNotifications} className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5 min-h-[520px]">
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-sm font-extrabold text-slate-900">Daftar Notifikasi</div>
                </div>

                {loadingNotifications ? (
                  <div className="flex-1 p-10 text-center text-slate-600 text-sm flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Memuat...
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex-1 p-10 text-center text-slate-600 text-sm flex flex-col items-center justify-center">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="mt-3 font-bold text-slate-900">Tidak ada notifikasi</div>
                    <div className="mt-1 text-slate-600">Coba ubah filter atau matikan unread saja.</div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {filteredNotifications.map((n) => {
                      const active = n.id === selectedNotifId;
                      const meta = parseNotificationMessage(n.message);
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setSelectedNotifId(n.id);
                            if (!n.read) markNotificationsRead({ ids: [n.id] });
                          }}
                          className={twMerge('w-full text-left px-4 py-3 transition-colors', active ? 'bg-indigo-50' : 'hover:bg-slate-50')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="font-extrabold text-sm text-slate-900 truncate">{n.title || '-'}</div>
                                {!n.read ? badge('UNREAD', 'bg-amber-50 text-amber-700 border-amber-200') : null}
                              </div>
                              <div className="text-xs text-slate-600 mt-1 truncate">{meta.preview || '-'}</div>
                            </div>
                            <div className="text-[10px] text-slate-500 shrink-0">{formatDate(n.createdAt)}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-sm font-extrabold text-slate-900">Detail Notifikasi</div>
                  {activeNotification ? (
                    <div className="flex items-center gap-2">
                      {!activeNotification.read ? (
                        <button
                          type="button"
                          onClick={() => markNotificationsRead({ ids: [activeNotification.id] })}
                          className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-extrabold hover:bg-slate-50"
                        >
                          Tandai terbaca
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {!activeNotification ? (
                  <div className="flex-1 p-10 text-center text-slate-600 text-sm flex flex-col items-center justify-center">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="mt-3 font-bold text-slate-900">Pilih notifikasi</div>
                    <div className="mt-1 text-slate-600">Klik salah satu notifikasi untuk melihat detail.</div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-6 bg-white">
                    <div className="text-lg font-extrabold text-slate-900">{activeNotification.title || '-'}</div>
                    <div className="text-xs text-slate-500 mt-1">{formatDate(activeNotification.createdAt)}</div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm text-slate-800 whitespace-pre-wrap">{parseNotificationMessage(activeNotification.message).text}</div>
                    </div>
                    {parseNotificationMessage(activeNotification.message).href ? (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => router.push(String(parseNotificationMessage(activeNotification.message).href))}
                          className="h-11 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
                        >
                          Buka
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  value={ticketQuery}
                  onChange={(e) => setTicketQuery(e.target.value)}
                  placeholder="Cari user / email / kategori..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { key: 'queue', label: 'Antrian' },
                  { key: 'mine', label: 'Tugas Saya' },
                  { key: 'open', label: 'Open' },
                  { key: 'closed', label: 'Closed' },
                  { key: 'all', label: 'Semua' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => openView(t.key)}
                    className={twMerge(
                      'h-10 px-4 rounded-xl border text-xs font-extrabold transition-colors whitespace-nowrap',
                      view === t.key ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5 min-h-[520px]">
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-sm font-extrabold text-slate-900">Daftar Tiket</div>
                  <button type="button" onClick={loadTickets} className="text-xs font-extrabold text-slate-600 hover:text-slate-900">
                    Refresh
                  </button>
                </div>

                {loadingTickets ? (
                  <div className="flex-1 p-10 text-center text-slate-600 text-sm flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Memuat...
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="flex-1 p-10 text-center text-slate-600 text-sm flex flex-col items-center justify-center">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="mt-3 font-bold text-slate-900">Tidak ada tiket</div>
                    <div className="mt-1 text-slate-600">Coba ubah filter atau buat tiket baru.</div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {filteredTickets.map((t) => {
                      const active = t.id === selectedTicketId;
                      const needReply = t.status === 'OPEN' && t.lastMessageSenderId && t.lastMessageSenderId !== myId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTicketId(t.id)}
                          className={twMerge('w-full text-left px-4 py-3 transition-colors', active ? 'bg-indigo-50' : 'hover:bg-slate-50')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="font-extrabold text-sm text-slate-900 truncate">{t.customer?.name || t.customer?.email || '-'}</div>
                                {t.status === 'CLOSED' ? badge('CLOSED', 'bg-slate-100 text-slate-700 border-slate-200') : badge('OPEN', 'bg-emerald-50 text-emerald-700 border-emerald-200')}
                                {needReply ? badge('BUTUH BALASAN', 'bg-amber-50 text-amber-700 border-amber-200') : null}
                              </div>
                              <div className="text-xs text-slate-600 mt-1 truncate">{t.lastMessageText || '-'}</div>
                              <div className="text-[11px] text-slate-500 mt-1 truncate">
                                {(t.category || 'OTHER').toUpperCase()} • {t.assignee?.name ? `Assigned: ${t.assignee.name}` : 'Unassigned'}
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-500 shrink-0">{formatDate(t.lastMessageAt || t.createdAt)}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-sm font-extrabold text-slate-900 truncate">Detail Tiket</div>
                  </div>
                  {activeTicket ? (
                    <div className="flex items-center gap-2">
                      {activeTicket.status === 'OPEN' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => ticketAction(activeTicket.id, 'CLAIM')}
                            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-extrabold hover:bg-slate-50"
                          >
                            Ambil
                          </button>
                          {isSuperAdmin ? (
                            <button
                              type="button"
                              onClick={openAssign}
                              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-extrabold hover:bg-slate-50 inline-flex items-center gap-2"
                            >
                              <Shield className="w-4 h-4" />
                              Assign
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => ticketAction(activeTicket.id, 'CLOSE')}
                            className="h-9 px-3 rounded-xl bg-rose-600 text-white text-xs font-extrabold hover:bg-rose-700"
                          >
                            Tutup
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => ticketAction(activeTicket.id, 'REOPEN')}
                          className="h-9 px-3 rounded-xl bg-indigo-600 text-white text-xs font-extrabold hover:bg-indigo-700"
                        >
                          Buka Kembali
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>

                {!activeTicket ? (
                  <div className="flex-1 p-10 text-center text-slate-600 text-sm flex flex-col items-center justify-center">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="mt-3 font-bold text-slate-900">Pilih tiket</div>
                    <div className="mt-1 text-slate-600">Klik salah satu tiket untuk melihat pesan.</div>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-3 border-b border-slate-100 text-xs text-slate-600 flex items-center gap-3">
                      <div className="inline-flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-slate-500" />
                        <span className="font-extrabold text-slate-800">{activeTicket.customer?.name || '-'}</span>
                        <span className="text-slate-500">{activeTicket.customer?.email || ''}</span>
                      </div>
                      <div className="text-slate-400">•</div>
                      <div className="font-extrabold text-slate-700">{(activeTicket.category || 'OTHER').toUpperCase()}</div>
                      <div className="text-slate-400">•</div>
                      <div className="text-slate-600">{activeTicket.assignee?.name ? `Assigned: ${activeTicket.assignee.name}` : 'Unassigned'}</div>
                    </div>

                    <div
                      ref={scrollRef}
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
                        autoScrollRef.current = distance < 160;
                      }}
                      className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50"
                    >
                      {loadingMessages ? (
                        <div className="p-10 flex items-center justify-center text-slate-600 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Memuat...
                        </div>
                      ) : visibleMessages.length === 0 ? (
                        <div className="p-10 text-center text-slate-600 text-sm">Belum ada pesan.</div>
                      ) : (
                        visibleMessages.map((m) => {
                          const mine = myId && m.sender?.id === myId;
                          return (
                            <div key={m.id} className={twMerge('flex', mine ? 'justify-end' : 'justify-start')}>
                              <div className={twMerge('max-w-[85%] rounded-2xl border px-4 py-3', mine ? 'bg-white border-indigo-200' : 'bg-white border-slate-200')}>
                                <div className="text-[11px] text-slate-500 font-bold mb-1 flex items-center gap-2">
                                  <span className="truncate">{m.sender?.name || m.sender?.email || 'User'}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="truncate">{formatDate(m.createdAt)}</span>
                                </div>
                                <div className="text-sm text-slate-800 whitespace-pre-wrap">{m.body}</div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="border-t border-slate-200 p-4 bg-white">
                      {activeTicket.status === 'CLOSED' ? (
                        <div className="text-sm text-slate-600">Tiket ditutup. Klik “Buka Kembali” untuk melanjutkan.</div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <input
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              placeholder={canReply ? 'Tulis balasan...' : 'Tiket ini sedang ditangani admin lain'}
                              disabled={!canReply || sending}
                              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  send();
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={send}
                              disabled={!canReply || sending || !draft.trim()}
                              className="h-11 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                            >
                              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim'}
                            </button>
                          </div>
                          {!canReply ? <div className="text-[11px] text-slate-500 mt-2">Hanya admin assignee (atau Super Admin) yang bisa membalas.</div> : null}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {newOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => (newSubmitting ? null : setNewOpen(false))} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="text-lg font-extrabold text-slate-900">Buat Tiket</div>
              <button type="button" onClick={() => (newSubmitting ? null : setNewOpen(false))} className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-700" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-extrabold text-slate-700 mb-1">Kategori</div>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900"
                  >
                    <option value="PAYMENT">PAYMENT</option>
                    <option value="WITHDRAW">WITHDRAW</option>
                    <option value="AFFILIATE">AFFILIATE</option>
                    <option value="VENDOR">VENDOR</option>
                    <option value="COURSE">COURSE</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-700 mb-1">Cari User</div>
                  <input
                    value={newUserQuery}
                    onChange={(e) => setNewUserQuery(e.target.value)}
                    placeholder="Nama / email..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-700">
                  Pilih User
                </div>
                {newLoadingUsers ? (
                  <div className="p-6 text-sm text-slate-600 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Memuat user...
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {filteredNewUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setNewSelectedUserId(u.id)}
                        className={twMerge('w-full text-left px-4 py-3 hover:bg-slate-50', newSelectedUserId === u.id ? 'bg-indigo-50' : '')}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 truncate">{u.name}</div>
                            <div className="text-xs text-slate-500 truncate">{u.email}</div>
                          </div>
                          <div className="text-[10px] font-extrabold text-slate-700 px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                            {String(u.role || '').toUpperCase()}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-extrabold text-slate-700 mb-1">Pesan</div>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  placeholder="Tulis pesan awal..."
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewOpen(false)}
                  disabled={newSubmitting}
                  className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={createTicket}
                  disabled={newSubmitting || !newSelectedUserId || !newMessage.trim()}
                  className="h-11 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  {newSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {assignOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => (assignLoading ? null : setAssignOpen(false))} />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="text-lg font-extrabold text-slate-900">Assign Tiket</div>
              <button type="button" onClick={() => (assignLoading ? null : setAssignOpen(false))} className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-700" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {loadingAdmins ? (
                <div className="text-sm text-slate-600 flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Memuat admin...
                </div>
              ) : (
                <select
                  value={assignTargetId}
                  onChange={(e) => setAssignTargetId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900"
                >
                  <option value="">Pilih admin...</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.email}){a.isSuperAdmin ? ' [Super]' : ''}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignOpen(false)}
                  disabled={assignLoading}
                  className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={doAssign}
                  disabled={assignLoading || !assignTargetId}
                  className="h-11 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  {assignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminInboxPage() {
  return (
    <Suspense fallback={<div className="p-6" />}>
      <AdminInboxPageContent />
    </Suspense>
  );
}
