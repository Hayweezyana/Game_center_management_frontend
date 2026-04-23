import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

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
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h2 style={{ marginBottom: 4 }}>Internal Control — Level 1 Entry</h2>
      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Record camera-based counts. Edits are allowed for 24 hours after creation.
      </p>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Date</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Station</div>
            <select value={station} onChange={(e) => setStation(e.target.value as Station)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
              {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Total (auto)</div>
            <div style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', fontWeight: 600 }}>
              {fmt(totalAmount)}
            </div>
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Staff on duty</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            {staffList.map((s) => (
              <span key={s} style={{ background: '#eef2ff', color: '#3730a3', padding: '4px 10px', borderRadius: 999, fontSize: 13 }}>
                {s} <button type="button" onClick={() => removeStaff(s)} style={{ marginLeft: 6, border: 'none', background: 'transparent', color: '#3730a3', cursor: 'pointer' }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Type a staff name and press Enter"
              value={staffInput}
              onChange={(e) => setStaffInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStaff(); } }}
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
            />
            <button type="button" onClick={addStaff}
              style={{ padding: '8px 14px', border: '1px solid #4338ca', background: '#4f46e5', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              Add
            </button>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Games (camera count)</h3>
            <button type="button" onClick={addItemRow}
              style={{ padding: '6px 12px', border: '1px solid #065f46', background: '#059669', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              + Add row
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>Game</th>
                <th style={{ textAlign: 'right', padding: 8, fontSize: 12 }}>Unit ₦</th>
                <th style={{ textAlign: 'right', padding: 8, fontSize: 12 }}>Quantity</th>
                <th style={{ textAlign: 'right', padding: 8, fontSize: 12 }}>Amount</th>
                <th style={{ padding: 8 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 6 }}>
                    <select value={it.game_id ?? ''} onChange={(e) => updateItem(idx, { game_id: e.target.value || null })}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                      <option value="">-- Select a game --</option>
                      {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                    </select>
                    {!it.game_id && (
                      <input
                        placeholder="Or type a custom title"
                        value={it.game_title}
                        onChange={(e) => updateItem(idx, { game_title: e.target.value })}
                        style={{ marginTop: 4, width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}
                      />
                    )}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    <input type="number" min={0} value={it.unit_price}
                      onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) || 0 })}
                      style={{ width: 110, textAlign: 'right', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    <input type="number" min={0} value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                      style={{ width: 90, textAlign: 'right', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                  </td>
                  <td style={{ padding: 6, textAlign: 'right', fontWeight: 600 }}>{fmt(it.amount)}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    <button type="button" onClick={() => removeItemRow(idx)}
                      style={{ border: '1px solid #dc2626', color: '#dc2626', background: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No rows yet. Click "Add row" to start.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Notes (optional)</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
        </div>

        {message && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 6, background: '#f3f4f6', color: '#111827', fontSize: 13 }}>
            {message}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button type="button" onClick={submit} disabled={loading}
            style={{ padding: '10px 18px', border: '1px solid #1d4ed8', background: '#2563eb', color: '#fff', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Submit Report'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}
              style={{ padding: '10px 14px', border: '1px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: 6, cursor: 'pointer' }}>
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
          <div key={r.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.station} — {r.report_date}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Staff: {(r.staff_on_duty || []).join(', ') || '—'} · {r.items?.length || 0} rows · {fmt((r.items || []).reduce((s, it) => s + it.amount, 0))}
                </div>
                <div style={{ fontSize: 11, color: editable(r) ? '#047857' : '#991b1b' }}>
                  {editable(r) ? `Editable until ${new Date(r.locked_at).toLocaleString()}` : 'Locked (edit window expired)'}
                </div>
              </div>
              <button type="button" disabled={!editable(r) || savingId === r.id} onClick={() => loadForEdit(r)}
                style={{ padding: '6px 12px', border: '1px solid #d1d5db', background: editable(r) ? '#fff' : '#f3f4f6', color: editable(r) ? '#111827' : '#9ca3af', borderRadius: 6, cursor: editable(r) ? 'pointer' : 'not-allowed' }}>
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InternalControlEntry;
