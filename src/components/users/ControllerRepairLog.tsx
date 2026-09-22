import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './ControllerRepairLog.css';

/**
 * PS5 controller repair log.
 *
 * A pad goes bad, someone records what is wrong with it, and it stays out of
 * circulation until someone records that it was fixed. Nothing is overwritten
 * on the way through — the entry that was open becomes a closed entry — so the
 * useful question stays answerable: which pads keep coming back, and with what.
 */

const BACKEND = process.env.REACT_APP_BACKEND_URL?.replace(/\/+$/, '') || '';

type FaultCode = 'analog_joystick' | 'flex' | 'rubber' | 'other';

const FAULT_OPTIONS: { code: FaultCode; label: string }[] = [
  { code: 'analog_joystick', label: 'Analog joystick' },
  { code: 'flex',            label: 'Flex'            },
  { code: 'rubber',          label: 'Rubber'          },
  { code: 'other',           label: 'Others (specify)' },
];

const FAULT_LABELS: Record<FaultCode, string> = {
  analog_joystick: 'Analog joystick',
  flex: 'Flex',
  rubber: 'Rubber',
  other: 'Other',
};

interface RepairLog {
  id: string;
  controller_id: string;
  name_tag: string | null;
  console: string | null;
  faults: FaultCode[];
  other_fault: string | null;
  status: 'faulty' | 'repaired';
  reported_at: string | null;
  reported_by: string | null;
  fault_notes: string | null;
  repaired_at: string | null;
  repaired_by: string | null;
  repair_notes: string | null;
}

interface Controller {
  id: string;
  name_tag: string;
  console: string | null;
  status: 'in_service' | 'faulty';
  last_repair_at: string | null;
  repair_count: number;
  open_log: RepairLog | null;
}

