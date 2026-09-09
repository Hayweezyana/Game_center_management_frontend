import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './DeleteTransaction.css';

/**
 * Site-admin-only transaction deletion.
 *
 * Deleting a sale cascades through its items, payments, drinks, consumed games,
 * schedule rows and feedback — it rewrites the day's takings. So this screen
 * shows exactly what would go before it goes, insists on a reason, and lists
 * what has already been deleted and by whom.
 */

interface TransactionRow {
  id: string;
  reference: string | null;
  username: string;
  phone: string;
  total_amount: number;
  discount: number;
  created_at: string;
  credit_status: string | null;
  items: Array<{ title: string; quantity: number }>;
  rounds: number;
  /** Rounds already played — deleting these erases a game that happened. */
  played: number;
  payments: Array<{ method: string; amount: number }>;
}

interface DeletedRow {
  id: string;
  transaction_id: string;
  reference: string | null;
  username: string | null;
  total_amount: number | null;
  deleted_by: string;
  deleted_by_role: string | null;
  reason: string | null;
  deleted_at: string;
}

const BACKEND = process.env.REACT_APP_BACKEND_URL?.replace(/\/+$/, '') || '';

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

const when = (iso: string) =>
  new Date(iso).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const DeleteTransaction: React.FC = () => {
  const token = sessionStorage.getItem('token') || '';
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [deleted, setDeleted] = useState<DeletedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Confirmation state — nothing is deleted without both of these.
  const [target, setTarget] = useState<TransactionRow | null>(null);
  const [reason, setReason] = useState('');
  const [typedReference, setTypedReference] = useState('');
  const [deleting, setDeleting] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/transactions-search`, {
        headers,
        params: { q: query.trim() || undefined, startDate, endDate, limit: 100 },
      });
      setRows(res.data?.data ?? []);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setError('Only site admins can delete transactions.');
      } else {
        setError(err?.response?.data?.error || 'Could not load transactions.');
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers, query, startDate, endDate]);

  const loadDeleted = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/deleted-transactions`, {
        headers,
        params: { limit: 50 },
      });
      setDeleted(res.data?.data ?? []);
    } catch {
      // The audit list is supporting detail — never block the screen on it.
    }
  }, [headers]);

  useEffect(() => {
    void search();
    void loadDeleted();
  }, [search, loadDeleted]);

  const closeConfirm = () => {
    setTarget(null);
    setReason('');
    setTypedReference('');
  };

  // Typing the reference back is the guard against deleting the wrong row in a
  // list where several sales look alike.
  const expected = (target?.reference || target?.id || '').trim();
  const confirmed = typedReference.trim() === expected && reason.trim().length >= 3;

  const performDelete = async () => {
    if (!target || !confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await axios.delete(`${BACKEND}/v1/admin/transactions/${target.id}`, {
        headers,
        data: { reason: reason.trim() },
      });
      const removed = res.data?.data?.removed;
      setNotice(
        `Deleted ${target.reference || target.id} — ${naira(target.total_amount)}, ` +
          `${removed?.items ?? 0} item row(s), ${removed?.consumed_games ?? 0} played round(s).`
      );
      closeConfirm();
      await Promise.all([search(), loadDeleted()]);
    } catch (err: any) {
      setError(
        err?.response?.status === 403
          ? 'Only site admins can delete transactions.'
          : err?.response?.data?.error || 'Delete failed.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="dt-page">
      <header className="dt-header">
        <div>
          <h2>Delete a transaction</h2>
          <p className="dt-sub">
            Removes the sale and everything attached to it — items, payments, drinks, played rounds,
            schedule and ratings. A copy is archived first, so a mistake can be traced and rebuilt.
          </p>
        </div>
      </header>

      <div className="dt-filters">
        <input
          type="text"
          placeholder="Reference, name or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
        />
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="From" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="To" />
        <button type="button" className="dt-btn" onClick={() => void search()}>Search</button>
      </div>

      {error && <p className="dt-error">{error}</p>}
      {notice && <p className="dt-notice">{notice}</p>}

      <div className="dt-scroll">
        <table className="dt-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Reference</th>
              <th>Customer</th>
              <th className="dt-num">Amount</th>
              <th>Rounds</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{when(row.created_at)}</td>
                <td className="dt-mono">{row.reference || '—'}</td>
                <td>
                  {row.username}
                  <span className="dt-muted-inline">{row.phone}</span>
                </td>
                <td className="dt-num">{naira(row.total_amount)}</td>
                <td>
                  {row.rounds} in {row.items.length} game{row.items.length === 1 ? '' : 's'}
                  {row.played > 0 && (
                    <span className="dt-played">{row.played} already played</span>
                  )}
                </td>
                <td>
                  <button type="button" className="dt-btn dt-btn--danger" onClick={() => setTarget(row)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="dt-empty">No transactions in this range.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="dt-empty">Loading…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="dt-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm deletion">
          <div className="dt-modal">
            <h3>Delete {target.reference || target.id}?</h3>

            <ul className="dt-summary">
              <li><strong>{target.username}</strong> · {target.phone}</li>
              <li>{naira(target.total_amount)}{target.discount > 0 && ` (after ${naira(target.discount)} discount)`}</li>
              <li>{when(target.created_at)}</li>
              <li>
                {target.items.map((i) => `${i.quantity}× ${i.title}`).join(', ') || 'No game items'}
              </li>
              {target.payments.length > 0 && (
                <li>{target.payments.map((p) => `${p.method} ${naira(p.amount)}`).join(', ')}</li>
              )}
            </ul>

            {target.played > 0 && (
              <p className="dt-warn">
                {target.played} round{target.played === 1 ? ' has' : 's have'} already been played.
                Deleting this erases games that actually happened, and the takings that paid for them.
              </p>
            )}

            <label className="dt-label" htmlFor="dt-reason">Why are you deleting this?</label>
            <input
              id="dt-reason"
              className="dt-input"
              type="text"
              maxLength={300}
              placeholder="e.g. duplicate entry, wrong customer"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <label className="dt-label" htmlFor="dt-confirm">
              Type <span className="dt-mono">{expected}</span> to confirm
            </label>
            <input
              id="dt-confirm"
              className="dt-input dt-mono"
              type="text"
              value={typedReference}
              onChange={(e) => setTypedReference(e.target.value)}
              autoComplete="off"
            />

            <div className="dt-modal-actions">
              <button type="button" className="dt-btn" onClick={closeConfirm} disabled={deleting}>
                Cancel
              </button>
              <button
                type="button"
                className="dt-btn dt-btn--danger"
                disabled={!confirmed || deleting}
                onClick={() => void performDelete()}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleted.length > 0 && (
        <section className="dt-audit">
          <h3>Recently deleted</h3>
          <div className="dt-scroll">
            <table className="dt-table">
              <thead>
                <tr>
                  <th>Deleted</th>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th className="dt-num">Amount</th>
                  <th>By</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {deleted.map((row) => (
                  <tr key={row.id}>
                    <td>{when(row.deleted_at)}</td>
                    <td className="dt-mono">{row.reference || '—'}</td>
                    <td>{row.username || '—'}</td>
                    <td className="dt-num">{row.total_amount === null ? '—' : naira(row.total_amount)}</td>
                    <td>{row.deleted_by}</td>
                    <td className="dt-muted">{row.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default DeleteTransaction;
