import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Report from '../report';
import './Admin.css';
import {
  getAdminRole,
  getPermittedTabs,
  canManageAdmins,
  canGiveDiscount,
  getMaxDiscount,
  encodeRoleDescription,
  ROLE_LABELS,
  type RoleType,
  type AdminTab,
  type ParsedAdminRole,
} from '../../utils/adminPermissions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'pc' | 'queue' | 'bypasses' | 'games' | 'drinks' | 'reports' | 'admins';

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
  username: string;
  game_quantity: number;
  transaction_time: string;
  unit_index: number;
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
  { key: 'pc',       label: '🖥  PC Control'     },
  { key: 'queue',    label: '🎮  Operator Queue'  },
  { key: 'bypasses', label: '🔑  Bypass Logs'     },
  { key: 'games',    label: '🕹  Games'           },
  { key: 'drinks',   label: '🥤  Drinks'          },
  { key: 'reports',  label: '📊  Reports'         },
  { key: 'admins',   label: '👤  Admins'          },
];

// ─── Component ────────────────────────────────────────────────────────────────

const Admin: React.FC = () => {
  const navigate = useNavigate();

  // ── Role / permissions ──────────────────────────────────────────────────────
  const adminRole: ParsedAdminRole | null = React.useMemo(() => getAdminRole(), []);
  const permittedTabs = React.useMemo(
    () => (adminRole ? getPermittedTabs(adminRole) : (['reports'] as AdminTab[])),
    [adminRole]
  );
  const visibleTabs = ALL_TABS.filter(t => permittedTabs.includes(t.key as AdminTab));
  const firstTab = (permittedTabs[0] ?? 'reports') as Tab;

  const [activeTab, setActiveTab] = useState<Tab>(firstTab);

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

  // ── Shared PC list (fed by WebSocket) ──────────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null);
  const [pcs, setPcs] = useState<PcRow[]>([]);

  // ── WebSocket connection (PC Control + Operator Queue both use it) ──────────
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        const u = new URL(BACKEND);
        u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(u.origin);
      } catch {
        ws = new WebSocket('ws://127.0.0.1:2024');
      }
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'register_dashboard' }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === 'pcs-sync' && Array.isArray(msg.pcs)) {
            setPcs(msg.pcs.map((pc: any) => ({
              id: String(pc.id),
              title: String(pc.title),
              isLocked: pc.isLocked ?? pc.status === 'locked',
              isOnline: pc.isOnline ?? false,
              busyUntil: pc.busyUntil ?? null,
            })));
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
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    navigate('/');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: PC CONTROL
  // ═══════════════════════════════════════════════════════════════════════════

  const [pcUnlockMins, setPcUnlockMins] = useState<Record<string, string>>({});
  const [pcMsg, setPcMsg] = useState('');

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

  const renderPcControl = () => (
    <div className="tab-section">
      <h2>PC Control</h2>
      {pcMsg && <div className="info-banner">{pcMsg}</div>}
      <div className="pc-grid">
        {pcs.length === 0 && <p className="no-data">No PCs connected yet.</p>}
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

  const fetchQueue = useCallback(async () => {
    if (!operatorToken) return;
    setQueueLoading(true);
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/consumed-game`, { headers: operatorHeaders });
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
    try {
      await axios.post(
        `${BACKEND}/v1/admin/consumed-game/consume`,
        { transactionItemId: item.id, unit_index: item.unit_index, game_title: item.game_title },
        { headers: operatorHeaders }
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
    try {
      await axios.post(
        `${BACKEND}/v1/admin/pcs/${encodeURIComponent(selectedPcId)}/unlock`,
        { duration_minutes: duration, transactionItemId: selectedItem.id, unit_index: selectedItem.unit_index },
        { headers: operatorHeaders }
      );
      setQueueMsg(`✅ ${selectedItem.game_title} — PC unlocked for ${duration} min (${selectedItem.game_duration} min game + 3 min setup)`);
      setSelectedItem(null);
      setSelectedPcId('');
    } catch (e: any) {
      setQueueError(e?.response?.data?.error ?? e.message);
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
      {!operatorToken && (
        <div className="info-banner warning">
          Operator token not found. <button className="btn-link" onClick={() => navigate('/OperatorAuth')}>Log in as Operator</button>
        </div>
      )}
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
                    <span className="text-muted">
                      Last order: {new Date(games[0].transaction_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
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

  useEffect(() => { if (activeTab === 'games') fetchGames(); }, [activeTab, fetchGames]);

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

      {reportSubTab === 'full' && <Report />}

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
          <thead><tr><th>Username</th><th>Role</th><th>Title</th><th>Action</th></tr></thead>
          <tbody>
            {adminUsers.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td><span className="role-badge">{parseUserRole(u.description)}</span></td>
                <td className="text-muted">{parseUserLabel(u.description)}</td>
                <td>
                  {u.id !== adminRole?.raw?.id && (
                    <button className="btn-danger" onClick={() => handleDeleteAdmin(u.id, u.description)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const renderTab = () => {
    switch (activeTab) {
      case 'pc':       return renderPcControl();
      case 'queue':    return renderQueue();
      case 'bypasses': return renderBypassLogs();
      case 'games':    return renderGames();
      case 'drinks':   return renderDrinks();
      case 'reports':  return renderReports();
      case 'admins':   return renderAdmins();
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
            onClick={() => setActiveTab(key as Tab)}
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
