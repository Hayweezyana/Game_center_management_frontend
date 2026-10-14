import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import './InternalControl.css';

type Station = 'Funstation' | 'Immersia' | 'GKG';
const STATIONS: Station[] = ['Funstation', 'Immersia', 'GKG'];
const BACKEND = process.env.REACT_APP_BACKEND_URL;
const fmt = (n: number) => `₦${Number(n || 0).toLocaleString('en-NG')}`;

const getAuthHeader = () => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('operatorToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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

type PaymentBreakdown = {
  cash: number;
  moniepoint: number;
  paystack: number;
  other: number;
  total: number;
};

type OnlineSummary = {
  report_date: string;
  transaction_count: number;
  payments: PaymentBreakdown;
  rows: { game_title: string; quantity: number; amount: number }[];
};

type ComparisonResult = {
  report: { id: string; created_by: string; staff_on_duty: string[]; locked_at: string; notes: string | null } | null;
  report_date: string;
  station: Station;
  rows: ComparisonRow[];
  payments?: PaymentBreakdown;
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

const statusBadge = (status: 'green' | 'red' | 'blue') => {
  const cls = `ic-badge ic-badge-${status}`;
  const label = status === 'green' ? 'MATCH' : status === 'red' ? 'UNDER' : 'EXCESS';
  return <span className={cls}>{label}</span>;
};

const PaymentStrip: React.FC<{ p?: PaymentBreakdown }> = ({ p }) => {
  const b = p || { cash: 0, moniepoint: 0, paystack: 0, other: 0, total: 0 };
  const cells: [string, number][] = [
    ['Cash', b.cash],
    ['Moniepoint', b.moniepoint],
    ['Paystack', b.paystack],
    ...(b.other > 0 ? [['Other', b.other] as [string, number]] : []),
    ['Total paid', b.total],
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
      {cells.map(([label, value]) => (
        <div key={label} style={{ flex: '1 1 110px', background: '#f9fafb', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
          <div style={{ fontWeight: 700 }}>{fmt(value)}</div>
        </div>
      ))}
    </div>
  );
};

const OnlineBlock: React.FC<{ o: OnlineSummary }> = ({ o }) => (
  <div className="ic-card" style={{ padding: 0, overflow: 'hidden' }}>
    <div className="ic-station-header">
      <div>
        <div className="ic-station-title">Online (Paystack) — {o.report_date}</div>
        <div className="ic-station-meta">
          {o.transaction_count} online transaction{o.transaction_count === 1 ? '' : 's'} · not tied to a station
        </div>
      </div>
    </div>
    {o.rows.length > 0 && (
      <div className="ic-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table className="ic-table ic-compare-table">
          <thead>
            <tr>
              <th>Game</th>
              <th className="num">Qty</th>
              <th className="num">₦</th>
            </tr>
          </thead>
          <tbody>
            {o.rows.map((row) => (
              <tr key={row.game_title}>
                <td data-label="Game">{row.game_title}</td>
                <td data-label="Qty" className="num">{row.quantity}</td>
                <td data-label="₦" className="num">{fmt(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    <PaymentStrip p={o.payments} />
  </div>
);

const StationBlock: React.FC<{ r: ComparisonResult }> = ({ r }) => (
  <div className="ic-card" style={{ padding: 0, overflow: 'hidden' }}>
    <div className="ic-station-header">
      <div>
        <div className="ic-station-title">{r.station} — {r.report_date}</div>
        <div className="ic-station-meta">
          {r.report
            ? `Filed by ${r.report.created_by} · Staff: ${(r.report.staff_on_duty || []).join(', ') || '—'}`
            : 'No report filed for this station on this date'}
        </div>
      </div>
      {statusBadge(r.totals.overall_status)}
    </div>

    <div className="ic-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
      <table className="ic-table ic-compare-table">
        <thead>
          <tr>
            <th>Game</th>
            <th className="num">Rec. Qty</th>
            <th className="num">Rec. ₦</th>
            <th className="num">Actual Qty</th>
            <th className="num">Actual ₦</th>
            <th className="num">Δ ₦</th>
            <th className="ctr">Status</th>
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
          {r.rows.map((row) => (
            <tr key={row.game_title} className={`ic-row-${row.status}`}>
              <td data-label="Game">{row.game_title}</td>
              <td data-label="Rec. Qty" className="num">{row.recorded_quantity}</td>
              <td data-label="Rec. ₦" className="num">{fmt(row.recorded_amount)}</td>
              <td data-label="Actual Qty" className="num">{row.actual_quantity}</td>
              <td data-label="Actual ₦" className="num">{fmt(row.actual_amount)}</td>
              <td
                data-label="Δ ₦"
                className="num"
                style={{ color: row.variance_amount === 0 ? '#6b7280' : row.variance_amount < 0 ? '#b91c1c' : '#1d4ed8' }}
              >
                {fmt(row.variance_amount)}
              </td>
              <td data-label="Status" className="ctr">{statusBadge(row.status)}</td>
            </tr>
          ))}
          {r.rows.length > 0 && (
            <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
              <td data-label="Game">TOTAL</td>
              <td data-label="Rec. Qty" className="num">{r.totals.recorded_quantity}</td>
              <td data-label="Rec. ₦" className="num">{fmt(r.totals.recorded_amount)}</td>
              <td data-label="Actual Qty" className="num">{r.totals.actual_quantity}</td>
              <td data-label="Actual ₦" className="num">{fmt(r.totals.actual_amount)}</td>
              <td data-label="Δ ₦" className="num">{fmt(r.totals.variance_amount)}</td>
              <td data-label="Status" className="ctr">{statusBadge(r.totals.overall_status)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    <PaymentStrip p={r.payments} />

    {r.discounts.length > 0 && (
      <div className="ic-discount-block">
        <div className="ic-discount-title">Discounts applied ({r.discounts.length})</div>
        {r.discounts.map((d) => (
          <div key={d.transaction_id} className="ic-discount-row">
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
  const [online, setOnline] = useState<OnlineSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fetchCompare = useCallback(async () => {
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
      setOnline(res.data?.online || null);
    } catch (e: any) {
      console.error(e);
      setErr(e?.response?.data?.error || e?.message || 'Failed to load comparison');
      setResults([]);
      setOnline(null);
    } finally {
      setLoading(false);
    }
  }, [date, station]);

  useEffect(() => { fetchCompare(); }, [fetchCompare]);

  return (
    <div className="ic-shell">
      <h2>Internal Control — Level 2 Comparison</h2>
      <p className="ic-sub">
        Camera-recorded counts vs actual sales.{' '}
        <strong style={{ color: '#047857' }}>MATCH</strong> = tallied,{' '}
        <strong style={{ color: '#b91c1c' }}>UNDER</strong> = recorded &lt; actual,{' '}
        <strong style={{ color: '#1d4ed8' }}>EXCESS</strong> = recorded &gt; actual.
      </p>

      <div className="ic-card">
        <div className="ic-grid-3">
          <div className="ic-field">
            <label className="ic-field-label">Date</label>
            <input className="ic-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="ic-field">
            <label className="ic-field-label">Station</label>
            <select className="ic-select" value={station} onChange={(e) => setStation(e.target.value as any)}>
              <option value="ALL">All stations</option>
              {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="ic-field" style={{ display: 'flex', alignItems: 'end' }}>
            <button className="ic-btn ic-btn-primary" onClick={fetchCompare} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {err && <div className="ic-banner ic-banner-error">{err}</div>}

      {results.map((r) => <StationBlock key={`${r.station}-${r.report_date}`} r={r} />)}

      {station === 'ALL' && online && online.transaction_count > 0 && <OnlineBlock o={online} />}

      {!loading && results.length === 0 && (
        <div className="ic-empty">No data. Pick a date above and tap Refresh.</div>
      )}
    </div>
  );
};

export default InternalControlDashboard;