const todayIso = () => {
  // Local date, not UTC — a fault reported at 9pm in Lagos belongs to today.
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

/** "2026-08-12" → "12 Aug 2026". Split rather than parsed, to dodge timezones. */
const prettyDate = (iso: string | null): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]} ${y}`;
};

const daysBetween = (from: string | null, to: string | null): number | null => {
  if (!from || !to) return null;
  const ms = Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null;
};

/** The fault list as one readable phrase, with the free-text fault spelled out. */
const describeFaults = (log: Pick<RepairLog, 'faults' | 'other_fault'>): string =>
  log.faults
    .map((f) => (f === 'other' ? log.other_fault || 'Other' : FAULT_LABELS[f] ?? f))
    .join(', ');

const errorText = (err: any, fallback: string): string =>
  err?.response?.data?.message || err?.response?.data?.error || fallback;

const ControllerRepairLog: React.FC = () => {
  const token = localStorage.getItem('operatorToken') || sessionStorage.getItem('token') || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [controllers, setControllers] = useState<Controller[]>([]);
  const [logs, setLogs] = useState<RepairLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // ── Report a fault ────────────────────────────────────────────────────────
  const [padId, setPadId] = useState('');
  const [faults, setFaults] = useState<FaultCode[]>([]);
  const [otherFault, setOtherFault] = useState('');
  const [reportedAt, setReportedAt] = useState(todayIso);
  const [faultNotes, setFaultNotes] = useState('');

  // ── Add a controller ──────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newConsole, setNewConsole] = useState('');

  // ── Closing a repair ──────────────────────────────────────────────────────
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [repairedAt, setRepairedAt] = useState(todayIso);
  const [repairNotes, setRepairNotes] = useState('');

  // ── History filters ───────────────────────────────────────────────────────
  const [filterPad, setFilterPad] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'faulty' | 'repaired'>('');

  const load = useCallback(async () => {
    try {
      const [padsRes, logsRes] = await Promise.all([
        axios.get(`${BACKEND}/v1/admin/controllers`, { headers }),
        axios.get(`${BACKEND}/v1/admin/controller-repairs`, { headers }),
      ]);
      setControllers(padsRes.data?.data?.controllers ?? []);
      setLogs(logsRes.data?.data?.logs ?? []);
      setError(null);
    } catch (err: any) {
      setError(errorText(err, 'Could not load the repair log.'));
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPad = controllers.find((c) => c.id === padId) || null;
  const faultyPads = controllers.filter((c) => c.status === 'faulty');
  const openLogs = logs.filter((l) => l.status === 'faulty');

  // A pad already logged as faulty cannot be reported again — it has an open
  // entry waiting on a repair, and a second one would just split its history.
  const reportable = controllers.filter((c) => c.status === 'in_service');

  const toggleFault = (code: FaultCode) => {
    setFaults((current) =>
      current.includes(code) ? current.filter((f) => f !== code) : [...current, code]
    );
    if (code === 'other') setOtherFault('');
  };

  const resetReportForm = () => {
    setPadId('');
    setFaults([]);
    setOtherFault('');
    setReportedAt(todayIso());
    setFaultNotes('');
  };

  const submitFault = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!padId || faults.length === 0) return;

    setBusy('report');
    setNotice(null);
    try {
      await axios.post(
        `${BACKEND}/v1/admin/controller-repairs`,
        {
          controller_id: padId,
          faults,
          other_fault: otherFault.trim() || null,
          reported_at: reportedAt,
          fault_notes: faultNotes.trim() || null,
        },
        { headers }
      );
      setNotice(`${selectedPad?.name_tag} is now logged as faulty.`);
      resetReportForm();
      await load();
      setError(null);
    } catch (err: any) {
      setError(errorText(err, 'Could not record that fault.'));
    } finally {
      setBusy(null);
    }
  };

  const addController = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTag.trim()) return;

    setBusy('add');
    try {
      const res = await axios.post(
        `${BACKEND}/v1/admin/controllers`,
        { name_tag: newTag.trim(), console: newConsole.trim() || null },
        { headers }
      );
      const created: Controller = res.data?.data?.controller;
      setNotice(`${created.name_tag} added.`);
      setNewTag('');
      setNewConsole('');
      setShowAdd(false);
      await load();
      setPadId(created.id);
      setError(null);
    } catch (err: any) {
      setError(errorText(err, 'Could not add that controller.'));
    } finally {
      setBusy(null);
    }
  };

  const openRepairForm = (log: RepairLog) => {
    setRepairingId(log.id);
    setRepairedAt(todayIso());
    setRepairNotes('');
  };

  const submitRepair = async (event: React.FormEvent, log: RepairLog) => {
    event.preventDefault();
    setBusy(log.id);
    setNotice(null);
    try {
      await axios.patch(
        `${BACKEND}/v1/admin/controller-repairs/${log.id}/repair`,
        { repaired_at: repairedAt, repair_notes: repairNotes.trim() || null },
        { headers }
      );
      setNotice(`${log.name_tag} is back in service.`);
      setRepairingId(null);
      await load();
      setError(null);
    } catch (err: any) {
      setError(errorText(err, 'Could not close that entry.'));
    } finally {
      setBusy(null);
    }
  };

  const visibleLogs = logs.filter(
    (l) => (!filterPad || l.controller_id === filterPad) && (!filterStatus || l.status === filterStatus)
  );

  return (
    <div className="crl-page">
      <header className="crl-head">
        <h2>PS5 Controller Repair Log</h2>
        <p className="crl-sub">
          Log a pad by its name tag when it goes bad, and close the entry when it comes back. Nothing
          is overwritten, so a pad that keeps failing on the same part shows up as a pattern rather
          than as a surprise.
        </p>
      </header>

      {error && <p className="crl-error" role="alert">{error}</p>}
      {notice && <p className="crl-notice">{notice}</p>}

      {/* ── The board ──────────────────────────────────────────────────────── */}
      <section className="crl-card">
        <div className="crl-card-head">
          <h3>Controllers</h3>
          <button type="button" className="crl-btn crl-btn--small" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? 'Cancel' : '+ Add a controller'}
          </button>
        </div>

        {showAdd && (
          <form className="crl-inline-form" onSubmit={addController}>
            <label className="crl-field">
              <span>Name tag</span>
              <input
                className="crl-input"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="e.g. PS5-04B"
                maxLength={40}
                required
              />
            </label>
            <label className="crl-field">
              <span>Console / booth <em>(optional)</em></span>
              <input
                className="crl-input"
                value={newConsole}
                onChange={(e) => setNewConsole(e.target.value)}
                placeholder="e.g. Console 4"
                maxLength={60}
              />
            </label>
            <button type="submit" className="crl-btn crl-btn--primary" disabled={busy === 'add'}>
              {busy === 'add' ? 'Adding…' : 'Add'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="crl-muted">Loading…</p>
        ) : controllers.length === 0 ? (
          <p className="crl-muted">No controllers yet. Add one to start logging repairs.</p>
        ) : (
          <>
            <p className="crl-tally">
              <strong>{controllers.length - faultyPads.length}</strong> in service ·{' '}
              <strong>{faultyPads.length}</strong> faulty
            </p>
            <ul className="crl-board">
              {controllers.map((pad) => (
                <li key={pad.id} className={`crl-pad crl-pad--${pad.status}`}>
                  <span className="crl-pad-tag">{pad.name_tag}</span>
                  <span className="crl-pad-state">
                    {pad.status === 'faulty' ? 'Faulty' : 'In service'}
                  </span>
                  <span className="crl-pad-meta">
                    {pad.console ? `${pad.console} · ` : ''}
                    Last repair: {prettyDate(pad.last_repair_at)}
                    {pad.repair_count > 0 ? ` · ${pad.repair_count} repair${pad.repair_count === 1 ? '' : 's'}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ── Report a fault ─────────────────────────────────────────────────── */}
      <section className="crl-card">
        <h3>Report a fault</h3>
        <p className="crl-note">
          Recording a fault takes the pad out of service straight away. It stays out until the entry
          is closed below.
        </p>

        <form onSubmit={submitFault}>
          <div className="crl-grid">
            <label className="crl-field">
              <span>Name tag</span>
              <select
                className="crl-input"
                value={padId}
                onChange={(e) => setPadId(e.target.value)}
                required
              >
                <option value="">Select a controller…</option>
                {reportable.map((pad) => (
                  <option key={pad.id} value={pad.id}>
                    {pad.name_tag}
                    {pad.console ? ` — ${pad.console}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="crl-field">
              <span>Date reported</span>
              <input
                type="date"
                className="crl-input"
                value={reportedAt}
                max={todayIso()}
                onChange={(e) => setReportedAt(e.target.value)}
                required
              />
            </label>

            {/* Read-only, and the reason this pad's history is worth keeping:
                a break three days after the last repair is a different problem
                from a break two years after it. */}
            <div className="crl-field">
              <span>Date of last repair</span>
              <output className="crl-readout">
                {selectedPad
                  ? selectedPad.last_repair_at
                    ? `${prettyDate(selectedPad.last_repair_at)} · ${selectedPad.repair_count} repair${selectedPad.repair_count === 1 ? '' : 's'} on record`
                    : 'Never repaired'
                  : '—'}
              </output>
            </div>
          </div>

          {/* A dropdown rather than a checkbox row, but one that keeps what it
              picks: a pad rarely breaks in one place, and a drifting stick with
              a torn rubber has to be recordable as one visit to the bench. */}
          <div className="crl-field crl-field--wide">
            <span className="crl-field-label">Fault(s) detected</span>
            <select
              className="crl-input"
              value=""
              onChange={(e) => {
                const code = e.target.value as FaultCode;
                if (code) toggleFault(code);
              }}
            >
              <option value="">
                {faults.length === 0 ? 'Select a fault…' : 'Add another fault…'}
              </option>
              {FAULT_OPTIONS.filter((o) => !faults.includes(o.code)).map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>

            {faults.length > 0 && (
              <ul className="crl-chips">
                {faults.map((code) => (
                  <li key={code} className="crl-chip">
                    {FAULT_OPTIONS.find((o) => o.code === code)?.label ?? code}
                    <button
                      type="button"
                      className="crl-chip-x"
                      aria-label={`Remove ${FAULT_LABELS[code]}`}
                      onClick={() => toggleFault(code)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {faults.includes('other') && (
            <label className="crl-field crl-field--wide">
              <span>Specify the other fault</span>
              <input
                className="crl-input"
                value={otherFault}
                onChange={(e) => setOtherFault(e.target.value)}
                placeholder="e.g. Charging port loose"
                required
              />
            </label>
          )}

          <label className="crl-field crl-field--wide">
            <span>Notes <em>(optional)</em></span>
            <textarea
              className="crl-input crl-textarea"
              value={faultNotes}
              onChange={(e) => setFaultNotes(e.target.value)}
              rows={2}
              placeholder="Anything the person repairing it should know"
            />
          </label>

          <button
            type="submit"
            className="crl-btn crl-btn--danger"
            disabled={busy === 'report' || !padId || faults.length === 0}
          >
            {busy === 'report' ? 'Recording…' : 'Record as faulty'}
          </button>
          {reportable.length === 0 && controllers.length > 0 && (
            <p className="crl-muted crl-inline-note">Every controller on the board is already logged as faulty.</p>
          )}
        </form>
      </section>

      {/* ── Awaiting repair ────────────────────────────────────────────────── */}
      <section className="crl-card">
        <h3>Awaiting repair {openLogs.length > 0 && <span className="crl-count">{openLogs.length}</span>}</h3>

        {openLogs.length === 0 ? (
          <p className="crl-muted">Nothing is out of service right now.</p>
        ) : (
          <ul className="crl-open-list">
            {openLogs.map((log) => {
              const waiting = daysBetween(log.reported_at, todayIso());
              return (
                <li key={log.id} className="crl-open">
                  <div className="crl-open-head">
                    <div>
                      <strong className="crl-open-tag">{log.name_tag}</strong>
                      <span className="crl-open-faults">{describeFaults(log)}</span>
                    </div>
                    <span className="crl-open-age">
                      Reported {prettyDate(log.reported_at)}
                      {waiting !== null ? ` · ${waiting} day${waiting === 1 ? '' : 's'} out` : ''}
                    </span>
                  </div>

                  {log.fault_notes && <p className="crl-open-notes">{log.fault_notes}</p>}

                  {repairingId === log.id ? (
                    <form className="crl-inline-form" onSubmit={(e) => submitRepair(e, log)}>
                      <label className="crl-field">
                        <span>Date of repair</span>
                        <input
                          type="date"
                          className="crl-input"
                          value={repairedAt}
                          min={log.reported_at || undefined}
                          max={todayIso()}
                          onChange={(e) => setRepairedAt(e.target.value)}
                          required
                        />
                      </label>
                      <label className="crl-field crl-field--grow">
                        <span>What was done <em>(optional)</em></span>
                        <input
                          className="crl-input"
                          value={repairNotes}
                          onChange={(e) => setRepairNotes(e.target.value)}
                          placeholder="e.g. Replaced left analog module"
                        />
                      </label>
                      <button type="submit" className="crl-btn crl-btn--primary" disabled={busy === log.id}>
                        {busy === log.id ? 'Saving…' : 'Save repair'}
                      </button>
                      <button type="button" className="crl-btn crl-btn--small" onClick={() => setRepairingId(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button type="button" className="crl-btn crl-btn--primary crl-btn--small" onClick={() => openRepairForm(log)}>
                      Mark repaired
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── The log ────────────────────────────────────────────────────────── */}
      <section className="crl-card">
        <div className="crl-card-head">
          <h3>Repair log</h3>
          <div className="crl-filters">
            <select className="crl-input crl-input--tight" value={filterPad} onChange={(e) => setFilterPad(e.target.value)}>
              <option value="">All controllers</option>
              {controllers.map((pad) => (
                <option key={pad.id} value={pad.id}>{pad.name_tag}</option>
              ))}
            </select>
            <select
              className="crl-input crl-input--tight"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as '' | 'faulty' | 'repaired')}
            >
              <option value="">Any status</option>
              <option value="faulty">Faulty</option>
              <option value="repaired">Repaired</option>
            </select>
          </div>
        </div>

        {visibleLogs.length === 0 ? (
          <p className="crl-muted">No entries yet.</p>
        ) : (
          <div className="crl-scroll">
            <table className="crl-table">
              <thead>
                <tr>
                  <th>Name tag</th>
                  <th>Fault(s) detected</th>
                  <th>Reported</th>
                  <th>Date of repair</th>
                  <th className="crl-num">Days out</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((log) => {
                  const out = daysBetween(log.reported_at, log.repaired_at ?? todayIso());
                  return (
                    <tr key={log.id} className={log.status === 'faulty' ? 'crl-row--faulty' : undefined}>
                      <td className="crl-cell-tag">{log.name_tag}</td>
                      <td>{describeFaults(log)}</td>
                      <td>{prettyDate(log.reported_at)}</td>
                      <td>{prettyDate(log.repaired_at)}</td>
                      <td className="crl-num">{out === null ? '—' : out}</td>
                      <td>
                        <span className={`crl-badge crl-badge--${log.status}`}>
                          {log.status === 'faulty' ? 'Faulty' : 'Repaired'}
                        </span>
                      </td>
                      <td className="crl-cell-notes">
                        {[log.fault_notes, log.repair_notes].filter(Boolean).join(' → ') || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ControllerRepairLog;
