"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Table from '../../components/Tables';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorRole: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: any;
  actor?: { id: string; name: string | null; email: string; role: string } | null;
};

const sensitiveActions = [
  'SITE_SETTINGS_UPDATE',
  'COURSE_SETTINGS_UPDATE',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_DELETE',
  'ORDER_MARK_PAID',
  'ORDER_MANUAL_PAYMENT_APPROVE',
  'ORDER_MANUAL_PAYMENT_REJECT',
  'ORDER_REFUND',
  'MENTOR_WITHDRAW_REQUEST',
  'MENTOR_WITHDRAW_AUTO',
  'MENTOR_WITHDRAW_AUTO_FAILED',
  'MENTOR_WITHDRAW_WEBHOOK',
  'MENTOR_WITHDRAW_SYNC',
  'VENDOR_STATUS_UPDATE',
  'PAYMENT_WEBHOOK',
  'PAYMENT_WEBHOOK_REJECTED',
];

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('id-ID');
}

export default function AdminAudit() {
  const [scope, setScope] = useState<'SENSITIVE' | 'ALL'>('SENSITIVE');
  const [q, setQ] = useState('');
  const [entityType, setEntityType] = useState('');
  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const actionsParam = useMemo(() => {
    if (scope !== 'SENSITIVE') return '';
    return sensitiveActions.join(',');
  }, [scope]);

  const load = useCallback(
    async (args?: { reset?: boolean }) => {
      const reset = Boolean(args?.reset);
      const nextSkip = reset ? 0 : skip;
      setLoading(true);
      try {
        const url = new URL('/api/audit/logs', window.location.origin);
        url.searchParams.set('take', '50');
        url.searchParams.set('skip', String(nextSkip));
        if (actionsParam) url.searchParams.set('actions', actionsParam);
        const query = q.trim();
        if (query) url.searchParams.set('q', query);
        const et = entityType.trim();
        if (et) url.searchParams.set('entityType', et);
        const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat audit log');
        const list = Array.isArray(data?.items) ? (data.items as AuditRow[]) : [];
        setTotal(Number(data?.total || 0));
        setItems((prev) => (reset ? list : [...prev, ...list]));
        setSkip(nextSkip + list.length);
      } catch (e: any) {
        toast.error(e?.message || 'Gagal memuat audit log');
      } finally {
        setLoading(false);
      }
    },
    [actionsParam, entityType, q, skip]
  );

  useEffect(() => {
    setSkip(0);
    load({ reset: true });
  }, [actionsParam, entityType, load]);

  const columns = useMemo(
    () => [
      {
        header: 'Waktu',
        accessorKey: 'createdAt',
        cell: (val: string) => <div className="text-xs font-semibold text-slate-700">{formatDateTime(val)}</div>,
      },
      {
        header: 'Aksi',
        accessorKey: 'action',
        cell: (val: string) => <div className="text-xs font-extrabold text-slate-900">{val}</div>,
      },
      {
        header: 'Entity',
        accessorKey: 'entityType',
        cell: (_: any, row: any) => (
          <div className="text-xs text-slate-700">
            <div className="font-extrabold text-slate-900">{String(row?.entityType || '-')}</div>
            <div className="font-mono text-[11px] text-slate-500">{String(row?.entityId || '-')}</div>
          </div>
        ),
      },
      {
        header: 'Actor',
        accessorKey: 'actorId',
        cell: (_: any, row: any) => (
          <div className="text-xs text-slate-700">
            <div className="font-extrabold text-slate-900">{String(row?.actor?.name || row?.actor?.email || row?.actorId || '-')}</div>
            <div className="text-[11px] text-slate-500">{String(row?.actorRole || row?.actor?.role || '-')}</div>
          </div>
        ),
      },
      {
        header: 'IP',
        accessorKey: 'ip',
        cell: (val: string) => <div className="text-xs font-mono text-slate-600">{val || '-'}</div>,
      },
      {
        header: 'Aksi',
        accessorKey: 'id',
        cell: (_: any, row: any) => (
          <button
            type="button"
            onClick={() => setDetail(row as AuditRow)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Detail
          </button>
        ),
      },
    ],
    []
  );

  const canLoadMore = items.length < total;

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-700 border border-slate-800 shadow-sm p-6 sm:p-8">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Audit Log</div>
        <div className="text-sm text-slate-200 mt-2">Pantau aktivitas sensitif dan perubahan operasional platform.</div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setScope('SENSITIVE')}
              className={twMerge(
                'h-10 px-4 rounded-xl border text-xs font-extrabold',
                scope === 'SENSITIVE' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              )}
            >
              Sensitif
            </button>
            <button
              type="button"
              onClick={() => setScope('ALL')}
              className={twMerge(
                'h-10 px-4 rounded-xl border text-xs font-extrabold',
                scope === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              )}
            >
              Semua
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800"
            >
              <option value="">Semua Entity</option>
              <option value="Order">Order</option>
              <option value="Payment">Payment</option>
              <option value="MentorWithdrawal">MentorWithdrawal</option>
              <option value="ShopVendor">Vendor</option>
              <option value="User">User</option>
              <option value="Page">Page</option>
            </select>

            <div className="flex gap-2 w-full sm:w-[420px]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari action/entityId/actor…"
                className="h-10 flex-1 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500"
              />
              <button
                type="button"
                onClick={() => {
                  setSkip(0);
                  load({ reset: true });
                }}
                className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-extrabold hover:bg-slate-800"
                disabled={loading}
              >
                Cari
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-3 sm:p-4">
          <Table columns={columns as any} data={items as any} isLoading={loading} />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Menampilkan {items.length.toLocaleString('id-ID')} dari {total.toLocaleString('id-ID')}
          </div>
          <button
            type="button"
            onClick={() => load({ reset: false })}
            disabled={loading || !canLoadMore}
            className={twMerge(
              'h-10 px-4 rounded-xl border text-sm font-extrabold',
              loading || !canLoadMore ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
            )}
          >
            Muat Lagi
          </button>
        </div>
      </div>

      {detail ? (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-slate-900">Detail Audit</div>
                <div className="text-xs text-slate-500 mt-1">
                  {formatDateTime(detail.createdAt)} • {detail.action}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-extrabold hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wide">Entity</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">{detail.entityType}</div>
                  <div className="mt-0.5 text-xs font-mono text-slate-600">{detail.entityId || '-'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wide">Actor</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">{detail.actor?.name || detail.actor?.email || detail.actorId || '-'}</div>
                  <div className="mt-0.5 text-xs text-slate-600">{detail.actorRole || detail.actor?.role || '-'}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200">
                  <div className="text-xs font-extrabold text-slate-900">Metadata</div>
                </div>
                <pre className="p-4 text-xs overflow-auto max-h-[420px] bg-slate-50 text-slate-800">
                  {JSON.stringify(detail.metadata ?? null, null, 2)}
                </pre>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200">
                  <div className="text-xs font-extrabold text-slate-900">User Agent</div>
                </div>
                <div className="p-4 text-xs text-slate-700 break-words">{detail.userAgent || '-'}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
