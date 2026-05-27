import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Report from '../report';
import InternalControlEntry from '../InternalControlEntry';
import InternalControlDashboard from '../InternalControlDashboard';
import TennisScoreEntry from '../TennisScoreEntry';
import './Admin.css';
import {
  getAdminRole,
  getPermittedTabs,
  canManageAdmins,
  encodeRoleDescription,
  ROLE_LABELS,
  type RoleType,
  type AdminTab,
  type ParsedAdminRole,
} from '../../utils/adminPermissions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'pc' | 'queue' | 'bypasses' | 'games' | 'drinks' | 'reports' | 'admins' | 'manual-tx' | 'ic-entry' | 'ic-dashboard' | 'tennis';

interface PcRow {
  id: string;
  title: string;
  isLocked?: boolean;
  isOnline?: boolean;
  busyUntil?: number | null;
}

interface GameItem {
  id: string;
  game_title: string;
  game_duration: number;
  game_price: number;
  username: string;
  game_quantity: number;
  transaction_time: string;
  unit_index: number;
  transaction_id: string;
}

interface Game {
  id: string;
  title: string;
  price: number;
  url: string;
  time_slot: number;
}

interface Drink {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface ConsumedGameRecord {
  id: string;
  game_title: string;
  unit_index: number;
  username?: string;
  operator_name: string;
  consumed_at: string;
}

interface BypassLog {
  id: string;
  admin: string;
  timestamp: string;
  pc_name: string;
  pc_id: string;
  created_at: string;
}

interface AdminUser {
  id: string;
  name: string;
  description: string;
  slug: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:2024').replace(/\/+$/, '');

const ALL_TABS: { key: Tab; label: string }[] = [
  { key: 'overview',     label: 'Overview'                     },
  { key: 'pc',           label: '🖥  PC Control'             },
  { key: 'queue',        label: '🎮  Operator Queue'          },
  { key: 'bypasses',     label: '🔑  Bypass Logs'             },
  { key: 'games',        label: '🕹  Games'                   },
  { key: 'drinks',       label: '🥤  Drinks'                  },
  { key: 'reports',      label: '📊  Reports'                 },
  { key: 'admins',       label: '👤  Admins'                  },
  { key: 'manual-tx',    label: '🧾  Manual Transaction'      },
  { key: 'ic-entry',     label: '📝  Internal Control — Entry'     },
  { key: 'ic-dashboard', label: '🔎  Internal Control — Review'    },
  { key: 'tennis',       label: '🏓  Table Tennis Score'           },
];

const TAB_SUMMARIES: Record<Exclude<Tab, 'overview'>, string> = {
  pc: 'Lock or unlock PCs and monitor their live status.',
  queue: 'Verify payments and assign customers to available PCs.',
  bypasses: 'Review emergency bypass actions across the center.',
  games: 'Manage the game catalog, pricing, and time slots.',
  drinks: 'Track drink stock levels and update inventory.',
  reports: 'Open sales, customer, and consumed-game reporting.',
  admins: 'Create and manage admin accounts and permissions.',
  'manual-tx': 'Record manual or split transactions from the desk.',
  'ic-entry': 'File camera-review counts by station (editable for 24 hours).',
  'ic-dashboard': 'Compare recorded counts against actual sales (green/red/blue).',
  'tennis': 'Record table tennis scores live — customers see the scoreboard in real time.',
};

// ─── Component ────────────────────────────────────────────────────────────────

const Admin: React.FC = () => {
  const navigate = useNavigate();

  // ── Role / permissions ──────────────────────────────────────────────────────
  const adminRole: ParsedAdminRole | null = React.useMemo(() => getAdminRole(), []);
  const permittedTabs = React.useMemo(
    () => (adminRole ? getPermittedTabs(adminRole) : (['reports'] as AdminTab[])),
    [adminRole]
  );
  const visibleTabs = React.useMemo(
    () => ALL_TABS.filter(t => t.key === 'overview' || permittedTabs.includes(t.key as AdminTab)),
    [permittedTabs]
  );

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const adminToken    = sessionStorage.getItem('token')         || '';
  const operatorToken = localStorage.getItem('operatorToken')   || '';

  // ── Change Password modal ───────────────────────────────────────────────────
  const [showChangePw, setShowChangePw]     = useState(false);
  const [cpCurrent,    setCpCurrent]        = useState('');
  const [cpNew,        setCpNew]            = useState('');
  const [cpConfirm,    setCpConfirm]        = useState('');
  const [cpMsg,        setCpMsg]            = useState<{ ok: boolean; text: string } | null>(null);
  const [cpBusy,       setCpBusy]           = useState(false);

  const handleChangePassword = async () => {
    if (cpNew !== cpConfirm) { setCpMsg({ ok: false, text: 'New passwords do not match.' }); return; }
    if (cpNew.length < 8)    { setCpMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return; }
    if (!adminRole?.raw?.id) { setCpMsg({ ok: false, text: 'Session error — please log in again.' }); return; }
    setCpBusy(true);
    try {
      await axios.put(`${BACKEND}/v1/admin/roles/${adminRole.raw.id}`, {
        name: adminRole.raw.name,
        description: adminRole.raw.description ?? '',
        current_password: cpCurrent,
        new_password: cpNew,
        permissions: [uuidv4()], // required by validator; factory ignores it
      }, { headers: { Authorization: `Bearer ${adminToken}` } });
      setCpMsg({ ok: true, text: 'Password changed successfully.' });
      setCpCurrent(''); setCpNew(''); setCpConfirm('');
    } catch (e: any) {
      setCpMsg({ ok: false, text: e?.response?.data?.error ?? 'Password change failed.' });
    } finally {
      setCpBusy(false);
    }
  };

  const adminHeaders   = adminToken    ? { Authorization: `Bearer ${adminToken}`    } : {};
  const operatorHeaders = operatorToken ? { Authorization: `Bearer ${operatorToken}` } : {};

  // ── Shared PC list (fed by DB seed + WebSocket live updates) ────────────────
  const wsRef = useRef<WebSocket | null>(null);
  const [pcs, setPcs] = useState<PcRow[]>([]);

  // Seed from DB so all registered PCs appear even before any WS connection
  useEffect(() => {
    axios.get(`${BACKEND}/v1/admin/pc`, { headers: adminHeaders })
      .then(res => {
        const rows: any[] = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        setPcs(prev => {
          const liveIds = new Set(prev.map(p => p.id));
          const seeds = rows
            .filter(r => !liveIds.has(String(r.id)))
            .map(r => ({ id: String(r.id), title: String(r.title), isLocked: true, isOnline: false, busyUntil: null }));
          return [...prev, ...seeds];
        });
      })
      .catch(() => {}); // not critical — WS will populate
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket connection (PC Control + Operator Queue both use it) ──────────
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        const u = new URL(BACKEND);
        u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(u.origin + '/ws');
      } catch {
        ws = new WebSocket('ws://127.0.0.1:2024/ws');
      }
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'register_dashboard' }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === 'pcs-sync' && Array.isArray(msg.pcs)) {
            // WS sync overrides everything — merge with any DB-seeded offline PCs
            const livePcs: any[] = msg.pcs;
            const liveById: Record<string, any> = {};
            livePcs.forEach((pc: any) => { liveById[String(pc.id)] = pc; });
            const toRow = (pc: any): PcRow => ({
              id: String(pc.id),
              title: String(pc.title),
              isLocked: pc.isLocked ?? pc.status === 'locked',
              isOnline: pc.isOnline ?? false,
              busyUntil: pc.busyUntil ?? null,
            });
            setPcs(prev => {
              const merged = prev.map(p => {
                const live = liveById[p.id];
                return live ? toRow(live) : p; // keep DB-seeded row as-is if offline
              });
              // Add any live PCs not yet in our list
              livePcs.forEach((live: any) => {
                if (!merged.find(p => p.id === String(live.id))) {
                  merged.push(toRow(live));
                }
              });
              return merged;
            });
          }
          if (msg?.type === 'pc-status' && msg.pc) {
            const p = msg.pc;
            setPcs(prev => {
              const exists = prev.find(x => x.id === p.id);
              const updated: PcRow = {
                id: p.id, title: p.title,
                isLocked: p.isLocked ?? p.status === 'locked',
                isOnline: p.isOnline ?? true,
                busyUntil: p.busyUntil ?? null,
              };
              return exists ? prev.map(x => x.id === p.id ? updated : x) : [...prev, updated];
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 4000);
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
      wsRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const renderOverview = () => {
    const accessibleTabs = visibleTabs.filter(({ key }) => key !== 'overview');

    return (
      <div className="tab-section overview-section">
        <div className="overview-header">
          <div>
            <h2>Dashboard Overview</h2>
            <p className="overview-copy">
              Use these shortcuts to jump into the tools available for your current role.
            </p>
          </div>
          <div className="overview-metrics" aria-label="dashboard summary">
            <div className="overview-metric">
              <span>Role</span>
              <strong>{adminRole ? ROLE_LABELS[adminRole.roleType] : 'Reports only'}</strong>
            </div>
            <div className="overview-metric">
              <span>Modules</span>
              <strong>{accessibleTabs.length}</strong>
            </div>
            <div className="overview-metric">
              <span>Live PCs</span>
              <strong>{pcs.filter(pc => pc.isOnline).length}</strong>
            </div>
          </div>
        </div>

        <div className="overview-grid">
          {accessibleTabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className="overview-card"
              onClick={() => {
                setActiveTab(key);
                window.scrollTo({ top: 0 });
              }}
            >
              <span className="overview-card-label">{label}</span>
              <span className="overview-card-copy">{TAB_SUMMARIES[key as Exclude<Tab, 'overview'>]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: PC CONTROL
  // ═══════════════════════════════════════════════════════════════════════════

  const [pcUnlockMins, setPcUnlockMins] = useState<Record<string, string>>({});
  const [pcMsg, setPcMsg] = useState('');
  const [newPcTitle, setNewPcTitle] = useState('');
  const [addingPc, setAddingPc] = useState(false);

  const lockPc = async (id: string) => {
    try {
      await axios.post(`${BACKEND}/v1/admin/pcs/${id}/lock`, {}, { headers: adminHeaders });
      setPcMsg(`Locked PC ${id}`);
    } catch (e: any) {
      setPcMsg(`Error: ${e?.response?.data?.error ?? e.message}`);
    }
  };

  const unlockPc = async (id: string) => {
    const mins = Number(pcUnlockMins[id] || 10);
    try {
      await axios.post(`${BACKEND}/v1/admin/pcs/${id}/unlock`, { duration_minutes: mins }, { headers: adminHeaders });
      setPcMsg(`Unlocked PC ${id} for ${mins} min`);
    } catch (e: any) {
      setPcMsg(`Error: ${e?.response?.data?.error ?? e.message}`);
    }
  };

  const addPc = async () => {
    const title = newPcTitle.trim();
    if (!title) return;
    setAddingPc(true);
    try {
      const res = await axios.post(`${BACKEND}/v1/admin/pc`, { title }, { headers: adminHeaders });
      const created = res.data?.data ?? res.data;
      setPcs(prev => [...prev, { id: String(created.id), title: String(created.title), isLocked: true, isOnline: false, busyUntil: null }]);
      setNewPcTitle('');
      setPcMsg(`PC "${title}" registered. Open the game PC app and enter this name to connect it.`);
    } catch (e: any) {
      setPcMsg(`Error: ${e?.response?.data?.error ?? e.message}`);
    } finally {
      setAddingPc(false);
    }
  };

  const renderPcControl = () => (
    <div className="tab-section">
      <h2>PC Control</h2>
      {pcMsg && <div className="info-banner">{pcMsg}</div>}

      {/* Register a new PC */}
      <div className="pc-register-row">
        <input
          className="mins-input"
          style={{ width: 200, marginRight: 8 }}
          placeholder="PC name (e.g. Gaming PC 1)"
          value={newPcTitle}
          onChange={e => setNewPcTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addPc()}
        />
        <button className="btn-unlock" onClick={addPc} disabled={addingPc || !newPcTitle.trim()}>
          {addingPc ? 'Adding…' : '+ Register PC'}
        </button>
      </div>

      <div className="pc-grid">
        {pcs.length === 0 && (
          <p className="no-data">No PCs registered yet. Add one above, then open the game PC app on that machine to connect it.</p>
        )}
        {pcs.map(pc => {
          const busyUntilStr = pc.busyUntil
            ? new Date(pc.busyUntil).toLocaleTimeString()
            : null;
          return (
            <div key={pc.id} className={`pc-card ${pc.isLocked ? 'pc-locked' : 'pc-unlocked'} ${!pc.isOnline ? 'pc-offline' : ''}`}>
              <div className="pc-card-title">{pc.title}</div>
              <div className="pc-card-badges">
                <span className={`badge ${pc.isOnline ? 'badge-green' : 'badge-red'}`}>
                  {pc.isOnline ? 'Online' : 'Offline'}
                </span>
                <span className={`badge ${pc.isLocked ? 'badge-blue' : 'badge-yellow'}`}>
                  {pc.isLocked ? 'Locked' : 'Unlocked'}
                </span>
              </div>
              {!pc.isOnline && (
                <div className="pc-card-busy" style={{ color: '#94a3b8', fontSize: 11 }}>
                  Open the game PC app on this machine to connect
                </div>
              )}
              {busyUntilStr && (
                <div className="pc-card-busy">Free at {busyUntilStr}</div>
              )}
              <div className="pc-card-actions">
                <input
                  type="number"
                  min={1}
                  max={120}
                  placeholder="min"
                  value={pcUnlockMins[pc.id] || ''}
                  onChange={e => setPcUnlockMins(prev => ({ ...prev, [pc.id]: e.target.value }))}
                  className="mins-input"
                />
                <button
                  className="btn-unlock"
                  disabled={!pc.isOnline}
                  onClick={() => unlockPc(pc.id)}
                >
                  Unlock
                </button>
                <button
                  className="btn-lock"
                  disabled={!pc.isOnline}
                  onClick={() => lockPc(pc.id)}
                >
                  Lock
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: OPERATOR QUEUE
  // ═══════════════════════════════════════════════════════════════════════════

  const [queueGames, setQueueGames] = useState<GameItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [selectedItem, setSelectedItem] = useState<GameItem | null>(null);
  const [selectedPcId, setSelectedPcId] = useState('');
  const [queueMsg, setQueueMsg] = useState('');

  // Swap state
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapTxId, setSwapTxId] = useState('');
  const [swapUsername, setSwapUsername] = useState('');
  const [swapRemoveIds, setSwapRemoveIds] = useState<Set<string>>(new Set());
  const [swapNewGameId, setSwapNewGameId] = useState('');
  const [swapStep, setSwapStep] = useState<'select' | 'payment'>('select');
  const [swapExtra, setSwapExtra] = useState(0);
  const [swapMethods, setSwapMethods] = useState<string[]>([]);
  const [swapPayMethod, setSwapPayMethod] = useState('');
  const [swapPayAmount, setSwapPayAmount] = useState(0);
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapError, setSwapError] = useState('');

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    const headers = operatorToken ? operatorHeaders : adminHeaders;
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/consumed-game`, { headers });
      const now = Date.now();
      setQueueGames((res.data as GameItem[]).filter(item => {
        const hrs = (now - new Date(item.transaction_time).getTime()) / (1000 * 60 * 60);
        return hrs <= 168;
      }));
    } catch (e: any) {
      setQueueError('Could not load games.');
    } finally {
      setQueueLoading(false);
    }
  }, [operatorToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'queue') fetchQueue();
  }, [activeTab, fetchQueue]);

  const handleConsume = async (item: GameItem) => {
    const headers = operatorToken ? operatorHeaders : adminHeaders;
    try {
      await axios.post(
        `${BACKEND}/v1/admin/consumed-game/consume`,
        { transactionItemId: item.id, unit_index: item.unit_index, game_title: item.game_title },
        { headers }
      );
      setQueueGames(prev => prev.filter(g => !(g.id === item.id && g.unit_index === item.unit_index)));
      setSelectedItem(item);
      setSelectedPcId('');
      setQueueMsg('');
    } catch (e: any) {
      setQueueError('Failed to mark as consumed.');
    }
  };

  const handleOpenPc = async () => {
    if (!selectedItem || !selectedPcId) return;
    const duration = (selectedItem.game_duration ?? 6) + 3;
    const headers = operatorToken ? operatorHeaders : adminHeaders;
    try {
      await axios.post(
        `${BACKEND}/v1/admin/pcs/${encodeURIComponent(selectedPcId)}/unlock`,
        { duration_minutes: duration, transactionItemId: selectedItem.id, unit_index: selectedItem.unit_index },
        { headers }
      );
      setQueueMsg(`✅ ${selectedItem.game_title} — PC unlocked for ${duration} min (${selectedItem.game_duration} min game + 3 min setup)`);
      setSelectedItem(null);
      setSelectedPcId('');
    } catch (e: any) {
      setQueueError(e?.response?.data?.error ?? e.message);
    }
  };

  const openSwapModal = (txId: string, username: string) => {
    setSwapTxId(txId);
    setSwapUsername(username);
    setSwapRemoveIds(new Set());
    setSwapNewGameId('');
    setSwapStep('select');
    setSwapExtra(0);
    setSwapMethods([]);
    setSwapPayMethod('');
    setSwapPayAmount(0);
    setSwapBusy(false);
    setSwapError('');
    setSwapOpen(true);
  };

  const swapContextItems = React.useMemo(() => {
    const seen = new Set<string>();
    return queueGames.filter(g => {
      if (g.transaction_id !== swapTxId) return false;
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });
  }, [queueGames, swapTxId]);

  const handleSwapSubmit = async () => {
    setSwapBusy(true);
    setSwapError('');
    const headers = operatorToken ? operatorHeaders : adminHeaders;
    const body: Record<string, unknown> = {
      remove_item_ids: Array.from(swapRemoveIds),
      new_game_id: swapNewGameId,
    };
    if (swapStep === 'payment') {
      body.payment_method = swapPayMethod;
      body.payment_amount = swapPayAmount;
    }
    try {
      const res = await axios.patch(
        `${BACKEND}/v1/admin/transactions/${swapTxId}/swap-game`,
        body,
        { headers }
      );
      const data = res.data?.data ?? res.data;
      if (data?.needs_payment) {
        setSwapExtra(data.extra_amount);
        setSwapMethods(data.station_methods || []);
        setSwapPayMethod(data.station_methods?.[0] || '');
        setSwapPayAmount(data.extra_amount);
        setSwapStep('payment');
      } else {
        setSwapOpen(false);
        setQueueMsg(`Game swapped successfully for ${swapUsername}.`);
        fetchQueue();
      }
    } catch (e: any) {
      setSwapError(e?.response?.data?.error ?? e?.message ?? 'Swap failed');
    } finally {
      setSwapBusy(false);
    }
  };

  const groupedQueue = React.useMemo(() => {
    const sorted = [...queueGames].sort((a, b) =>
      new Date(b.transaction_time).getTime() - new Date(a.transaction_time).getTime()
    );
    const groups: Record<string, GameItem[]> = {};
    sorted.forEach(item => {
      if (!groups[item.username]) groups[item.username] = [];
      groups[item.username].push(item);
    });
    return Object.entries(groups).sort(([, a], [, b]) =>
      new Date(b[0].transaction_time).getTime() - new Date(a[0].transaction_time).getTime()
    );
  }, [queueGames]);

  const renderQueue = () => (
    <div className="tab-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Operator Queue</h2>
        <button className="btn-secondary" onClick={fetchQueue}>↻ Refresh</button>
      </div>
      {queueError && <div className="error-banner">{queueError}</div>}
      {queueMsg  && <div className="info-banner success">{queueMsg}</div>}
      {queueLoading ? <div className="spinner">Loading queue…</div>
        : groupedQueue.length === 0
          ? <p className="no-data">No active games in the last 7 days.</p>
          : (
            <div className="customer-list">
              {groupedQueue.map(([username, games]) => (
                <div key={username} className="customer-card">
                  <div className="card-header">
                    <strong>👤 {username}</strong>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="text-muted">
                        Last order: {new Date(games[0].transaction_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: '3px 10px' }}
                        onClick={() => openSwapModal(games[0].transaction_id, username)}
                      >
                        🔄 Swap Game
                      </button>
                    </div>
                  </div>
                  <table className="queue-table">
                    <tbody>
                      {games.map(item => (
                        <tr key={`${item.id}-${item.unit_index}`}>
                          <td>
                            <strong>{item.game_title}</strong>
                            <div className="text-muted small">Unit #{item.unit_index + 1} · {item.game_duration} min</div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn-consume" onClick={() => handleConsume(item)}>
                              Verify Payment
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

      {selectedItem && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Open PC for {selectedItem.game_title}</h3>
            <p className="duration-info">
              Session: <strong>{selectedItem.game_duration} min game + 3 min setup = {(selectedItem.game_duration ?? 6) + 3} min total</strong>
            </p>
            <select
              value={selectedPcId}
              onChange={e => setSelectedPcId(e.target.value)}
              className="pc-select"
            >
              <option value="">— Select PC —</option>
              {pcs.map(pc => (
                <option key={pc.id} value={pc.id} disabled={!pc.isOnline}>
                  {pc.title}{!pc.isOnline ? ' (Offline)' : pc.isLocked ? '' : ' — already unlocked'}
                </option>
              ))}
            </select>
            {selectedPcId && (() => {
              const pc = pcs.find(p => p.id === selectedPcId);
              if (!pc) return null;
              return (
                <div className="pc-badges-row">
                  <span className={`badge ${pc.isOnline ? 'badge-green' : 'badge-red'}`}>{pc.isOnline ? 'Online' : 'Offline'}</span>
                  <span className={`badge ${pc.isLocked ? 'badge-blue' : 'badge-yellow'}`}>{pc.isLocked ? 'Locked' : 'Unlocked'}</span>
                </div>
              );
            })()}
            <div className="modal-actions">
              <button
                className="btn-primary"
                disabled={!selectedPcId || !pcs.find(p => p.id === selectedPcId)?.isOnline}
                onClick={handleOpenPc}
              >
                Open PC ({(selectedItem.game_duration ?? 6) + 3} min)
              </button>
              <button className="btn-secondary" onClick={() => { setSelectedItem(null); setSelectedPcId(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {swapOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <h3 style={{ marginTop: 0 }}>🔄 Swap Game — {swapUsername}</h3>

            {swapStep === 'select' && (
              <>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>
                  Select the game(s) to remove, then pick the replacement.
                </p>

                <h4 style={{ fontSize: 13, margin: '0 0 8px' }}>Remove from session:</h4>
                {swapContextItems.length === 0 && (
                  <p className="no-data">No unconsumed games found for this transaction.</p>
                )}
                {swapContextItems.map(item => (
                  <label key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={swapRemoveIds.has(item.id)}
                      onChange={e => {
                        setSwapRemoveIds(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(item.id);
                          else next.delete(item.id);
                          return next;
                        });
                      }}
                    />
                    <span>
                      {item.game_title}
                      <span className="text-muted" style={{ marginLeft: 8 }}>
                        ₦{Number(item.game_price || 0).toLocaleString()}
                      </span>
                    </span>
                  </label>
                ))}

                {swapRemoveIds.size > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 14px' }}>
                    Total removing: ₦{swapContextItems
                      .filter(i => swapRemoveIds.has(i.id))
                      .reduce((s, i) => s + Number(i.game_price || 0), 0)
                      .toLocaleString()}
                  </p>
                )}

                <h4 style={{ fontSize: 13, margin: '0 0 8px' }}>New game:</h4>
                <select
                  className="pc-select"
                  value={swapNewGameId}
                  onChange={e => setSwapNewGameId(e.target.value)}
                  style={{ marginBottom: 12 }}
                >
                  <option value="">— Pick replacement game —</option>
                  {games.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.title} — ₦{g.price.toLocaleString()}
                    </option>
                  ))}
                </select>

                {swapNewGameId && swapRemoveIds.size > 0 && (() => {
                  const g = games.find(x => x.id === swapNewGameId);
                  const removed = swapContextItems.filter(i => swapRemoveIds.has(i.id)).reduce((s, i) => s + Number(i.game_price || 0), 0);
                  const diff = g ? g.price - removed : 0;
                  return (
                    <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13, background: diff > 0 ? '#fef2f2' : '#ecfdf5', color: diff > 0 ? '#b91c1c' : '#047857', fontWeight: 600 }}>
                      {diff > 0 ? `Extra payment needed: ₦${diff.toLocaleString()}` : diff < 0 ? `Direct swap (₦${Math.abs(diff).toLocaleString()} credit — not refunded)` : 'Direct swap — exact price match'}
                    </div>
                  );
                })()}

                {swapError && <div className="error-banner" style={{ marginBottom: 12 }}>{swapError}</div>}

                <div className="modal-actions">
                  <button
                    className="btn-primary"
                    disabled={swapBusy || swapRemoveIds.size === 0 || !swapNewGameId}
                    onClick={handleSwapSubmit}
                  >
                    {swapBusy ? 'Processing…' : 'Swap Game'}
                  </button>
                  <button className="btn-secondary" onClick={() => setSwapOpen(false)}>Cancel</button>
                </div>
              </>
            )}

            {swapStep === 'payment' && (
              <>
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, marginBottom: 14, fontSize: 14 }}>
                  <strong style={{ color: '#b91c1c' }}>Extra payment required: ₦{swapExtra.toLocaleString()}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7c2d12' }}>
                    Collect the difference then record how it was paid below.
                  </p>
                </div>

                <select
                  className="pc-select"
                  value={swapPayMethod}
                  onChange={e => setSwapPayMethod(e.target.value)}
                  style={{ marginBottom: 10 }}
                >
                  <option value="">— Select payment method —</option>
                  {swapMethods.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                <input
                  type="number"
                  placeholder="Amount collected (₦)"
                  value={swapPayAmount || ''}
                  onChange={e => setSwapPayAmount(Number(e.target.value))}
                  style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12 }}
                  className="admin-input"
                />

                {swapError && <div className="error-banner" style={{ marginBottom: 12 }}>{swapError}</div>}

                <div className="modal-actions">
                  <button
                    className="btn-primary"
                    disabled={swapBusy || !swapPayMethod || swapPayAmount <= 0}
                    onClick={handleSwapSubmit}
                  >
                    {swapBusy ? 'Completing…' : 'Confirm Swap + Payment'}
                  </button>
                  <button className="btn-secondary" onClick={() => setSwapStep('select')}>← Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: BYPASS LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  const [bypassLogs, setBypassLogs] = useState<BypassLog[]>([]);
  const [bypassLoading, setBypassLoading] = useState(false);

  const fetchBypassLogs = useCallback(async () => {
    setBypassLoading(true);
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/bypass-logs`, { headers: adminHeaders });
      setBypassLogs(res.data);
    } catch {}
    finally { setBypassLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'bypasses') fetchBypassLogs();
  }, [activeTab, fetchBypassLogs]);

  const exportBypassCsv = () => {
    const headers = ['Admin', 'PC Name', 'PC ID', 'Timestamp', 'Created At'];
    const rows = bypassLogs.map(l => [l.admin, l.pc_name, l.pc_id, l.timestamp, l.created_at]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bypass_logs.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const renderBypassLogs = () => (
    <div className="tab-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Emergency Bypass Logs</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={fetchBypassLogs}>↻ Refresh</button>
          <button className="btn-secondary" onClick={exportBypassCsv} disabled={bypassLogs.length === 0}>⬇ Export CSV</button>
        </div>
      </div>
      {bypassLoading ? <div className="spinner">Loading…</div> : (
        bypassLogs.length === 0 ? <p className="no-data">No bypass events recorded.</p> : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>PC Name</th>
                <th>PC ID</th>
                <th>Bypass Time</th>
              </tr>
            </thead>
            <tbody>
              {bypassLogs.map(log => (
                <tr key={log.id}>
                  <td>{log.admin}</td>
                  <td>{log.pc_name || '—'}</td>
                  <td className="text-muted small">{log.pc_id || '—'}</td>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: GAMES
  // ═══════════════════════════════════════════════════════════════════════════

  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoaded, setGamesLoaded] = useState(false);
  const [updatedGameFields, setUpdatedGameFields] = useState<Record<string, Partial<Game>>>({});
  const [newGame, setNewGame] = useState<Omit<Game, 'id'>>({ title: '', price: 0, url: '', time_slot: 0 });

  const fetchGames = useCallback(async () => {
    if (gamesLoaded) return;
    try {
      const res = await axios.get<{ status: boolean; data: Game[] }>(`${BACKEND}/v1/admin/games`);
      if (res.data.status) { setGames(res.data.data); setGamesLoaded(true); }
    } catch {}
  }, [gamesLoaded]);

  useEffect(() => { if (activeTab === 'games' || activeTab === 'manual-tx' || activeTab === 'queue') fetchGames(); }, [activeTab, fetchGames]);

  const handleUpdateGame = async (id: string) => {
    const updates = updatedGameFields[id];
    if (!updates || Object.keys(updates).length === 0) return;
    try {
      await axios.put(`${BACKEND}/v1/admin/games/${id}`, updates);
      setGames(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
      setUpdatedGameFields(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e) { alert('Failed to update game'); }
  };

  const handleAddGame = async () => {
    if (!newGame.title || newGame.price <= 0 || !newGame.url || newGame.time_slot <= 0) {
      alert('Fill all fields with valid values'); return;
    }
    try {
      const res = await axios.post(`${BACKEND}/v1/admin/games`, newGame);
      setGames(prev => [...prev, res.data as Game]);
      setNewGame({ title: '', price: 0, url: '', time_slot: 0 });
    } catch { alert('Failed to add game'); }
  };

  const renderGames = () => (
    <div className="tab-section">
      <h2>Game Management</h2>
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Duration (min)</th><th>Price (₦)</th><th>URL</th><th>Action</th></tr></thead>
        <tbody>
          {games.map(game => (
            <tr key={game.id}>
              <td>
                <input type="text" defaultValue={game.title}
                  onChange={e => setUpdatedGameFields(p => ({ ...p, [game.id]: { ...p[game.id], title: e.target.value } }))} />
              </td>
              <td>
                <input type="number" defaultValue={game.time_slot}
                  onChange={e => setUpdatedGameFields(p => ({ ...p, [game.id]: { ...p[game.id], time_slot: +e.target.value } }))} />
              </td>
              <td>
                <input type="number" defaultValue={game.price}
                  onChange={e => setUpdatedGameFields(p => ({ ...p, [game.id]: { ...p[game.id], price: +e.target.value } }))} />
              </td>
              <td>
                <input type="text" defaultValue={game.url}
                  onChange={e => setUpdatedGameFields(p => ({ ...p, [game.id]: { ...p[game.id], url: e.target.value } }))} />
              </td>
              <td><button onClick={() => handleUpdateGame(game.id)}>Save</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 style={{ marginTop: 24 }}>Add New Game</h3>
      <div className="add-game-form">
        <input type="text" placeholder="Title" value={newGame.title} onChange={e => setNewGame(p => ({ ...p, title: e.target.value }))} />
        <input type="text" placeholder="URL" value={newGame.url} onChange={e => setNewGame(p => ({ ...p, url: e.target.value }))} />
        <input type="number" placeholder="Price (₦)" value={newGame.price || ''} onChange={e => setNewGame(p => ({ ...p, price: +e.target.value }))} />
        <input type="number" placeholder="Duration (min)" value={newGame.time_slot || ''} onChange={e => setNewGame(p => ({ ...p, time_slot: +e.target.value }))} />
        <button onClick={handleAddGame}>Add Game</button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: DRINKS
  // ═══════════════════════════════════════════════════════════════════════════

  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [drinksLoaded, setDrinksLoaded] = useState(false);

  const fetchDrinks = useCallback(async () => {
    if (drinksLoaded) return;
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/drinks`);
      setDrinks(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
      setDrinksLoaded(true);
    } catch {}
  }, [drinksLoaded]);

  useEffect(() => { if (activeTab === 'drinks') fetchDrinks(); }, [activeTab, fetchDrinks]);

  const drinkStatus = (stock: number) => {
    if (stock <= 0)  return <span className="badge badge-red">Out of stock</span>;
    if (stock <= 2)  return <span className="badge badge-yellow">Low</span>;
    return <span className="badge badge-green">Available</span>;
  };

  const renderDrinks = () => (
    <div className="tab-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Drink Inventory</h2>
        <button className="btn-secondary" onClick={() => { setDrinksLoaded(false); fetchDrinks(); }}>↻ Refresh</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Name</th><th>Price (₦)</th><th>Stock</th><th>Status</th></tr></thead>
        <tbody>
          {drinks.length === 0
            ? <tr><td colSpan={4} className="no-data">No drinks found.</td></tr>
            : drinks.map(d => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>₦{d.price?.toLocaleString()}</td>
                <td>{d.stock}</td>
                <td>{drinkStatus(d.stock)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: REPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  const [reports, setReports] = useState<ConsumedGameRecord[]>([]);
  const [reportSearch, setReportSearch] = useState('');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportPage, setReportPage] = useState(1);
  const REPORT_PER_PAGE = 25;

  const fetchReports = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/consume-game`);
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch {}
  }, []);

  useEffect(() => { if (activeTab === 'reports') fetchReports(); }, [activeTab, fetchReports]);

  const filteredReports = React.useMemo(() => {
    let r = reports;
    if (reportSearch) {
      const q = reportSearch.toLowerCase();
      r = r.filter(x => x.game_title?.toLowerCase().includes(q) || x.username?.toLowerCase().includes(q) || x.operator_name?.toLowerCase().includes(q));
    }
    if (reportFrom) r = r.filter(x => new Date(x.consumed_at) >= new Date(reportFrom));
    if (reportTo)   r = r.filter(x => new Date(x.consumed_at) <= new Date(reportTo));
    return r;
  }, [reports, reportSearch, reportFrom, reportTo]);

  const pagedReports = filteredReports.slice((reportPage - 1) * REPORT_PER_PAGE, reportPage * REPORT_PER_PAGE);

  const exportReportCsv = () => {
    const headers = ['Game', 'Unit', 'Customer', 'Operator', 'Consumed At'];
    const rows = filteredReports.map(r => [r.game_title, r.unit_index, r.username ?? '', r.operator_name, r.consumed_at]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'consumed_games.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const [reportSubTab, setReportSubTab] = useState<'full' | 'consumed'>('full');

  const renderReports = () => (
    <div className="tab-section">
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={`tab-btn${reportSubTab === 'full' ? ' active' : ''}`}
          onClick={() => setReportSubTab('full')}
        >📈 Full Report</button>
        <button
          className={`tab-btn${reportSubTab === 'consumed' ? ' active' : ''}`}
          onClick={() => setReportSubTab('consumed')}
        >🎮 Consumed Games</button>
      </div>

      {reportSubTab === 'full' && <Report onBack={() => { setActiveTab('overview'); window.scrollTo({ top: 0 }); }} />}

      {reportSubTab === 'consumed' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>Consumed Games Report</h2>
          <button className="btn-secondary" onClick={exportReportCsv} disabled={filteredReports.length === 0}>⬇ Export CSV</button>
        </div>
        <div className="report-filters">
          <input placeholder="Search game / customer / operator" value={reportSearch}
            onChange={e => { setReportSearch(e.target.value); setReportPage(1); }} />
          <input type="date" value={reportFrom} onChange={e => { setReportFrom(e.target.value); setReportPage(1); }} />
          <input type="date" value={reportTo}   onChange={e => { setReportTo(e.target.value);   setReportPage(1); }} />
        </div>
        <table className="admin-table">
          <thead><tr><th>Game</th><th>Unit</th><th>Customer</th><th>Operator</th><th>Consumed At</th></tr></thead>
          <tbody>
            {pagedReports.length === 0
              ? <tr><td colSpan={5} className="no-data">No records found.</td></tr>
              : pagedReports.map(r => (
                <tr key={r.id}>
                  <td>{r.game_title}</td>
                  <td>#{r.unit_index + 1}</td>
                  <td>{r.username ?? '—'}</td>
                  <td>{r.operator_name}</td>
                  <td>{new Date(r.consumed_at).toLocaleString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="pagination">
          <button disabled={reportPage === 1} onClick={() => setReportPage(p => p - 1)}>← Prev</button>
          <span>Page {reportPage} of {Math.max(1, Math.ceil(filteredReports.length / REPORT_PER_PAGE))}</span>
          <button disabled={reportPage * REPORT_PER_PAGE >= filteredReports.length} onClick={() => setReportPage(p => p + 1)}>Next →</button>
        </div>
      </>}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: ADMINS
  // ═══════════════════════════════════════════════════════════════════════════

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminLabel, setNewAdminLabel] = useState('');
  const [newAdminRoleType, setNewAdminRoleType] = useState<RoleType>('supervisor');
  const [newAdminMaxDiscount, setNewAdminMaxDiscount] = useState<string>('');
  const [newAdminPw, setNewAdminPw] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleType, setEditRoleType] = useState<RoleType>('supervisor');
  const [editLabel, setEditLabel] = useState('');
  const [editMaxDiscount, setEditMaxDiscount] = useState('');
  const [editRoleSaving, setEditRoleSaving] = useState(false);

  const fetchAdminUsers = useCallback(async () => {
    try {
      const res = await axios.get<{ status: boolean; data: AdminUser[] }>(`${BACKEND}/v1/admin/roles`);
      if (res.data.status) setAdminUsers(res.data.data);
    } catch {}
  }, []);

  useEffect(() => { if (activeTab === 'admins') fetchAdminUsers(); }, [activeTab, fetchAdminUsers]);

  const handleCreateAdmin = async () => {
    if (!newAdminName || !newAdminPw) { alert('Name and password are required'); return; }
    if (newAdminName.length < 5) { alert('Username must be at least 5 characters'); return; }
    if (newAdminPw.length < 8) { alert('Password must be at least 8 characters'); return; }
    const maxDiscount = ['supervisor', 'manager'].includes(newAdminRoleType) && newAdminMaxDiscount !== ''
      ? Number(newAdminMaxDiscount)
      : null;
    const description = encodeRoleDescription(newAdminLabel, newAdminRoleType, maxDiscount);
    try {
      await axios.post(`${BACKEND}/v1/admin/roles/create`, {
        name: newAdminName,
        description,
        password: newAdminPw,
        slug: newAdminName.toLowerCase().replace(/\s+/g, '-'),
        secret_key: uuidv4(),
        permissions: [uuidv4()],
      }, { headers: { Authorization: `Bearer ${adminToken}` } });
      alert('Admin created successfully');
      setNewAdminName(''); setNewAdminLabel(''); setNewAdminPw('');
      setNewAdminRoleType('supervisor'); setNewAdminMaxDiscount('');
      fetchAdminUsers();
    } catch (e: any) { alert(e?.response?.data?.error ?? 'Failed to create admin'); }
  };

  const handleStartEditRole = (u: AdminUser) => {
    try {
      const parsed = JSON.parse(u.description || '{}');
      setEditRoleType((parsed.role_type as RoleType) || 'supervisor');
      setEditLabel(parsed.label || '');
      setEditMaxDiscount(parsed.maxDiscount != null ? String(parsed.maxDiscount) : '');
    } catch {
      setEditRoleType('supervisor'); setEditLabel(''); setEditMaxDiscount('');
    }
    setEditingRoleId(u.id);
  };

  const handleSaveRole = async (u: AdminUser) => {
    setEditRoleSaving(true);
    const maxDiscount = ['supervisor', 'manager'].includes(editRoleType) && editMaxDiscount !== ''
      ? Number(editMaxDiscount)
      : null;
    const description = encodeRoleDescription(editLabel, editRoleType, maxDiscount);
    try {
      await axios.patch(`${BACKEND}/v1/admin/roles/${u.id}/description`,
        { description },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      setAdminUsers(prev => prev.map(a => a.id === u.id ? { ...a, description } : a));
      setEditingRoleId(null);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Failed to update role');
    } finally {
      setEditRoleSaving(false);
    }
  };

  const handleDeleteAdmin = async (id: string, description: string) => {
    const targetRole = (() => { try { return JSON.parse(description)?.role_type; } catch { return 'site_admin'; } })();
    if (targetRole === 'site_admin') { alert('Site admin accounts cannot be deleted.'); return; }
    if (!window.confirm('Delete this admin?')) return;
    try {
      await axios.delete(`${BACKEND}/v1/admin/roles/${id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
      setAdminUsers(prev => prev.filter(u => u.id !== id));
    } catch { alert('Failed to delete admin'); }
  };

  const parseUserLabel = (description: string) => {
    try { return JSON.parse(description)?.label || description; } catch { return description; }
  };

  const parseUserRole = (description: string): string => {
    try {
      const r = JSON.parse(description)?.role_type as RoleType;
      return ROLE_LABELS[r] ?? 'Site Admin';
    } catch { return 'Site Admin'; }
  };

  const renderAdmins = () => {
    if (!canManageAdmins(adminRole!)) {
      return <div className="tab-section"><p className="no-data">Access restricted.</p></div>;
    }
    const needsDiscountCap = ['supervisor', 'manager'].includes(newAdminRoleType);
    return (
      <div className="tab-section">
        <h2>Admin Management</h2>
        <h3>Add New Admin</h3>
        <div className="add-game-form">
          <input type="text" placeholder="Username" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} />
          <input type="text" placeholder="Display title (e.g. Head Cashier)" value={newAdminLabel} onChange={e => setNewAdminLabel(e.target.value)} />
          <select value={newAdminRoleType} onChange={e => setNewAdminRoleType(e.target.value as RoleType)} className="admin-select">
            <option value="site_admin">Site Admin</option>
            <option value="manager">Manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="account_audit">Account &amp; Audit</option>
            <option value="ic1">Internal Control L1</option>
            <option value="ic2">Internal Control L2</option>
          </select>
          {needsDiscountCap && (
            <input
              type="number"
              min={0}
              placeholder="Max discount amount (₦) — leave blank for unlimited"
              value={newAdminMaxDiscount}
              onChange={e => setNewAdminMaxDiscount(e.target.value)}
            />
          )}
          <input type="password" placeholder="Password (min 8 chars)" value={newAdminPw} onChange={e => setNewAdminPw(e.target.value)} />
          <button onClick={handleCreateAdmin}>Create Admin</button>
        </div>

        <table className="admin-table" style={{ marginTop: 24 }}>
          <thead><tr><th>Username</th><th>Role</th><th>Title</th><th>Actions</th></tr></thead>
          <tbody>
            {adminUsers.map(u => {
              const isSelf = u.id === adminRole?.raw?.id;
              const isEditing = editingRoleId === u.id;
              const targetIsSiteAdmin = (() => { try { return JSON.parse(u.description)?.role_type === 'site_admin'; } catch { return true; } })();
              return (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>
                    {isEditing ? (
                      <select value={editRoleType} onChange={e => setEditRoleType(e.target.value as RoleType)} style={{ fontSize: 13 }}>
                        <option value="site_admin">Site Admin</option>
                        <option value="manager">Manager</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="account_audit">Account &amp; Audit</option>
                        <option value="ic1">Internal Control L1</option>
                        <option value="ic2">Internal Control L2</option>
                      </select>
                    ) : (
                      <span className="role-badge">{parseUserRole(u.description)}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input placeholder="Display title" value={editLabel} onChange={e => setEditLabel(e.target.value)} style={{ fontSize: 13 }} />
                        {['supervisor', 'manager'].includes(editRoleType) && (
                          <input type="number" placeholder="Max discount (₦)" value={editMaxDiscount} onChange={e => setEditMaxDiscount(e.target.value)} style={{ fontSize: 13, width: 160 }} />
                        )}
                      </div>
                    ) : (
                      <span className="text-muted">{parseUserLabel(u.description)}</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {!isSelf && !targetIsSiteAdmin && (
                        isEditing ? (
                          <>
                            <button className="btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} disabled={editRoleSaving} onClick={() => handleSaveRole(u)}>
                              {editRoleSaving ? '…' : 'Save'}
                            </button>
                            <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEditingRoleId(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => handleStartEditRole(u)}>Edit Role</button>
                        )
                      )}
                      {!isSelf && (
                        <button className="btn-danger" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => handleDeleteAdmin(u.id, u.description)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: MANUAL TRANSACTION
  // ═══════════════════════════════════════════════════════════════════════════

  interface ManualCartItem {
    key: string; // local UI key
    id: string;
    title: string;
    price: number;
    quantity: number;
    gameDuration: number;
    type: 'game' | 'drink';
  }

  interface ManualPayment {
    key: string;
    method: string;
    amount: number;
  }

  const PAYMENT_METHODS_LIST = [
    'Immersia Cash', 'Immersia_Moniepoint', 'Funstation Cash', 'Funstation_Moniepoint',
    'GKG Cash', 'GKG_Moniepoint', 'Paystack', 'Transfer', 'Others',
  ];

  const [mtUsername,    setMtUsername]    = useState('');
  const [mtPhone,       setMtPhone]       = useState('');
  const [mtEmail,       setMtEmail]       = useState('');
  const [mtDiscount,    setMtDiscount]    = useState(0);
  const [mtDiscountDesc, setMtDiscountDesc] = useState('');
  const [mtCreatedAt,   setMtCreatedAt]   = useState('');
  const [mtCartItems,   setMtCartItems]   = useState<ManualCartItem[]>([]);
  const [mtPayments,    setMtPayments]    = useState<ManualPayment[]>([{ key: '1', method: 'Immersia Cash', amount: 0 }]);
  const [mtSubmitting,  setMtSubmitting]  = useState(false);
  const [mtMsg,         setMtMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [mtSuccessTx,   setMtSuccessTx]   = useState<any>(null);
  const [mtPhoneLooking, setMtPhoneLooking] = useState(false);

  const mtLookupPhone = async (phone: string) => {
    if (phone.length < 7) return;
    setMtPhoneLooking(true);
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/users/phone`, { params: { phone }, headers: adminHeaders });
      const user = res.data?.data ?? res.data;
      if (user?.username) { setMtUsername(user.username); }
      if (user?.email)    { setMtEmail(user.email); }
    } catch {
      // user not found — leave fields blank for manual entry
    } finally {
      setMtPhoneLooking(false);
    }
  };

  // Game/drink picker state
  const [mtItemType,     setMtItemType]     = useState<'game' | 'drink'>('game');
  const [mtSelectedGame, setMtSelectedGame] = useState('');
  const [mtCustomTitle,  setMtCustomTitle]  = useState('');
  const [mtItemPrice,    setMtItemPrice]    = useState(0);
  const [mtItemQty,      setMtItemQty]      = useState(1);
  const [mtItemDuration, setMtItemDuration] = useState(6);

  const mtTotalItems = mtCartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const mtTotalPaid  = mtPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const mtFinal      = Math.max(0, mtTotalItems - mtDiscount);

  const mtAddItem = () => {
    const title = mtItemType === 'game' && mtSelectedGame
      ? (games.find(g => g.id === mtSelectedGame)?.title ?? mtCustomTitle)
      : mtCustomTitle;
    if (!title || mtItemPrice <= 0 || mtItemQty <= 0) {
      setMtMsg({ ok: false, text: 'Fill item title, price and quantity.' });
      return;
    }
    setMtCartItems(prev => [...prev, {
      key: Date.now().toString(),
      id: mtSelectedGame || Date.now().toString(),
      title,
      price: mtItemPrice,
      quantity: mtItemQty,
      gameDuration: mtItemDuration,
      type: mtItemType,
    }]);
    setMtSelectedGame(''); setMtCustomTitle(''); setMtItemPrice(0); setMtItemQty(1); setMtItemDuration(6);
    setMtMsg(null);
  };

  const mtRemoveItem = (key: string) => setMtCartItems(prev => prev.filter(i => i.key !== key));

  const mtAddPayment = () => setMtPayments(prev => [...prev, { key: Date.now().toString(), method: 'Immersia Cash', amount: 0 }]);
  const mtRemovePayment = (key: string) => setMtPayments(prev => prev.filter(p => p.key !== key));

  const mtReset = () => {
    setMtUsername(''); setMtPhone(''); setMtEmail('');
    setMtDiscount(0); setMtDiscountDesc(''); setMtCreatedAt('');
    setMtCartItems([]); setMtPayments([{ key: '1', method: 'Immersia Cash', amount: 0 }]);
    setMtMsg(null); setMtSuccessTx(null);
  };

  const mtSubmit = async () => {
    if (!mtUsername || !mtPhone) { setMtMsg({ ok: false, text: 'Username and phone are required.' }); return; }
    if (mtCartItems.length === 0) { setMtMsg({ ok: false, text: 'Add at least one item.' }); return; }
    if (mtPayments.every(p => !p.amount)) { setMtMsg({ ok: false, text: 'Enter at least one payment amount.' }); return; }

    setMtSubmitting(true);
    setMtMsg(null);
    const headers = operatorToken ? operatorHeaders : adminHeaders;
    try {
      const res = await axios.post(`${BACKEND}/v1/admin/transactions/manual`, {
        username: mtUsername,
        phone: mtPhone,
        email: mtEmail || undefined,
        discount: mtDiscount,
        discount_description: mtDiscountDesc,
        created_at: mtCreatedAt || undefined,
        payment_methods: mtPayments.map(p => ({ method: p.method, amount: Number(p.amount) })),
        cartItems: mtCartItems.map(i => ({
          id: i.id,
          title: i.title,
          price: i.price,
          quantity: i.quantity,
          gameDuration: i.gameDuration,
          type: i.type,
        })),
      }, { headers });

      const tx = res.data?.data?.data ?? res.data?.data ?? res.data;
      setMtSuccessTx(tx);
      setMtMsg({ ok: true, text: `Transaction recorded — ID: ${tx?.transaction_id ?? 'saved'}` });
      setMtCartItems([]); setMtPayments([{ key: '1', method: 'Immersia Cash', amount: 0 }]);
      setMtUsername(''); setMtPhone(''); setMtEmail('');
      setMtDiscount(0); setMtDiscountDesc(''); setMtCreatedAt('');
    } catch (e: any) {
      setMtMsg({ ok: false, text: e?.response?.data?.error ?? e.message ?? 'Failed to record transaction.' });
    } finally {
      setMtSubmitting(false);
    }
  };

  const renderManualTransaction = () => (
    <div className="tab-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Manual Transaction Entry</h2>
        <button className="btn-secondary" onClick={mtReset}>↺ Reset form</button>
      </div>

      {mtMsg && (
        <div className={mtMsg.ok ? 'info-banner success' : 'error-banner'} style={{ marginBottom: 16 }}>
          {mtMsg.text}
        </div>
      )}

      {/* ── Customer ── */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ flex: '1 1 140px', position: 'relative' }}>
            <input
              placeholder="Phone *"
              value={mtPhone}
              onChange={e => { setMtPhone(e.target.value); setMtUsername(''); setMtEmail(''); }}
              onBlur={e => mtLookupPhone(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', paddingRight: mtPhoneLooking ? 28 : undefined }}
            />
            {mtPhoneLooking && (
              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)' }}>…</span>
            )}
          </div>
          <input placeholder="Username *" value={mtUsername} onChange={e => setMtUsername(e.target.value)} style={{ flex: '1 1 180px' }} />
          <input placeholder="Email (optional)" value={mtEmail} onChange={e => setMtEmail(e.target.value)} style={{ flex: '1 1 200px' }} />
          <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>Backdate (leave blank for now)</label>
            <input type="datetime-local" value={mtCreatedAt} onChange={e => setMtCreatedAt(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Add Item ── */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add Item</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <select value={mtItemType} onChange={e => { setMtItemType(e.target.value as 'game' | 'drink'); setMtSelectedGame(''); setMtCustomTitle(''); }} style={{ flex: '0 0 100px' }}>
            <option value="game">Game</option>
            <option value="drink">Drink</option>
          </select>

          {mtItemType === 'game' && games.length > 0 ? (
            <select value={mtSelectedGame} onChange={e => {
              setMtSelectedGame(e.target.value);
              const g = games.find(x => x.id === e.target.value);
              if (g) { setMtItemPrice(g.price); setMtItemDuration(g.time_slot); }
            }} style={{ flex: '1 1 200px' }}>
              <option value="">— Pick game —</option>
              {games.map(g => <option key={g.id} value={g.id}>{g.title} (₦{g.price.toLocaleString()})</option>)}
            </select>
          ) : (
            <input placeholder={mtItemType === 'drink' ? 'Drink name' : 'Game title'} value={mtCustomTitle} onChange={e => setMtCustomTitle(e.target.value)} style={{ flex: '1 1 180px' }} />
          )}

          <input type="number" placeholder="Price (₦)" value={mtItemPrice || ''} onChange={e => setMtItemPrice(Number(e.target.value))} style={{ flex: '0 0 110px' }} />
          <input type="number" placeholder="Qty" min={1} value={mtItemQty || ''} onChange={e => setMtItemQty(Number(e.target.value))} style={{ flex: '0 0 70px' }} />
          {mtItemType === 'game' && (
            <input type="number" placeholder="Duration (min)" min={1} value={mtItemDuration || ''} onChange={e => setMtItemDuration(Number(e.target.value))} style={{ flex: '0 0 130px' }} />
          )}
          <button className="btn-primary" onClick={mtAddItem}>+ Add</button>
        </div>

        {mtCartItems.length > 0 && (
          <table className="admin-table" style={{ marginTop: 14 }}>
            <thead>
              <tr><th>Item</th><th>Type</th><th>Price</th><th>Qty</th><th>Duration</th><th>Subtotal</th><th></th></tr>
            </thead>
            <tbody>
              {mtCartItems.map(item => (
                <tr key={item.key}>
                  <td>{item.title}</td>
                  <td><span className={`badge ${item.type === 'game' ? 'badge-blue' : 'badge-yellow'}`}>{item.type}</span></td>
                  <td>₦{item.price.toLocaleString()}</td>
                  <td>{item.quantity}</td>
                  <td>{item.type === 'game' ? `${item.gameDuration} min` : '—'}</td>
                  <td style={{ fontWeight: 600 }}>₦{(item.price * item.quantity).toLocaleString()}</td>
                  <td><button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => mtRemoveItem(item.key)}>✕</button></td>
                </tr>
              ))}
              <tr style={{ background: '#f0f7ff' }}>
                <td colSpan={5} style={{ fontWeight: 700, textAlign: 'right', paddingRight: 16 }}>Items total</td>
                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₦{mtTotalItems.toLocaleString()}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ── Discount ── */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discount</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <input type="number" placeholder="Discount (₦)" min={0} value={mtDiscount || ''} onChange={e => setMtDiscount(Number(e.target.value))} style={{ flex: '0 0 150px' }} />
          <input placeholder="Reason (e.g. Promo)" value={mtDiscountDesc} onChange={e => setMtDiscountDesc(e.target.value)} style={{ flex: '1 1 240px' }} />
        </div>
      </div>

      {/* ── Payments ── */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payments</h3>
          <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={mtAddPayment}>+ Split payment</button>
        </div>
        {mtPayments.map((p, idx) => (
          <div key={p.key} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <select value={p.method} onChange={e => setMtPayments(prev => prev.map(x => x.key === p.key ? { ...x, method: e.target.value } : x))} style={{ flex: '1 1 180px' }}>
              {PAYMENT_METHODS_LIST.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="number" placeholder="Amount (₦)" value={p.amount || ''} onChange={e => setMtPayments(prev => prev.map(x => x.key === p.key ? { ...x, amount: Number(e.target.value) } : x))} style={{ flex: '0 0 140px' }} />
            {mtPayments.length > 1 && (
              <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => mtRemovePayment(p.key)}>✕</button>
            )}
          </div>
        ))}

        {/* Summary row */}
        <div style={{ marginTop: 12, padding: '10px 12px', background: '#f0f7ff', borderRadius: 8, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14 }}>
          <span>Items: <strong>₦{mtTotalItems.toLocaleString()}</strong></span>
          {mtDiscount > 0 && <span style={{ color: 'var(--danger)' }}>Discount: <strong>−₦{mtDiscount.toLocaleString()}</strong></span>}
          <span>Payable: <strong style={{ color: 'var(--primary)' }}>₦{mtFinal.toLocaleString()}</strong></span>
          <span style={{ color: mtTotalPaid >= mtFinal ? 'var(--success)' : 'var(--danger)' }}>
            Paid: <strong>₦{mtTotalPaid.toLocaleString()}</strong>
            {mtTotalPaid < mtFinal && <span> (short by ₦{(mtFinal - mtTotalPaid).toLocaleString()})</span>}
            {mtTotalPaid > mtFinal && <span> (over by ₦{(mtTotalPaid - mtFinal).toLocaleString()})</span>}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn-primary"
          onClick={mtSubmit}
          disabled={mtSubmitting || mtCartItems.length === 0 || !mtUsername || !mtPhone}
          style={{ minWidth: 180, fontSize: 15, padding: '10px 24px' }}
        >
          {mtSubmitting ? 'Saving…' : '✓ Record Transaction'}
        </button>
        <button className="btn-secondary" onClick={mtReset}>Clear</button>
      </div>

      {/* ── Success receipt ── */}
      {mtSuccessTx && (
        <div style={{ marginTop: 20, background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 10px', color: '#065f46' }}>Transaction Recorded</h3>
          <div style={{ fontSize: 13, color: '#047857', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>ID: <strong>{mtSuccessTx.transaction_id}</strong></span>
            <span>Customer: <strong>{mtSuccessTx.username}</strong> · {mtSuccessTx.phone}</span>
            <span>Total: <strong>₦{Number(mtSuccessTx.total_amount || 0).toLocaleString()}</strong></span>
            {mtSuccessTx.created_at && <span>Date: {new Date(mtSuccessTx.created_at).toLocaleString()}</span>}
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':  return renderOverview();
      case 'pc':        return renderPcControl();
      case 'queue':     return renderQueue();
      case 'bypasses':  return renderBypassLogs();
      case 'games':     return renderGames();
      case 'drinks':    return renderDrinks();
      case 'reports':   return renderReports();
      case 'admins':    return renderAdmins();
      case 'manual-tx': return renderManualTransaction();
      case 'ic-entry': return <InternalControlEntry />;
      case 'ic-dashboard': return <InternalControlDashboard />;
      case 'tennis': return (
        <div>
          <TennisScoreEntry />
          <div style={{ padding: '0 24px 20px', maxWidth: 900, margin: '0 auto' }}>
            <a
              href="/TennisLive"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1d6ef2', fontWeight: 600, textDecoration: 'none' }}
            >
              🔗 Open customer live-score display →
            </a>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-hero">
        <div>
          <h1>Immersia Admin Console</h1>
          <p>
            {adminRole ? (
              <>
                Logged in as <strong>{adminRole.raw.name}</strong>
                {' · '}
                <span className="role-badge role-badge--{adminRole.roleType}">
                  {ROLE_LABELS[adminRole.roleType]}
                </span>
              </>
            ) : 'PCs · Operator Queue · Games · Reports — all in one place.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => { setShowChangePw(true); setCpMsg(null); }}>
            🔑 Change Password
          </button>
          <button className="btn-danger" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <nav className="tab-nav">
        {visibleTabs.map(({ key, label }) => (
          <button
            key={key}
            className={`tab-btn${activeTab === key ? ' active' : ''}`}
            onClick={() => { setActiveTab(key as Tab); window.scrollTo({ top: 0 }); }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {renderTab()}
      </div>

      {/* ── Change Password Modal ── */}
      {showChangePw && (
        <div className="modal-overlay" onClick={() => setShowChangePw(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3>Change Password</h3>
            {cpMsg && (
              <div className={cpMsg.ok ? 'info-banner success' : 'error-banner'} style={{ marginBottom: 12 }}>
                {cpMsg.text}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="password"
                placeholder="Current password"
                value={cpCurrent}
                onChange={e => setCpCurrent(e.target.value)}
                className="admin-input"
              />
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={cpNew}
                onChange={e => setCpNew(e.target.value)}
                className="admin-input"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={cpConfirm}
                onChange={e => setCpConfirm(e.target.value)}
                className="admin-input"
              />
            </div>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn-primary" onClick={handleChangePassword} disabled={cpBusy}>
                {cpBusy ? 'Saving…' : 'Change Password'}
              </button>
              <button className="btn-secondary" onClick={() => setShowChangePw(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
