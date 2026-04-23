import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './InternalControl.css';

type Game = { id: string; title: string; price: number };
type Station = 'Funstation' | 'Immersia' | 'GKG';

type ReportItem = {
  id?: string;
  game_id?: string | null;
  game_title: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

type SavedReport = {
  id: string;
  report_date: string;
  station: Station;
  staff_on_duty: string[];
  notes: string | null;
  locked_at: string;
  created_at: string;
  items: ReportItem[];
};

const STATIONS: Station[] = ['Funstation', 'Immersia', 'GKG'];
const BACKEND = process.env.REACT_APP_BACKEND_URL;
const fmt = (n: number) => `₦${Number(n || 0).toLocaleString('en-NG')}`;
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isoMinusMs = (iso: string) => new Date(iso).getTime();

const InternalControlEntry: React.FC = () => {
  const [date, setDate] = useState<string>(todayIso());
  const [station, setStation] = useState<Station>('Funstation');
  const [staffInput, setStaffInput] = useState('');
  const [staffList, setStaffList] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recent, setRecent] = useState<SavedReport[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const getAuthHeader = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('operatorToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${BACKEND}/v1/admin/games`, { headers: getAuthHeader() });
        const raw = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setGames(raw.map((g: any) => ({ id: g.id, title: g.title, price: Number(g.price) || 0 })));
      } catch (err: any) {
        console.error('Failed to load games', err);
      }
    })();
  }, []);

  const fetchRecent = async () => {
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/internal-control/reports`, {
        params: { station, from: date, to: date },
        headers: getAuthHeader(),
      });
      const list: SavedReport[] = res.data?.data || [];
      setRecent(list);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => { fetchRecent(); /* eslint-disable-next-line */ }, [date, station]);

  const totalAmount = useMemo(() => items.reduce((s, it) => s + it.amount, 0), [items]);

  const addStaff = () => {
    const v = staffInput.trim();
    if (!v) return;
    if (staffList.includes(v)) { setStaffInput(''); return; }
    setStaffList([...staffList, v]);
    setStaffInput('');
  };

  const removeStaff = (name: string) => setStaffList(staffList.filter((s) => s !== name));

  const addItemRow = () =>
    setItems([...items, { game_id: null, game_title: '', quantity: 0, unit_price: 0, amount: 0 }]);

  const removeItemRow = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const updateItem = (idx: number, patch: Partial<ReportItem>) => {
    setItems((curr) =>
      curr.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        if (patch.game_id !== undefined) {
          const g = games.find((g) => g.id === patch.game_id);
          if (g) {
            next.game_title = g.title;
            next.unit_price = g.price;
          }
        }
        next.amount = (Number(next.unit_price) || 0) * (Number(next.quantity) || 0);
        return next;
      })
    );
  };

  const resetForm = () => {
    setStaffList([]);
    setStaffInput('');
    setNotes('');
    setItems([]);
    setEditingId(null);
  };

  const loadForEdit = (r: SavedReport) => {
    setEditingId(r.id);
    setDate(r.report_date);
    setStation(r.station);
    setStaffList(r.staff_on_duty || []);
    setNotes(r.notes || '');
    setItems(
      (r.items || []).map((it) => ({
        id: it.id,
        game_id: it.game_id ?? null,
        game_title: it.game_title,
        quantity: it.quantity,
        unit_price: it.unit_price,
        amount: it.amount,
      }))
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validate = (): string | null => {
    if (!date) return 'Please pick a date';
    if (staffList.length === 0) return 'Add at least one staff name on duty';
    if (items.length === 0) return 'Add at least one game row';
    for (const it of items) {
      if (!it.game_title.trim()) return 'Every row needs a game title';
      if (!Number.isFinite(it.quantity) || it.quantity < 0) return 'Quantity must be a non-negative number';
    }
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) { setMessage(err); return; }
    setMessage(null);
    setLoading(true);
    try {
      const admin = (() => {
        try { return JSON.parse(sessionStorage.getItem('adminData') || '{}'); } catch { return {}; }
      })();
      const payload = {
        report_date: date,
        station,
        staff_on_duty: staffList,
        created_by: admin?.name || admin?.slug || 'unknown',
        created_by_role: admin?.slug || admin?.role_type || null,
        notes: notes || null,
        items: items.map((it) => ({
          game_id: it.game_id,
          game_title: it.game_title,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        })),
      };
      if (editingId) {
        setSavingId(editingId);
        await axios.put(
          `${BACKEND}/v1/admin/internal-control/reports/${editingId}`,
          { staff_on_duty: payload.staff_on_duty, notes: payload.notes, items: payload.items },
          { headers: getAuthHeader() }
        );
        setMessage('Report updated.');
      } else {
        await axios.post(`${BACKEND}/v1/admin/internal-control/reports`, payload, {
          headers: getAuthHeader(),
        });
        setMessage('Report submitted.');
      }
      resetForm();
      fetchRecent();
    } catch (e: any) {
      console.error(e);
      setMessage(e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Request failed');
    } finally {
      setLoading(false);
      setSavingId(null);
    }
  };

  const editable = (r: SavedReport) => isoMinusMs(r.locked_at) > Date.now();

  return (
    <div className="ic-shell">
      <h2>Internal Control — Level 1 Entry</h2>
      <p className="ic-sub">Record camera-based counts. Edits are allowed for 24 hours after creation.</p>

      <div className="ic-card">
        <div className="ic-grid-3">
          <div className="ic-field">
            <label className="ic-field-label">Date</label>
            <input className="ic-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="ic-field">
            <label className="ic-field-label">Station</label>
            <select className="ic-select" value={station} onChange={(e) => setStation(e.target.value as Station)}>
              {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="ic-field">
            <label className="ic-field-label">Total (auto)</label>
            <div className="ic-readonly">{fmt(totalAmount)}</div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="ic-field-label">Staff on duty</label>
          <div className="ic-staff-chips">
            {staffList.map((s) => (
              <span key={s} className="ic-chip">
                {s}<button type="button" onClick={() => removeStaff(s)} aria-label={`Remove ${s}`}>×</button>
              </span>
            ))}
          </div>
          <div className="ic-row">
            <input
              className="ic-input"
              placeholder="Type a staff name and press Enter"
              value={staffInput}
              onChange={(e) => setStaffInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStaff(); } }}
            />
            <button type="button" className="ic-btn ic-btn-primary" onClick={addStaff}>
              Add
            </button>
          </div>
        </div>

        <div className="ic-section-head">
          <h3>Games (camera count)</h3>
          <button type="button" className="ic-btn ic-btn-success" onClick={addItemRow}>
            + Add row
          </button>
        </div>

        {/* Desktop table */}
        <div className="ic-table-wrap">
          <table className="ic-table">
            <thead>
              <tr>
                <th>Game</th>
                <th className="num">Unit ₦</th>
                <th className="num">Quantity</th>
                <th className="num">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td>
                    <select
                      className="ic-select"
                      value={it.game_id ?? ''}
                      onChange={(e) => updateItem(idx, { game_id: e.target.value || null })}
                    >
                      <option value="">-- Select a game --</option>
                      {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                    </select>
                    {!it.game_id && (
                      <input
                        className="ic-input"
                        style={{ marginTop: 4 }}
                        placeholder="Or type a custom title"
                        value={it.game_title}
                        onChange={(e) => updateItem(idx, { game_title: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="num">
                    <input
                      className="ic-input num"
                      type="number"
                      min={0}
                      value={it.unit_price}
                      onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) || 0 })}
                      style={{ maxWidth: 120, textAlign: 'right' }}
                    />
                  </td>
                  <td className="num">
                    <input
                      className="ic-input num"
                      type="number"
                      min={0}
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                      style={{ maxWidth: 100, textAlign: 'right' }}
                    />
                  </td>
                  <td className="num" style={{ fontWeight: 600 }}>{fmt(it.amount)}</td>
                  <td className="num">
                    <button type="button" className="ic-btn ic-btn-danger" onClick={() => removeItemRow(idx)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>
                    No rows yet. Click "+ Add row" to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile item cards */}
        <div className="ic-item-cards">
          {items.map((it, idx) => (
            <div key={idx} className="ic-item-card">
              <div className="ic-item-card-row">
                <label>Game</label>
                <select
                  className="ic-select"
                  value={it.game_id ?? ''}
                  onChange={(e) => updateItem(idx, { game_id: e.target.value || null })}
                  style={{ maxWidth: '65%' }}
                >
                  <option value="">-- Select --</option>
                  {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>
              {!it.game_id && (
                <div className="ic-item-card-row">
                  <label>Custom</label>
                  <input
                    className="ic-input"
                    placeholder="Title"
                    value={it.game_title}
                    onChange={(e) => updateItem(idx, { game_title: e.target.value })}
                    style={{ maxWidth: '65%' }}
                  />
                </div>
              )}
              <div className="ic-item-card-row">
                <label>Unit ₦</label>
                <input
                  className="ic-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={it.unit_price}
                  onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) || 0 })}
                  style={{ maxWidth: '45%', textAlign: 'right' }}
                />
              </div>
              <div className="ic-item-card-row">
                <label>Qty</label>
                <input
                  className="ic-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={it.quantity}
                  onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                  style={{ maxWidth: '45%', textAlign: 'right' }}
                />
              </div>
              <div className="ic-item-card-row">
                <label>Amount</label>
                <span className="value">{fmt(it.amount)}</span>
              </div>
              <div className="ic-item-card-row">
                <button type="button" className="ic-btn ic-btn-danger" onClick={() => removeItemRow(idx)} style={{ width: '100%' }}>
                  Remove row
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div style={{ padding: 18, textAlign: 'center', color: '#9ca3af' }}>
              No rows yet. Tap "+ Add row" to start.
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="ic-field-label">Notes (optional)</label>
          <textarea className="ic-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {message && <div className="ic-banner">{message}</div>}

        <div className="ic-row" style={{ marginTop: 16 }}>
          <button type="button" className="ic-btn ic-btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Submit Report'}
          </button>
          {editingId && (
            <button type="button" className="ic-btn ic-btn-secondary" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <h3 style={{ marginBottom: 8 }}>Reports for {date} — {station}</h3>
        {recent.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 13 }}>No report filed for this date/station yet.</div>
        )}
        {recent.map((r) => (
          <div key={r.id} className="ic-saved-card">
            <div>
              <div className="ic-saved-title">{r.station} — {r.report_date}</div>
              <div className="ic-saved-meta">
                Staff: {(r.staff_on_duty || []).join(', ') || '—'} · {r.items?.length || 0} rows · {fmt((r.items || []).reduce((s, it) => s + it.amount, 0))}
              </div>
              <div className={`ic-saved-lock ${editable(r) ? 'ok' : 'no'}`}>
                {editable(r) ? `Editable until ${new Date(r.locked_at).toLocaleString()}` : 'Locked (edit window expired)'}
              </div>
            </div>
            <button
              type="button"
              className="ic-btn ic-btn-secondary"
              disabled={!editable(r) || savingId === r.id}
              onClick={() => loadForEdit(r)}
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InternalControlEntry;
