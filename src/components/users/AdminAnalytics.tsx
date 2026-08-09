import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './AdminAnalytics.css';

/**
 * Analytics dashboard — built entirely from our own transaction data.
 *
 * This is deliberately not Meta Pixel data: Meta has no read API for raw pixel
 * events, and what it does expose is ad-attributed only. Everything here is the
 * full picture from the till.
 */

const BACKEND = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:2024').replace(/\/+$/, '');

// Categorical slots — mirrors the CSS tokens. Fixed order: colour follows the
// entity, never its rank, so filtering never repaints the survivors.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const BAR_BASE = '#86b6ef';
const BAR_PEAK = '#1c5cab';
const INK_MUTED = '#898781';
const GRID = '#e8e9ec';
const AXIS = '#c3c2b7';
const SURFACE = '#ffffff';

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'Last 30 days' },
  { key: 'quarter', label: 'Last 3 months' },
  { key: 'year', label: 'Last 12 months' },
  { key: 'custom', label: 'Custom' },
];

const PERIOD_COMPARISON: Record<Period, string> = {
  today: 'vs yesterday',
  week: 'vs previous 7 days',
  month: 'vs previous 30 days',
  quarter: 'vs previous 3 months',
  year: 'vs previous 12 months',
  custom: 'vs preceding period',
};

interface Metric {
  current: number;
  previous: number;
  changePct: number | null;
}

interface SeriesPoint {
  bucket: string;
  label: string;
  revenue: number;
  transactions: number;
}

interface NamedTotal {
  name: string;
  revenue: number;
  transactions: number;
  share: number;
}

interface GameTotal {
  name: string;
  quantity: number;
  revenue: number;
}

interface AnalyticsData {
  period: Period;
  granularity: 'hour' | 'day' | 'month';
  range: { start: string; end: string };
  previousRange: { start: string; end: string };
  kpis: {
    revenue: Metric;
    transactions: Metric;
    avgTicket: Metric;
    uniqueCustomers: Metric;
    gamesPlayed: Metric;
    discounts: Metric;
  };
  timeseries: SeriesPoint[];
  hourly: { hour: number; label: string; revenue: number; transactions: number }[];
  weekday: { weekday: number; label: string; revenue: number; transactions: number }[];
  stations: NamedTotal[];
  paymentMethods: NamedTotal[];
  topGames: GameTotal[];
  bottomGames: GameTotal[];
  drinks: GameTotal[];
  customers: {
    new: number;
    returning: number;
    topSpenders: { username: string; phone: string; revenue: number; visits: number }[];
  };
  basket: { avgItemsPerTransaction: number; drinkAttachRate: number };
}

// ── Formatting ──────────────────────────────────────────────────────────────

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

/** Axis ticks need to stay short; the exact value lives in the tooltip/table. */
const compactNaira = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `₦${Math.round(n / 1_000)}k`;
  return `₦${Math.round(n)}`;
};

const count = (n: number) => Math.round(n).toLocaleString('en-NG');
const percent = (n: number) => `${(n * 100).toFixed(1)}%`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const todayInput = () => new Date().toISOString().slice(0, 10);

// ── Small presentational pieces ─────────────────────────────────────────────

