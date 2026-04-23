import React, { useEffect, useState } from 'react';
import axios from 'axios';

type Station = 'Funstation' | 'Immersia' | 'GKG';
const STATIONS: Station[] = ['Funstation', 'Immersia', 'GKG'];
const BACKEND = process.env.REACT_APP_BACKEND_URL;
const fmt = (n: number) => `₦${Number(n || 0).toLocaleString('en-NG')}`;

type ComparisonRow = {
  game_title: string;
  recorded_quantity: number;
  recorded_amount: number;
  actual_quantity: number;
  actual_amount: number;
  variance_quantity: number;
  variance_amount: number;
  status: 'green' | 'red' | 'blue';
};

type DiscountRecord = {
  transaction_id: string;
  reference: string | null;
  merchant_reference: string | null;
  username: string;
  amount: number;
  description: string | null;
  given_by: string | null;
  given_by_role: string | null;
  created_at: string;
};

type ComparisonResult = {
  report: { id: string; created_by: string; staff_on_duty: string[]; locked_at: string; notes: string | null } | null;
  report_date: string;
  station: Station;
  rows: ComparisonRow[];
  totals: {
    recorded_quantity: number;
    recorded_amount: number;
    actual_quantity: number;
    actual_amount: number;
    variance_quantity: number;
    variance_amount: number;
    overall_status: 'green' | 'red' | 'blue';
  };
  discounts: DiscountRecord[];
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const statusMeta: Record<'green' | 'red' | 'blue', { bg: string; color: string; label: string }> = {
  green: { bg: '#ecfdf5', color: '#047857', label: 'MATCH' },
  red: { bg: '#fef2f2', color: '#b91c1c', label: 'UNDER' },
  blue: { bg: '#eff6ff', color: '#1d4ed8', label: 'EXCESS' },
};

const Badge: React.FC<{ status: 'green' | 'red' | 'blue' }> = ({ status }) => {
  const s = statusMeta[status];
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
};

const StationBlock: React.FC<{ r: ComparisonResult }> = ({ r }) => (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 18, overflow: 'hidden' }}>
    <div style={{ background: '#111827', color: '#fff', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{r.station} — {r.report_date}</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
          {r.report
            ? `Filed by ${r.report.created_by} · Staff: ${(r.report.staff_on_duty || []).join(', ') || '—'}`
            : 'No report filed for this station on this date'}
        </div>
      </div>
      <Badge status={r.totals.overall_status} />
    </div>

    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#f9fafb' }}>
          <th style={{ textAlign: 'left', padding: 10, fontSize: 12, color: '#374151' }}>Game</th>
          <th style={{ textAlign: 'right', padding: 10, fontSize: 12, color: '#374151' }}>Rec. Qty</th>
          <th style={{ textAlign: 'right', padding: 10, fontSize: 12, color: '#374151' }}>Rec. ₦</th>
          <th style={{ textAlign: 'right', padding: 10, fontSize: 12, color: '#374151' }}>Actual Qty</th>
          <th style={{ textAlign: 'right', padding: 10, fontSize: 12, color: '#374151' }}>Actual ₦</th>
          <th style={{ textAlign: 'right', padding: 10, fontSize: 12, color: '#374151' }}>Δ ₦</th>
          <th style={{ textAlign: 'center', padding: 10, fontSize: 12, color: '#374151' }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {r.rows.length === 0 && (
          <tr>
            <td colSpan={7} style={{ padding: 18, textAlign: 'center', color: '#9ca3af' }}>
              No activity and no recorded entries for this station on this date.
            </td>
          </tr>
        )}
        {r.rows.map((row, idx) => {
          const meta = statusMeta[row.status];
          return (
            <tr key={row.game_title} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', borderLeft: `4px solid ${meta.color}` }}>
              <td style={{ padding: 10, fontSize: 13 }}>{row.game_title}</td>
              <td style={{ padding: 10, fontSize: 13, textAlign: 'right' }}>{row.recorded_quantity}</td>
              <td style={{ padding: 10, fontSize: 13, textAlign: 'right' }}>{fmt(row.recorded_amount)}</td>
              <td style={{ padding: 10, fontSize: 13, textAlign: 'right' }}>{row.actual_quantity}</td>
              <td style={{ padding: 10, fontSize: 13, textAlign: 'right' }}>{fmt(row.actual_amount)}</td>
              <td style={{ padding: 10, fontSize: 13, textAlign: 'right', color: row.variance_amount === 0 ? '#6b7280' : row.variance_amount < 0 ? '#b91c1c' : '#1d4ed8' }}>
                {fmt(row.variance_amount)}
              </td>
              <td style={{ padding: 10, fontSize: 13, textAlign: 'center' }}><Badge status={row.status} /></td>
            </tr>
          );
        })}
        {r.rows.length > 0 && (
          <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
            <td style={{ padding: 10, fontSize: 13 }}>TOTAL</td>
            <td style={{ padding: 10, fontSize: 13, textAlign: 'right' }}>{r.totals.recorded_quantity}</td>
            <td style={{ padding: 10, fontSize: 13, textAlign: 'right' }}>{fmt(r.totals.recorded_amount)}</td>
            <td style={{ padding: 10, fontSize: 13, textAlign: 'right' }}>{r.totals.actual_quantity}</td>
            <td style={{ padding: 10, fontSize: 13, textAlign: 'right' }}>{fmt(r.totals.actual_amount)}</td>
            <td style={{ padding: 10, fontSize: 13, textAlign: 'right' }}>{fmt(r.totals.variance_amount)}</td>
            <td style={{ padding: 10, textAlign: 'center' }}><Badge status={r.totals.overall_status} /></td>
          </tr>
        )}
      </tbody>
    </table>

    {r.discounts.length > 0 && (
      <div style={{ padding: '12px 18px', background: '#fff7ed', borderTop: '1px solid #f59e0b' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#9a3412', marginBottom: 6 }}>Discounts applied ({r.discounts.length})</div>
        {r.discounts.map((d) => (
          <div key={d.transaction_id} style={{ fontSize: 12, color: '#7c2d12', margin: '4px 0' }}>
            {fmt(d.amount)} — {d.description || 'no reason'} · by <strong>{d.given_by || 'unknown'}</strong>
            {d.given_by_role ? ` (${d.given_by_role})` : ''} · customer {d.username}
          </div>
        ))}
      </div>
    )}
  </div>
);

const InternalControlDashboard: React.FC = () => {
  const [date, setDate] = useState<string>(todayIso());
  const [station, setStation] = useState<Station | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const getAuthHeader = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('operatorToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchCompare = async () => {
    setLoading(true);
    setErr(null);
    try {
      const params: any = { date };
      if (station !== 'ALL') params.station = station;
      const res = await axios.get(`${BACKEND}/v1/admin/internal-control/comparison`, {
        params,
        headers: getAuthHeader(),
        timeout: 60000,
      });
      setResults(res.data?.data || []);
    } catch (e: any) {
      console.error(e);
      setErr(e?.response?.data?.error || e?.message || 'Failed to load comparison');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCompare(); /* eslint-disable-next-line */ }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h2 style={{ marginBottom: 4 }}>Internal Control — Level 2 Comparison</h2>
      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Camera-recorded counts vs actual sales. <strong style={{ color: '#047857' }}>MATCH</strong> = tallied,{' '}
        <strong style={{ color: '#b91c1c' }}>UNDER</strong> = recorded &lt; actual,{' '}
        <strong style={{ color: '#1d4ed8' }}>EXCESS</strong> = recorded &gt; actual.
      </p>

      <div style={{ display: 'flex', alignItems: 'end', gap: 12, marginTop: 14, marginBottom: 20, background: '#fff', padding: 14, border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <label>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Date</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Station</div>
          <select value={station} onChange={(e) => setStation(e.target.value as any)}
            style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
            <option value="ALL">All stations</option>
            {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button onClick={fetchCompare} disabled={loading}
          style={{ padding: '9px 16px', border: '1px solid #1d4ed8', background: '#2563eb', color: '#fff', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {err && (
        <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: 14 }}>{err}</div>
      )}

      {results.map((r) => <StationBlock key={`${r.station}-${r.report_date}`} r={r} />)}

      {!loading && results.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', background: '#fff', border: '1px dashed #e5e7eb', borderRadius: 8 }}>
          No data. Pick a date above and click Refresh.
        </div>
      )}
    </div>
  );
};

export default InternalControlDashboard;
