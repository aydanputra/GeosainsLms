"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, MessageSquare, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

type SessionUser = { id: string; role: string } | null;

export default function PublicSupportChat(props: { adminId: string | null; adminLabel?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'send' | 'history'>('send');
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [me, setMe] = useState<SessionUser>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [topic, setTopic] = useState<string>('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [ticketStatus, setTicketStatus] = useState<'OPEN' | 'CLOSED' | null>(null);
  const [ticketStartAt, setTicketStartAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      body: string;
      createdAt: string;
      sender: { id: string; name: string; email: string; avatarUrl: string | null; role: string };
    }>
  >([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [awaitingAdminAt, setAwaitingAdminAt] = useState<number | null>(null);
  const [noReplyHintShown, setNoReplyHintShown] = useState(false);
  const [systemHints, setSystemHints] = useState<Array<{ id: string; text: string; createdAt: string }>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const pollRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);

  const hidden = useMemo(() => {
    if (!pathname) return false;
    if (pathname.startsWith('/dashboard')) return true;
    return false;
  }, [pathname]);

  const adminId = props.adminId ? String(props.adminId) : null;
  const loginRedirect = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
  const isCourseDetail = useMemo(() => {
    if (!pathname) return false;
    if (!pathname.startsWith('/courses/')) return false;
    const parts = pathname.split('/').filter(Boolean);
    return parts.length === 2;
  }, [pathname]);

  const floatingBottom = useMemo(() => {
    const extra = isSmallScreen && isCourseDetail ? 84 : 0;
    return `calc(24px + ${extra}px + env(safe-area-inset-bottom, 0px))`;
  }, [isCourseDetail, isSmallScreen]);

  const panelBottom = useMemo(() => {
    const extra = isSmallScreen && isCourseDetail ? 84 : 0;
    return `calc(96px + ${extra}px + env(safe-area-inset-bottom, 0px))`;
  }, [isCourseDetail, isSmallScreen]);

  const ensureMe = async () => {
    if (loadingMe) return;
    setLoadingMe(true);
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      const data = await res.json().catch(() => ({ user: null }));
      const u = data?.user;
      if (u && u.id) setMe({ id: String(u.id), role: String(u.role || '') });
      else setMe(null);
    } catch {
      setMe(null);
    } finally {
      setLoadingMe(false);
    }
  };

  const openPanel = async () => {
    if (!adminId) return;
    setOpen(true);
    setPanelTab('send');
    await ensureMe();
  };

  const closePanel = () => {
    if (sending) return;
    setOpen(false);
  };

  const loadThreadMessages = async (id: string, opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages/threads/${encodeURIComponent(id)}/messages?limit=80`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return;
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat pesan');
      const list = Array.isArray(data?.messages) ? data.messages : [];
      const ticket = data?.ticket || null;
      const status = ticket && typeof ticket.status === 'string' ? String(ticket.status).toUpperCase() : null;
      setTicketStatus(status === 'OPEN' || status === 'CLOSED' ? (status as any) : null);
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
    } catch {
      if (!silent) toast.error('Gagal memuat pesan');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  const scheduleNoReplyHint = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setSystemHints((prev) => {
        if (noReplyHintShown) return prev;
        return [
          ...prev,
          {
            id: `hint_${Date.now()}`,
            text: 'Admin belum membalas dalam 1 menit. Mohon tunggu, tiket Anda sudah masuk antrian.',
            createdAt: new Date().toISOString(),
          },
        ];
      });
      setNoReplyHintShown(true);
    }, 60000);
  };

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      await loadThreadMessages(id, { silent: true });
    }, 5000);
  };

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const createTicket = async () => {
    if (!adminId) return;
    const selectedTopic = topic.trim();
    if (!selectedTopic) return toast.error('Pilih topik terlebih dahulu');
    const text = ticketMessage.trim();
    if (!text) return toast.error('Pesan tidak boleh kosong');
    if (!me?.id) return;
    if (sending) return;

    setSending(true);
    shouldAutoScrollRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: adminId, message: text, topic: selectedTopic }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        const redirect = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
        router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal membuat tiket');

      const id = typeof data?.threadId === 'string' ? data.threadId : null;
      if (!id) throw new Error('threadId tidak valid');
      setThreadId(id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('public_support_thread_id', id);
      }
      setTicketStatus('OPEN');
      setTicketStartAt(nowIso);
      setSystemHints([]);
      setTicketMessage('');
      setDraft('');
      setAwaitingAdminAt(Date.now());
      setNoReplyHintShown(false);
      scheduleNoReplyHint();
      toast.success('Tiket berhasil dibuat');
      await loadThreadMessages(id);
      startPolling(id);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal membuat tiket');
    } finally {
      setSending(false);
    }
  };

  const sendFollowUp = async () => {
    if (!threadId) return;
    if (ticketStatus === 'CLOSED') {
      toast.error('Tiket sudah ditutup. Silakan buat tiket baru.');
      setPanelTab('send');
      return;
    }
    const text = draft.trim();
    if (!text) return;
    if (!me?.id) return;
    if (sending) return;

    setSending(true);
    shouldAutoScrollRef.current = true;
    try {
      const res = await fetch(`/api/messages/threads/${encodeURIComponent(threadId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        const redirect = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
        router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal mengirim pesan');
      setDraft('');
      setAwaitingAdminAt(Date.now());
      setNoReplyHintShown(false);
      scheduleNoReplyHint();
      await loadThreadMessages(threadId);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hidden || !adminId) return;
    const savedThread = window.localStorage.getItem('public_support_thread_id');
    const savedOpen = window.sessionStorage.getItem('public_support_open');
    if (savedThread && typeof savedThread === 'string') setThreadId(savedThread);
    if (savedOpen === '1') setOpen(true);
  }, [adminId, hidden]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => setIsSmallScreen(Boolean(mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hidden || !adminId) return;
    window.sessionStorage.setItem('public_support_open', open ? '1' : '0');
    if (!open) stopPolling();
  }, [adminId, hidden, open]);

  useEffect(() => {
    if (hidden || !adminId) return;
    if (!open) return;
    if (!threadId) return;
    if (!me?.id) return;
    loadThreadMessages(threadId);
    startPolling(threadId);
    return () => stopPolling();
  }, [adminId, hidden, open, threadId, me?.id]);

  useEffect(() => {
    if (hidden || !adminId) return;
    if (!awaitingAdminAt) return;
    if (messages.length === 0) return;
    const hasAdminReply = messages.some((m) => {
      const role = String(m.sender?.role || '').toUpperCase();
      if (role !== 'ADMIN') return false;
      const t = new Date(m.createdAt).getTime();
      return Number.isFinite(t) && t >= awaitingAdminAt;
    });
    if (hasAdminReply) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setNoReplyHintShown(false);
      setAwaitingAdminAt(null);
    }
  }, [adminId, hidden, awaitingAdminAt, messages]);

  useEffect(() => {
    if (hidden || !adminId) return;
    const el = scrollRef.current;
    if (!el) return;
    if (!shouldAutoScrollRef.current) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [adminId, hidden, messages, systemHints]);

  const ticketTopicLabel =
    topic === 'PURCHASE' ? 'Pembelian' : topic === 'PRODUCT_SERVICE' ? 'Produk & Layanan' : topic === 'TECH_SUPPORT' ? 'Technical Support' : '';
  const ticketStartMs = useMemo(() => (ticketStartAt ? Date.parse(ticketStartAt) : NaN), [ticketStartAt]);
  const visibleMessages = useMemo(() => {
    if (!Number.isFinite(ticketStartMs)) return messages;
    return messages.filter((m) => {
      const t = Date.parse(m.createdAt);
      return Number.isFinite(t) && t >= ticketStartMs;
    });
  }, [messages, ticketStartMs]);

  if (hidden || !adminId) return null;

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className={twMerge(
          'fixed right-4 sm:right-6 z-40 h-14 w-14 rounded-full shadow-lg border border-slate-200 bg-indigo-600 text-white flex items-center justify-center',
          'hover:bg-indigo-700 active:bg-indigo-800'
        )}
        style={{ bottom: floatingBottom }}
        aria-label="Kirim pesan ke admin"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {open ? (
        <div
          className={twMerge('fixed z-50 left-3 right-3 sm:left-auto sm:right-6 sm:w-[360px] sm:max-w-[calc(100vw-48px)]')}
          style={{ bottom: panelBottom }}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => setPanelTab('send')}
                  className={twMerge(
                    'h-9 px-2 sm:px-3 rounded-xl text-xs font-extrabold border transition-colors flex-1 text-center whitespace-nowrap',
                    panelTab === 'send'
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  Pesan
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab('history')}
                  className={twMerge(
                    'h-9 px-2 sm:px-3 rounded-xl text-xs font-extrabold border transition-colors flex-1 text-center whitespace-nowrap',
                    panelTab === 'history'
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  Riwayat
                </button>
              </div>
              <button
                type="button"
                onClick={closePanel}
                disabled={sending}
                className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center disabled:opacity-60"
              >
                <X className="w-4 h-4 text-slate-700" />
              </button>
            </div>

            {!me?.id ? (
              <div className="p-4 space-y-3">
                {loadingMe ? (
                  <div className="py-10 flex flex-col items-center justify-center text-slate-600 gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <div className="text-sm font-semibold">Memuat sesi...</div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-slate-700">Untuk membuat tiket, silakan login atau daftar terlebih dahulu.</div>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => router.push(`/register?redirect=${encodeURIComponent(loginRedirect)}`)}
                        className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50"
                      >
                        Daftar
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/login?redirect=${encodeURIComponent(loginRedirect)}`)}
                        className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
                      >
                        Login
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : panelTab === 'history' ? (
              <div className="p-4">
                {!threadId ? (
                  <div className="text-sm text-slate-600 text-center py-10">Belum ada riwayat chat.</div>
                ) : (
                  <div
                    ref={scrollRef}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
                      shouldAutoScrollRef.current = distance < 160;
                    }}
                    className="h-[60vh] sm:h-[420px] overflow-y-auto p-3 bg-slate-50 space-y-2 rounded-2xl border border-slate-200"
                  >
                    {loadingMessages ? (
                      <div className="py-10 flex flex-col items-center justify-center text-slate-600 gap-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <div className="w-full max-w-[240px] space-y-2">
                          <div className="h-3 rounded bg-slate-200/80 animate-pulse" />
                          <div className="h-3 rounded bg-slate-200/80 animate-pulse w-[75%]" />
                          <div className="h-3 rounded bg-slate-200/80 animate-pulse w-[55%]" />
                        </div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-sm text-slate-600 text-center py-10">Belum ada pesan.</div>
                    ) : (
                      <>
                        {systemHints.map((h) => (
                          <div key={h.id} className="flex justify-center">
                            <div className="max-w-[90%] rounded-2xl px-3 py-2 text-[12px] bg-amber-50 text-amber-800 border border-amber-200">
                              {h.text}
                            </div>
                          </div>
                        ))}
                        {messages.map((m) => {
                          const isMe = Boolean(me?.id && m.sender?.id === me.id);
                          const senderRole = String(m.sender?.role || '').toUpperCase();
                          const bubbleCls = isMe
                            ? 'bg-indigo-600 text-white rounded-br-md'
                            : senderRole === 'ADMIN'
                              ? 'bg-white text-slate-900 rounded-bl-md border border-slate-200'
                              : 'bg-white text-slate-900 rounded-bl-md border border-slate-200';
                          return (
                            <div key={m.id} className={twMerge('flex', isMe ? 'justify-end' : 'justify-start')}>
                              <div className={twMerge('max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm', bubbleCls)}>
                                {m.body}
                                <div className={twMerge('text-[10px] mt-2', isMe ? 'text-indigo-100' : 'text-slate-500')}>
                                  {new Date(m.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : !threadId || ticketStatus === 'CLOSED' ? (
              <div className="p-4 space-y-3">
                {ticketStatus === 'CLOSED' ? (
                  <div className="text-xs text-slate-600">
                    Tiket sebelumnya sudah ditutup. Kirim pesan baru untuk membuat tiket baru.
                  </div>
                ) : null}
                <div>
                  <div className="text-xs font-extrabold text-slate-700 mb-1">Topik</div>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={sending}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">Pilih topik...</option>
                    <option value="PURCHASE">Pembelian</option>
                    <option value="PRODUCT_SERVICE">Produk & Layanan</option>
                    <option value="TECH_SUPPORT">Technical Support</option>
                  </select>
                  {ticketTopicLabel ? <div className="text-[11px] text-slate-500 mt-1">Topik: {ticketTopicLabel}</div> : null}
                </div>
                <textarea
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  rows={3}
                  placeholder="Jelaskan masalah Anda..."
                  disabled={sending}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  type="button"
                  onClick={createTicket}
                  disabled={sending || !topic.trim() || !ticketMessage.trim()}
                  className="h-11 w-full rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {ticketStatus === 'CLOSED' ? 'Buat Tiket Baru' : 'Buat Tiket'}
                </button>
              </div>
            ) : (
              <>
                <div
                  ref={scrollRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
                    shouldAutoScrollRef.current = distance < 160;
                  }}
                  className="h-[45vh] sm:h-[320px] overflow-y-auto p-3 bg-slate-50 space-y-2"
                >
                  {loadingMessages ? (
                    <div className="py-8 flex flex-col items-center justify-center text-slate-600 gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <div className="w-full space-y-2">
                        <div className="h-10 rounded-2xl bg-slate-200/80 animate-pulse w-[72%]" />
                        <div className="h-10 rounded-2xl bg-slate-200/80 animate-pulse w-[58%] ml-auto" />
                        <div className="h-10 rounded-2xl bg-slate-200/80 animate-pulse w-[66%]" />
                      </div>
                    </div>
                  ) : (
                    <>
                      {systemHints.map((h) => (
                        <div key={h.id} className="flex justify-center">
                          <div className="max-w-[90%] rounded-2xl px-3 py-2 text-[12px] bg-amber-50 text-amber-800 border border-amber-200">
                            {h.text}
                          </div>
                        </div>
                      ))}
                      {visibleMessages.map((m) => {
                        const isMe = Boolean(me?.id && m.sender?.id === me.id);
                        const senderRole = String(m.sender?.role || '').toUpperCase();
                        const bubbleCls = isMe
                          ? 'bg-indigo-600 text-white rounded-br-md'
                          : senderRole === 'ADMIN'
                            ? 'bg-white text-slate-900 rounded-bl-md border border-slate-200'
                            : 'bg-white text-slate-900 rounded-bl-md border border-slate-200';
                        return (
                          <div key={m.id} className={twMerge('flex', isMe ? 'justify-end' : 'justify-start')}>
                            <div className={twMerge('max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm', bubbleCls)}>
                              {m.body}
                              <div className={twMerge('text-[10px] mt-2', isMe ? 'text-indigo-100' : 'text-slate-500')}>
                                {new Date(m.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>

                <div className="border-t border-slate-200 p-3 bg-white">
                  <div className="flex items-center gap-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Tulis pesan..."
                      disabled={sending}
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendFollowUp();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={sendFollowUp}
                      disabled={sending || !draft.trim()}
                      className="h-10 px-3 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
