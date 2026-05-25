"use client";

import { useDashboardStore } from '../store/useDashboardStore';
import { useRouter } from 'next/navigation';
import { 
  Bell, 
  Search, 
  Menu, 
  LogOut, 
  User, 
  Settings,
  HelpCircle,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function formatBadgeCount(value: number) {
  if (!value || value <= 0) return '';
  if (value > 99) return '99+';
  return String(value);
}

type NotificationPreviewItem = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

type DmPreviewItem = {
  id: string;
  title: string;
  preview: string;
  unreadCount: number;
  createdAt: string;
};

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

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Topbar({
  role,
  qaUnansweredCount = 0,
  notificationUnreadCount = 0,
}: {
  role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
  qaUnansweredCount?: number;
  notificationUnreadCount?: number;
}) {
  const { user, clearUser, toggleSidebar, toggleSidebarCollapse, sidebarCollapsed, startNavigation } = useDashboardStore();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const messagesMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<NotificationPreviewItem[]>([]);
  const [dmThreads, setDmThreads] = useState<DmPreviewItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationPreviewItem[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  useEffect(() => {
    if (!isProfileOpen && !isMessagesOpen && !isNotificationsOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) setIsProfileOpen(false);
      if (messagesMenuRef.current && !messagesMenuRef.current.contains(target)) setIsMessagesOpen(false);
      if (notificationsMenuRef.current && !notificationsMenuRef.current.contains(target)) setIsNotificationsOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [isProfileOpen, isMessagesOpen, isNotificationsOpen]);

  const loadPreview = async (kind: 'messages' | 'alerts') => {
    if (kind === 'messages') setIsLoadingMessages(true);
    else setIsLoadingNotifications(true);
    try {
      if (kind === 'messages') {
        const [notifRes, dmRes] = await Promise.all([
          fetch(`/api/notifications?kind=messages&limit=5`, { cache: 'no-store' }),
          fetch(`/api/messages/threads?limit=5`, { cache: 'no-store' }),
        ]);

        const notifData = await notifRes.json().catch(() => null);
        const dmData = await dmRes.json().catch(() => null);

        if (notifRes.status === 401 || dmRes.status === 401) {
          startNavigation();
          router.push('/login?redirect=/dashboard');
          return;
        }

        const notifList = Array.isArray(notifData?.notifications) ? notifData.notifications : [];
        const mappedNotif = notifList.map((n: any) => ({
          id: String(n.id),
          title: String(n.title || ''),
          message: String(n.message || ''),
          read: Boolean(n.read),
          createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date(n.createdAt).toISOString(),
        }));

        const dmList = Array.isArray(dmData?.threads) ? dmData.threads : [];
        const mappedDm = dmList
          .filter((t: any) => t && t.peer)
          .map((t: any) => ({
            id: String(t.id),
            title: String(t.peer?.name || t.peer?.email || 'Direct Message'),
            preview: String(t.lastMessageText || '').trim(),
            unreadCount: Number(t.unreadCount || 0) || 0,
            createdAt: t.lastMessageAt ? new Date(t.lastMessageAt).toISOString() : new Date().toISOString(),
          }));

        setMessages(mappedNotif);
        setDmThreads(mappedDm);
      } else {
        const res = await fetch(`/api/notifications?kind=alerts&limit=5`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (res.status === 401) {
          startNavigation();
          router.push('/login?redirect=/dashboard');
          return;
        }
        if (!res.ok) return;
        const list = Array.isArray(data?.notifications) ? data.notifications : [];
        const mapped = list.map((n: any) => ({
          id: String(n.id),
          title: String(n.title || ''),
          message: String(n.message || ''),
          read: Boolean(n.read),
          createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date(n.createdAt).toISOString(),
        }));
        setNotifications(mapped);
      }
    } finally {
      if (kind === 'messages') setIsLoadingMessages(false);
      else setIsLoadingNotifications(false);
    }
  };

  const markRead = async (args: { id: string; kind: 'messages' | 'alerts'; href: string | null }) => {
    const { id, kind, href } = args;
    if (kind === 'messages') setMessages((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    else setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      if (res.ok) router.refresh();
    } catch {
    }
    if (href) {
      setIsMessagesOpen(false);
      setIsNotificationsOpen(false);
      startNavigation();
      router.push(href);
    }
  };

  const openDmThread = async (threadId: string) => {
    setDmThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t)));
    try {
      await fetch(`/api/messages/threads/${encodeURIComponent(threadId)}/read`, { method: 'POST' });
      router.refresh();
    } catch {
    }
    setIsMessagesOpen(false);
    setIsNotificationsOpen(false);
    startNavigation();
    const href =
      user?.role === 'MENTOR'
        ? `/dashboard/mentor/inbox?tab=messages&threadId=${encodeURIComponent(threadId)}`
        : user?.role === 'STUDENT'
          ? `/dashboard/student/inbox?tab=messages&threadId=${encodeURIComponent(threadId)}`
          : '/dashboard/notifications?kind=messages';
    router.push(href);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
    }
    clearUser();
    startNavigation();
    router.push('/login');
  };

  return (
    <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40 transition-all duration-300">
      <div className="flex items-center gap-4">
        {/* Mobile Toggle */}
        <button 
          onClick={() => toggleSidebar()}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Desktop Collapse Toggle */}
        <button 
          onClick={toggleSidebarCollapse}
          className="hidden md:block p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
        
        <div className="hidden md:flex items-center relative">
          <Search className="w-4 h-4 absolute left-3 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari sesuatu..." 
            className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm w-48 lg:w-64 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="relative" ref={messagesMenuRef}>
          <button
            onClick={() => {
              const next = !isMessagesOpen;
              setIsMessagesOpen(next);
              setIsNotificationsOpen(false);
              setIsProfileOpen(false);
              if (next) loadPreview('messages');
            }}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors relative"
          >
            <MessageSquare className="w-5 h-5" />
            {qaUnansweredCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                {formatBadgeCount(qaUnansweredCount)}
              </span>
            ) : null}
          </button>

          {isMessagesOpen ? (
            <div className="fixed left-3 right-3 top-16 md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-[22rem] z-50 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[70vh]">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-extrabold text-slate-900">Pesan Terbaru</div>
                <div className="text-xs text-slate-500 mt-0.5">Direct message &amp; Q&amp;A terbaru.</div>
              </div>
              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
                {isLoadingMessages ? (
                  <div className="p-4 text-sm text-slate-500">Memuat...</div>
                ) : dmThreads.length === 0 && messages.length === 0 ? (
                  <div className="p-4 text-sm text-slate-600">Belum ada pesan.</div>
                ) : (
                  <>
                    {dmThreads.map((t) => (
                      <button
                        key={`dm_${t.id}`}
                        type="button"
                        onClick={() => openDmThread(t.id)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="font-bold text-sm text-slate-900 truncate">{t.title}</div>
                              {t.unreadCount > 0 ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shrink-0">
                                  {formatBadgeCount(t.unreadCount)}
                                </span>
                              ) : null}
                            </div>
                            {t.preview ? <div className="text-xs text-slate-600 mt-1 truncate">{t.preview}</div> : null}
                          </div>
                          <div className="text-[10px] text-slate-500 shrink-0">{formatTime(t.createdAt)}</div>
                        </div>
                      </button>
                    ))}

                    {messages.map((n) => {
                      const meta = parseNotificationMessage(n.message);
                      const preview = meta.text.split('\n')[0] || '';
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => markRead({ id: n.id, kind: 'messages', href: meta.href })}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="font-bold text-sm text-slate-900 truncate">{n.title}</div>
                                {!n.read ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shrink-0">
                                    BARU
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-slate-600 mt-1 truncate">{preview}</div>
                            </div>
                            <div className="text-[10px] text-slate-500 shrink-0">{formatTime(n.createdAt)}</div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
              <div className="p-3 border-t border-slate-100 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setIsMessagesOpen(false);
                    startNavigation();
                    const href =
                      user?.role === 'MENTOR'
                        ? '/dashboard/mentor/inbox?tab=messages'
                        : user?.role === 'STUDENT'
                          ? '/dashboard/student/inbox?tab=messages'
                          : '/dashboard/notifications?kind=messages';
                    router.push(href);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-sm border border-slate-200"
                >
                  Lihat Semua Pesan
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={notificationsMenuRef}>
          <button
            onClick={() => {
              const next = !isNotificationsOpen;
              setIsNotificationsOpen(next);
              setIsMessagesOpen(false);
              setIsProfileOpen(false);
              if (next) loadPreview('alerts');
            }}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {notificationUnreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                {formatBadgeCount(notificationUnreadCount)}
              </span>
            ) : null}
          </button>

          {isNotificationsOpen ? (
            <div className="fixed left-3 right-3 top-16 md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-[22rem] z-50 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[70vh]">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-extrabold text-slate-900">Notifikasi Terbaru</div>
                <div className="text-xs text-slate-500 mt-0.5">5 notifikasi terakhir.</div>
              </div>
              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
                {isLoadingNotifications ? (
                  <div className="p-4 text-sm text-slate-500">Memuat...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-sm text-slate-600">Belum ada notifikasi.</div>
                ) : (
                  notifications.map((n) => {
                    const meta = parseNotificationMessage(n.message);
                    const preview = meta.text.split('\n')[0] || '';
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => markRead({ id: n.id, kind: 'alerts', href: meta.href })}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="font-bold text-sm text-slate-900 truncate">{n.title}</div>
                              {!n.read ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shrink-0">
                                  BARU
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-600 mt-1 truncate">{preview}</div>
                          </div>
                          <div className="text-[10px] text-slate-500 shrink-0">{formatTime(n.createdAt)}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="p-3 border-t border-slate-100 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setIsNotificationsOpen(false);
                    startNavigation();
                    const href =
                      user?.role === 'MENTOR'
                        ? '/dashboard/mentor/inbox?tab=alerts'
                        : user?.role === 'STUDENT'
                          ? '/dashboard/student/inbox?tab=alerts'
                          : '/dashboard/notifications?kind=alerts';
                    router.push(href);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-sm border border-slate-200"
                >
                  Lihat Semua Notifikasi
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>

        <div className="relative" ref={profileMenuRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-full pr-4 transition-colors border border-transparent hover:border-slate-200"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-slate-700 leading-none">{user?.name || 'User'}</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase mt-1">{user?.role || 'Guest'}</p>
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              
              <div className="py-2">
                {user?.role === 'ADMIN' && user?.isSuperAdmin ? null : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      startNavigation();
                      router.push('/dashboard/profile');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                  >
                    <User className="w-4 h-4" /> Profil Saya
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    startNavigation();
                    const href = '/dashboard/settings';
                    router.push(href);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-4 h-4" /> Pengaturan
                </button>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                >
                  <HelpCircle className="w-4 h-4" /> Bantuan
                </button>
              </div>

              <div className="border-t border-slate-100 pt-2">
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Keluar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