/** Direction of "good" differs per metric — more discounts is not a win. */
const Delta: React.FC<{ metric: Metric; upIsGood?: boolean }> = ({ metric, upIsGood = true }) => {
  if (metric.changePct === null) {
    return <span className="analytics-delta flat">No prior data</span>;
  }
  const rounded = Math.round(metric.changePct * 10) / 10;
  if (rounded === 0) return <span className="analytics-delta flat">No change</span>;

  const isUp = rounded > 0;
  const good = isUp === upIsGood;
  return (
    <span className={`analytics-delta ${good ? 'up' : 'down'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(rounded)}%
    </span>
  );
};

const Tile: React.FC<{
  label: string;
  value: string;
  metric: Metric;
  upIsGood?: boolean;
}> = ({ label, value, metric, upIsGood }) => (
  <div className="analytics-tile">
    <p className="analytics-tile-label">{label}</p>
    <p className="analytics-tile-value">{value}</p>
    <Delta metric={metric} upIsGood={upIsGood} />
  </div>
);

interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

const ChartTooltip: React.FC<{ title?: string; rows: TooltipRow[] }> = ({ title, rows }) => (
  <div className="analytics-tooltip">
    {title ? <p className="analytics-tooltip-label">{title}</p> : null}
    {rows.map(row => (
      <div className="analytics-tooltip-row" key={row.label}>
        {row.color ? (
          <span className="analytics-swatch" style={{ background: row.color }} aria-hidden="true" />
        ) : null}
        <span>{row.label}</span>
        <strong>{row.value}</strong>
      </div>
    ))}
  </div>
);

/** Every chart carries a table twin so no value is reachable only by hovering. */
const DataTable: React.FC<{
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: Record<string, React.ReactNode>[];
  empty?: string;
}> = ({ columns, rows, empty = 'No data for this period.' }) => {
  if (!rows.length) return <p className="analytics-empty">{empty}</p>;
  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} className={c.numeric ? 'num' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map(c => (
                <td key={c.key} className={c.numeric ? 'num' : undefined}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** A card that can swap its chart for the equivalent table. */
const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  full?: boolean;
  tools?: React.ReactNode;
  chart: React.ReactNode;
  table: React.ReactNode;
}> = ({ title, subtitle, full, tools, chart, table }) => {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`analytics-card${full ? ' full' : ''}`}>
      <div className="analytics-card-head">
        <h3>{title}</h3>
        <div className="analytics-card-tools">
          {tools}
          <button
            type="button"
            className={`analytics-toggle${showTable ? ' active' : ''}`}
            onClick={() => setShowTable(v => !v)}
            aria-pressed={showTable}
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </div>
      {subtitle ? <p className="analytics-card-sub">{subtitle}</p> : null}
      {showTable ? table : chart}
    </section>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

const AdminAnalytics: React.FC = () => {
  const [period, setPeriod] = useState<Period>('week');
  const [customStart, setCustomStart] = useState(todayInput());
  const [customEnd, setCustomEnd] = useState(todayInput());
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trendMetric, setTrendMetric] = useState<'revenue' | 'transactions'>('revenue');

  // Guards against an earlier slow response overwriting a later fast one.
  const requestRef = useRef(0);

  const fetchAnalytics = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');

    try {
      const params: Record<string, string> = { period };
      if (period === 'custom') {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const token = sessionStorage.getItem('token') || localStorage.getItem('operatorToken') || '';
      const res = await axios.get(`${BACKEND}/v1/admin/reports/analytics`, {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (requestId !== requestRef.current) return;
      setData(res.data);
    } catch (err: any) {
      if (requestId !== requestRef.current) return;
      setError(err?.response?.data?.error || 'Could not load analytics. Please try again.');
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ── Derived chart inputs ──────────────────────────────────────────────────

  const trendKey = trendMetric;
  const trendColor = SERIES[0];

  const peakHour = useMemo(() => {
    if (!data?.hourly?.length) return -1;
    return data.hourly.reduce((best, h, i, arr) => (h.revenue > arr[best].revenue ? i : best), 0);
  }, [data]);

  const peakWeekday = useMemo(() => {
    if (!data?.weekday?.length) return -1;
    return data.weekday.reduce((best, d, i, arr) => (d.revenue > arr[best].revenue ? i : best), 0);
  }, [data]);

  /** Trading hours are noisy across a closed night — show only hours with activity. */
  const activeHours = useMemo(
    () => (data?.hourly || []).filter(h => h.transactions > 0),
    [data],
  );

  /** One stacked row: revenue share by station, ≤6 slots by construction. */
  const stationRow = useMemo(() => {
    if (!data?.stations?.length) return null;
    const row: Record<string, number> = { name: 0 } as any;
    data.stations.slice(0, 6).forEach(s => {
      row[s.name] = s.revenue;
    });
    return row;
  }, [data]);

  const stationNames = useMemo(() => (data?.stations || []).slice(0, 6).map(s => s.name), [data]);

  const customerMix = useMemo(() => {
    if (!data) return null;
    const total = data.customers.new + data.customers.returning;
    if (total === 0) return null;
    return { New: data.customers.new, Returning: data.customers.returning, total };
  }, [data]);

  const exportCsv = () => {
    if (!data) return;
    const lines: string[] = [];
    const push = (...cells: (string | number)[]) =>
      lines.push(cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));

    push('Immersia analytics', `${formatDate(data.range.start)} – ${formatDate(data.range.end)}`);
    push('');
    push('Metric', 'Current', 'Previous', 'Change %');
    const k = data.kpis;
    ([
      ['Revenue', k.revenue],
      ['Transactions', k.transactions],
      ['Average ticket', k.avgTicket],
      ['Unique customers', k.uniqueCustomers],
      ['Games played', k.gamesPlayed],
      ['Discounts given', k.discounts],
    ] as [string, Metric][]).forEach(([label, m]) =>
      push(label, Math.round(m.current), Math.round(m.previous), m.changePct === null ? 'n/a' : m.changePct.toFixed(1)),
    );

    push('');
    push('Bucket', 'Revenue', 'Transactions');
    data.timeseries.forEach(p => push(p.bucket, Math.round(p.revenue), p.transactions));

    push('');
    push('Station', 'Revenue', 'Transactions', 'Share %');
    data.stations.forEach(s => push(s.name, Math.round(s.revenue), s.transactions, (s.share * 100).toFixed(1)));

    push('');
    push('Game', 'Quantity', 'Revenue');
    data.topGames.forEach(g => push(g.name, g.quantity, Math.round(g.revenue)));

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${data.range.start.slice(0, 10)}_to_${data.range.end.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="analytics">
      {/* One filter row above everything it scopes */}
      <div className="analytics-filters">
        <div className="analytics-period" role="group" aria-label="Reporting period">
          {PERIODS.map(p => (
            <button
              key={p.key}
              type="button"
              className={`analytics-pill${period === p.key ? ' active' : ''}`}
              onClick={() => setPeriod(p.key)}
              aria-pressed={period === p.key}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <span className="analytics-custom">
            <label htmlFor="analytics-start">From</label>
            <input
              id="analytics-start"
              type="date"
              value={customStart}
              max={customEnd}
              onChange={e => setCustomStart(e.target.value)}
            />
            <label htmlFor="analytics-end">to</label>
            <input
              id="analytics-end"
              type="date"
              value={customEnd}
              min={customStart}
              onChange={e => setCustomEnd(e.target.value)}
            />
          </span>
        )}

        <div className="analytics-actions">
          <button type="button" className="analytics-btn" onClick={fetchAnalytics} disabled={loading}>
            ↻ Refresh
          </button>
          <button type="button" className="analytics-btn" onClick={exportCsv} disabled={!data}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {error ? <div className="analytics-error">{error}</div> : null}

      {!data ? (
        <p className="analytics-empty">{loading ? 'Loading analytics…' : 'No analytics available.'}</p>
      ) : (
        /* Hold the previous render while refetching — no skeleton flash */
        <div className={`analytics-body${loading ? ' is-refetching' : ''}`}>
          {/* ── Hero: the one number this view leads with ─────────────────── */}
          <div className="analytics-hero">
            <p className="analytics-hero-label">Revenue</p>
            <p className="analytics-hero-value">{naira(data.kpis.revenue.current)}</p>
            <div className="analytics-hero-meta">
              <Delta metric={data.kpis.revenue} />
              <span>{PERIOD_COMPARISON[period]}</span>
              <span>·</span>
              <span>
                {formatDate(data.range.start)} – {formatDate(data.range.end)}
              </span>
            </div>
          </div>

          <div className="analytics-kpis">
            <Tile label="Transactions" value={count(data.kpis.transactions.current)} metric={data.kpis.transactions} />
            <Tile label="Average ticket" value={naira(data.kpis.avgTicket.current)} metric={data.kpis.avgTicket} />
            <Tile
              label="Unique customers"
              value={count(data.kpis.uniqueCustomers.current)}
              metric={data.kpis.uniqueCustomers}
            />
            <Tile label="Games played" value={count(data.kpis.gamesPlayed.current)} metric={data.kpis.gamesPlayed} />
            <Tile
              label="Discounts given"
              value={naira(data.kpis.discounts.current)}
              metric={data.kpis.discounts}
              upIsGood={false}
            />
          </div>

          {/* ── Trend ────────────────────────────────────────────────────── */}
          <div className="analytics-grid">
            <ChartCard
              full
              title={trendMetric === 'revenue' ? 'Revenue over time' : 'Transactions over time'}
              subtitle={
                data.granularity === 'hour'
                  ? 'By hour of the day (Lagos time)'
                  : data.granularity === 'day'
                    ? 'By day'
                    : 'By month'
              }
              tools={
                /* A metric switch, not a second y-axis — two scales on one plot
                   would invent a correlation that isn't in the data. */
                <>
                  <button
                    type="button"
                    className={`analytics-toggle${trendMetric === 'revenue' ? ' active' : ''}`}
                    onClick={() => setTrendMetric('revenue')}
                    aria-pressed={trendMetric === 'revenue'}
                  >
                    Revenue
                  </button>
                  <button
                    type="button"
                    className={`analytics-toggle${trendMetric === 'transactions' ? ' active' : ''}`}
                    onClick={() => setTrendMetric('transactions')}
                    aria-pressed={trendMetric === 'transactions'}
                  >
                    Transactions
                  </button>
                </>
              }
              chart={
                data.timeseries.length === 0 ? (
                  <p className="analytics-empty">No transactions in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={data.timeseries} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                      <defs>
                        <linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={trendColor} stopOpacity={0.16} />
                          <stop offset="100%" stopColor={trendColor} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: INK_MUTED, fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: AXIS }}
                        minTickGap={24}
                      />
                      <YAxis
                        tick={{ fill: INK_MUTED, fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={64}
                        tickFormatter={v => (trendMetric === 'revenue' ? compactNaira(v) : count(v))}
                      />
                      <Tooltip
                        cursor={{ stroke: AXIS, strokeWidth: 1 }}
                        content={({ active, payload }: any) =>
                          active && payload?.length ? (
                            <ChartTooltip
                              title={payload[0].payload.bucket}
                              rows={[
                                { label: 'Revenue', value: naira(payload[0].payload.revenue), color: trendColor },
                                { label: 'Transactions', value: count(payload[0].payload.transactions) },
                              ]}
                            />
                          ) : null
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey={trendKey}
                        stroke={trendColor}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="url(#analyticsTrendFill)"
                        activeDot={{ r: 4, fill: trendColor, stroke: SURFACE, strokeWidth: 2 }}
                        /* Monotone smoothing puts the visual apex between
                           points, so on a short series show the real readings.
                           Each dot carries a 2px surface ring. */
                        dot={
                          data.timeseries.length <= 14
                            ? { r: 4, fill: trendColor, stroke: SURFACE, strokeWidth: 2 }
                            : false
                        }
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )
              }
              table={
                <DataTable
                  columns={[
                    { key: 'bucket', label: 'Period' },
                    { key: 'revenue', label: 'Revenue', numeric: true },
                    { key: 'transactions', label: 'Transactions', numeric: true },
                  ]}
                  rows={data.timeseries.map(p => ({
                    bucket: p.bucket,
                    revenue: naira(p.revenue),
                    transactions: count(p.transactions),
                  }))}
                />
              }
            />
          </div>

          {/* ── Trading hours & weekday mix ──────────────────────────────── */}
          <div className="analytics-grid">
            <ChartCard
              title="Busiest hours"
              subtitle={
                peakHour >= 0 && data.hourly[peakHour]?.revenue > 0
                  ? `Peak trading at ${data.hourly[peakHour].label} — ${naira(data.hourly[peakHour].revenue)}`
                  : 'Revenue by hour of day'
              }
              chart={
                activeHours.length === 0 ? (
                  <p className="analytics-empty">No transactions in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={activeHours} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                      <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: INK_MUTED, fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: AXIS }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fill: INK_MUTED, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={58}
                        tickFormatter={compactNaira}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(11,11,11,0.04)' }}
                        content={({ active, payload }: any) =>
                          active && payload?.length ? (
                            <ChartTooltip
                              title={payload[0].payload.label}
                              rows={[
                                { label: 'Revenue', value: naira(payload[0].payload.revenue) },
                                { label: 'Transactions', value: count(payload[0].payload.transactions) },
                              ]}
                            />
                          ) : null
                        }
                      />
                      {/* Emphasis: the peak carries the accent, the rest recede */}
                      <Bar dataKey="revenue" maxBarSize={24} radius={[4, 4, 0, 0]}>
                        {activeHours.map(h => (
                          <Cell key={h.hour} fill={h.hour === peakHour ? BAR_PEAK : BAR_BASE} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
              table={
                <DataTable
                  columns={[
                    { key: 'hour', label: 'Hour' },
                    { key: 'revenue', label: 'Revenue', numeric: true },
                    { key: 'transactions', label: 'Transactions', numeric: true },
                  ]}
                  rows={activeHours.map(h => ({
                    hour: h.label,
                    revenue: naira(h.revenue),
                    transactions: count(h.transactions),
                  }))}
                />
              }
            />

            <ChartCard
              title="Busiest days"
              subtitle={
                peakWeekday >= 0 && data.weekday[peakWeekday]?.revenue > 0
                  ? `Best day is ${data.weekday[peakWeekday].label} — ${naira(data.weekday[peakWeekday].revenue)}`
                  : 'Revenue by day of week'
              }
              chart={
                data.kpis.transactions.current === 0 ? (
                  <p className="analytics-empty">No transactions in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={data.weekday} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                      <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: INK_MUTED, fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: AXIS }}
                      />
                      <YAxis
                        tick={{ fill: INK_MUTED, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={58}
                        tickFormatter={compactNaira}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(11,11,11,0.04)' }}
                        content={({ active, payload }: any) =>
                          active && payload?.length ? (
                            <ChartTooltip
                              title={payload[0].payload.label}
                              rows={[
                                { label: 'Revenue', value: naira(payload[0].payload.revenue) },
                                { label: 'Transactions', value: count(payload[0].payload.transactions) },
                              ]}
                            />
                          ) : null
                        }
                      />
                      <Bar dataKey="revenue" maxBarSize={24} radius={[4, 4, 0, 0]}>
                        {data.weekday.map(d => (
                          <Cell key={d.weekday} fill={d.weekday === peakWeekday ? BAR_PEAK : BAR_BASE} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
              table={
                <DataTable
                  columns={[
                    { key: 'day', label: 'Day' },
                    { key: 'revenue', label: 'Revenue', numeric: true },
                    { key: 'transactions', label: 'Transactions', numeric: true },
                  ]}
                  rows={data.weekday.map(d => ({
                    day: d.label,
                    revenue: naira(d.revenue),
                    transactions: count(d.transactions),
                  }))}
                />
              }
            />
          </div>

          {/* ── Station mix ──────────────────────────────────────────────── */}
          <div className="analytics-grid">
            <ChartCard
              full
              title="Revenue by station"
              subtitle="Share of total takings by payment station"
              chart={
                !stationRow ? (
                  <p className="analytics-empty">No transactions in this period.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={92}>
                      <BarChart
                        layout="vertical"
                        data={[stationRow]}
                        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        stackOffset="expand"
                      >
                        <XAxis type="number" hide domain={[0, 1]} />
                        <YAxis type="category" dataKey="name" hide />
                        <Tooltip
                          cursor={false}
                          content={({ active, payload }: any) =>
                            active && payload?.length ? (
                              <ChartTooltip
                                title="Revenue by station"
                                rows={(data.stations || []).slice(0, 6).map((s, i) => ({
                                  label: s.name,
                                  value: `${naira(s.revenue)} · ${percent(s.share)}`,
                                  color: SERIES[i % SERIES.length],
                                }))}
                              />
                            ) : null
                          }
                        />
                        {stationNames.map((name, i) => (
                          <Bar
                            key={name}
                            dataKey={name}
                            stackId="stations"
                            fill={SERIES[i % SERIES.length]}
                            /* 2px surface gap between segments — the separator is
                               white space, never a border drawn on the mark. */
                            stroke={SURFACE}
                            strokeWidth={2}
                            maxBarSize={28}
                            radius={i === 0 || i === stationNames.length - 1 ? 4 : 0}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="analytics-legend">
                      {(data.stations || []).slice(0, 6).map((s, i) => (
                        <span className="analytics-legend-item" key={s.name}>
                          <span
                            className="analytics-swatch"
                            style={{ background: SERIES[i % SERIES.length] }}
                            aria-hidden="true"
                          />
                          {s.name} — {naira(s.revenue)} ({percent(s.share)})
                        </span>
                      ))}
                    </div>
                  </>
                )
              }
              table={
                <DataTable
                  columns={[
                    { key: 'station', label: 'Station' },
                    { key: 'revenue', label: 'Revenue', numeric: true },
                    { key: 'transactions', label: 'Transactions', numeric: true },
                    { key: 'share', label: 'Share', numeric: true },
                  ]}
                  rows={(data.stations || []).map(s => ({
                    station: s.name,
                    revenue: naira(s.revenue),
                    transactions: count(s.transactions),
                    share: percent(s.share),
                  }))}
                />
              }
            />
          </div>

          {/* ── Games & customer mix ─────────────────────────────────────── */}
          <div className="analytics-grid">
            <ChartCard
              title="Top games by revenue"
              subtitle="Highest-earning titles in this period"
              chart={
                data.topGames.length === 0 ? (
                  <p className="analytics-empty">No games sold in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, data.topGames.length * 34)}>
                    <BarChart
                      layout="vertical"
                      data={data.topGames}
                      margin={{ top: 4, right: 20, bottom: 4, left: 4 }}
                    >
                      <CartesianGrid stroke={GRID} strokeWidth={1} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: INK_MUTED, fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: AXIS }}
                        tickFormatter={compactNaira}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: INK_MUTED, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={118}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(11,11,11,0.04)' }}
                        content={({ active, payload }: any) =>
                          active && payload?.length ? (
                            <ChartTooltip
                              title={payload[0].payload.name}
                              rows={[
                                { label: 'Revenue', value: naira(payload[0].payload.revenue) },
                                { label: 'Plays', value: count(payload[0].payload.quantity) },
                              ]}
                            />
                          ) : null
                        }
                      />
                      {/* One series, one colour — bar length already carries magnitude */}
                      <Bar dataKey="revenue" fill={SERIES[0]} maxBarSize={20} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
              table={
                <DataTable
                  columns={[
                    { key: 'game', label: 'Game' },
                    { key: 'quantity', label: 'Plays', numeric: true },
                    { key: 'revenue', label: 'Revenue', numeric: true },
                  ]}
                  rows={data.topGames.map(g => ({
                    game: g.name,
                    quantity: count(g.quantity),
                    revenue: naira(g.revenue),
                  }))}
                />
              }
            />

            <ChartCard
              title="Customer mix"
              subtitle="First-time visitors versus returning customers"
              chart={
                !customerMix ? (
                  <p className="analytics-empty">No customers in this period.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={92}>
                      <BarChart
                        layout="vertical"
                        data={[customerMix]}
                        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        stackOffset="expand"
                      >
                        <XAxis type="number" hide domain={[0, 1]} />
                        <YAxis type="category" dataKey="total" hide />
                        <Tooltip
                          cursor={false}
                          content={({ active }: any) =>
                            active ? (
                              <ChartTooltip
                                title="Customer mix"
                                rows={[
                                  { label: 'New', value: count(customerMix.New), color: SERIES[0] },
                                  { label: 'Returning', value: count(customerMix.Returning), color: SERIES[1] },
                                ]}
                              />
                            ) : null
                          }
                        />
                        <Bar
                          dataKey="New"
                          stackId="mix"
                          fill={SERIES[0]}
                          stroke={SURFACE}
                          strokeWidth={2}
                          maxBarSize={28}
                          radius={4}
                        />
                        <Bar
                          dataKey="Returning"
                          stackId="mix"
                          fill={SERIES[1]}
                          stroke={SURFACE}
                          strokeWidth={2}
                          maxBarSize={28}
                          radius={4}
                        />
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="analytics-legend">
                      <span className="analytics-legend-item">
                        <span className="analytics-swatch" style={{ background: SERIES[0] }} aria-hidden="true" />
                        New — {count(customerMix.New)} ({percent(customerMix.New / customerMix.total)})
                      </span>
                      <span className="analytics-legend-item">
                        <span className="analytics-swatch" style={{ background: SERIES[1] }} aria-hidden="true" />
                        Returning — {count(customerMix.Returning)} (
                        {percent(customerMix.Returning / customerMix.total)})
                      </span>
                    </div>

                    <div className="analytics-legend">
                      <span className="analytics-legend-item">
                        Avg games per transaction: {data.basket.avgItemsPerTransaction.toFixed(1)}
                      </span>
                      <span className="analytics-legend-item">
                        Drink attach rate: {percent(data.basket.drinkAttachRate)}
                      </span>
                    </div>
                  </>
                )
              }
              table={
                <DataTable
                  columns={[
                    { key: 'metric', label: 'Metric' },
                    { key: 'value', label: 'Value', numeric: true },
                  ]}
                  rows={[
                    { metric: 'New customers', value: count(data.customers.new) },
                    { metric: 'Returning customers', value: count(data.customers.returning) },
                    { metric: 'Avg games per transaction', value: data.basket.avgItemsPerTransaction.toFixed(1) },
                    { metric: 'Drink attach rate', value: percent(data.basket.drinkAttachRate) },
                  ]}
                />
              }
            />
          </div>

          {/* ── Tables — more than ~7 classes belong in a table, not a chart ─ */}
          <div className="analytics-grid">
            <section className="analytics-card">
              <div className="analytics-card-head">
                <h3>Highest-spending customers</h3>
              </div>
              <p className="analytics-card-sub">Ranked by spend in this period</p>
              <DataTable
                columns={[
                  { key: 'customer', label: 'Customer' },
                  { key: 'visits', label: 'Visits', numeric: true },
                  { key: 'revenue', label: 'Spend', numeric: true },
                ]}
                rows={data.customers.topSpenders.map(c => ({
                  customer: c.username || c.phone || 'Guest',
                  visits: count(c.visits),
                  revenue: naira(c.revenue),
                }))}
              />
            </section>

            <section className="analytics-card">
              <div className="analytics-card-head">
                <h3>Drinks sold</h3>
              </div>
              <p className="analytics-card-sub">Revenue from the bar in this period</p>
              <DataTable
                columns={[
                  { key: 'drink', label: 'Drink' },
                  { key: 'quantity', label: 'Sold', numeric: true },
                  { key: 'revenue', label: 'Revenue', numeric: true },
                ]}
                rows={data.drinks.map(d => ({
                  drink: d.name,
                  quantity: count(d.quantity),
                  revenue: naira(d.revenue),
                }))}
                empty="No drinks sold in this period."
              />
            </section>

            <section className="analytics-card">
              <div className="analytics-card-head">
                <h3>Least-played games</h3>
              </div>
              <p className="analytics-card-sub">Candidates for repricing or rotation</p>
              <DataTable
                columns={[
                  { key: 'game', label: 'Game' },
                  { key: 'quantity', label: 'Plays', numeric: true },
                  { key: 'revenue', label: 'Revenue', numeric: true },
                ]}
                rows={data.bottomGames.map(g => ({
                  game: g.name,
                  quantity: count(g.quantity),
                  revenue: naira(g.revenue),
                }))}
              />
            </section>

            <section className="analytics-card">
              <div className="analytics-card-head">
                <h3>Payment methods</h3>
              </div>
              <p className="analytics-card-sub">Every method recorded against a transaction</p>
              <DataTable
                columns={[
                  { key: 'method', label: 'Method' },
                  { key: 'transactions', label: 'Transactions', numeric: true },
                  { key: 'revenue', label: 'Revenue', numeric: true },
                  { key: 'share', label: 'Share', numeric: true },
                ]}
                rows={data.paymentMethods.map(m => ({
                  method: m.name,
                  transactions: count(m.transactions),
                  revenue: naira(m.revenue),
                  share: percent(m.share),
                }))}
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnalytics;
