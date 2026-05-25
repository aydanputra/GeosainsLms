"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

function formatNumber(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  try {
    return new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(n);
  }
}

function TooltipContent({ active, payload, label, name }: any) {
  if (!active) return null;
  const p = Array.isArray(payload) && payload.length ? payload[0] : null;
  if (!p) return null;
  const value = p.value;
  const seriesName = name || p.name || 'Nilai';
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-3 py-2 shadow-lg">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-slate-900">
        {seriesName}: {formatNumber(value)}
      </div>
    </div>
  );
}

const gridProps = { stroke: '#E2E8F0', strokeDasharray: '4 4', vertical: false } as const;
const axisTick = { fontSize: 12, fill: '#64748B' } as const;

export const SimpleBarChart = ({ data, xKey, yKey, name }: any) => (
  <ResponsiveContainer width="100%" height={320}>
    <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
      <defs>
        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.25} />
        </linearGradient>
      </defs>
      <CartesianGrid {...gridProps} />
      <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
      <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
      <Tooltip content={(p: any) => <TooltipContent {...p} name={name} />} cursor={{ fill: 'rgba(99, 102, 241, 0.07)' }} />
      <Bar dataKey={yKey} name={name} fill="url(#barGradient)" radius={[10, 10, 10, 10]} maxBarSize={44} />
    </BarChart>
  </ResponsiveContainer>
);

export const SimpleLineChart = ({ data, xKey, yKey, name }: any) => (
  <ResponsiveContainer width="100%" height={320}>
    <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
      <CartesianGrid {...gridProps} />
      <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
      <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
      <Tooltip content={(p: any) => <TooltipContent {...p} name={name} />} cursor={{ stroke: '#6366F1', strokeOpacity: 0.25 }} />
      <Line
        type="monotone"
        dataKey={yKey}
        name={name}
        stroke="#6366F1"
        strokeWidth={3}
        dot={false}
        activeDot={{ r: 5, stroke: '#6366F1', strokeWidth: 2, fill: '#fff' }}
      />
    </LineChart>
  </ResponsiveContainer>
);

export const SimpleAreaChart = ({ data, xKey, yKey, name }: any) => (
  <ResponsiveContainer width="100%" height={320}>
    <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.32} />
          <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <CartesianGrid {...gridProps} />
      <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
      <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
      <Tooltip content={(p: any) => <TooltipContent {...p} name={name} />} cursor={{ stroke: '#0EA5E9', strokeOpacity: 0.25 }} />
      <Area type="monotone" dataKey={yKey} name={name} stroke="#0EA5E9" strokeWidth={3} fill="url(#areaGradient)" />
    </AreaChart>
  </ResponsiveContainer>
);

export const SimplePieChart = ({ data, nameKey, valueKey }: any) => (
  <ResponsiveContainer width="100%" height={320}>
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        labelLine={false}
        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
        outerRadius={92}
        innerRadius={58}
        fill="#8884d8"
        dataKey={valueKey}
        paddingAngle={2}
      >
        {data.map((entry: any, index: number) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip
        content={(p: any) => {
          if (!p?.active || !p?.payload?.length) return null;
          const item = p.payload[0] || {};
          const n = item?.payload?.[nameKey] ?? item?.name ?? '';
          const v = item?.value ?? '';
          return (
            <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-3 py-2 shadow-lg">
              <div className="text-xs font-semibold text-slate-500">{String(n)}</div>
              <div className="mt-0.5 text-sm font-bold text-slate-900">{formatNumber(v)}</div>
            </div>
          );
        }}
      />
    </PieChart>
  </ResponsiveContainer>
);
