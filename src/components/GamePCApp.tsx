import React, { useEffect, useRef, useState, useCallback } from 'react';
import PcLockScreen from './PcLockScreen';
import { loadPcConfig, savePcConfig, clearPcConfig, PcConfig } from './utils/loadPcConfig';

const BACKEND_RAW = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:2024').replace(/\/+$/, '');
const WS_URL      = BACKEND_RAW.replace(/^http/, 'ws') + '/ws';

const PING_EVERY_MS  = 30_000;
const RECONNECT_MS   = 3_000;

// ── Setup screen shown when no pc_id is saved ─────────────────
const SetupScreen: React.FC<{ onSave: (cfg: PcConfig) => void }> = ({ onSave }) => {
  const [pcId,   setPcId]   = useState('');
  const [pcName, setPcName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pcId.trim()) return;
    const cfg: PcConfig = { pc_id: pcId.trim(), pc_name: pcName.trim() || pcId.trim() };
    savePcConfig(cfg);
    onSave(cfg);
  };

  return (
    <div style={styles.setup}>
      <h1 style={styles.setupTitle}>🖥️ PC Setup</h1>
      <p style={styles.setupSub}>Configure this PC's identity so the admin can control it remotely.</p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>PC ID (unique, e.g. "pc-01")</label>
        <input
          style={styles.input}
          value={pcId}
          onChange={e => setPcId(e.target.value)}
          placeholder="pc-01"
          required
          autoFocus
        />
        <label style={styles.label}>Display Name (e.g. "Gaming PC 1")</label>
        <input
          style={styles.input}
          value={pcName}
          onChange={e => setPcName(e.target.value)}
          placeholder="Gaming PC 1"
        />
        <button type="submit" style={styles.button}>Save & Connect</button>
      </form>
    </div>
  );
};

// ── Main PC app ────────────────────────────────────────────────
const GamePCApp: React.FC = () => {
  const [config, setConfig]     = useState<PcConfig | null>(() => loadPcConfig());
  const [locked, setLocked]     = useState(true);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  const wsRef         = useRef<WebSocket | null>(null);
  const pingTimer     = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef     = useRef<PcConfig | null>(config);

  useEffect(() => { configRef.current = config; }, [config]);

  const clearCountdown = useCallback(() => {
    if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
    setMinutesLeft(null);
  }, []);

  const startCountdown = useCallback((minutes: number) => {
    clearCountdown();
    const endsAt = Date.now() + minutes * 60 * 1000;
    const tick = () => {
      const rem = Math.max(0, Math.ceil((endsAt - Date.now()) / 60000));
      setMinutesLeft(rem);
      if (rem <= 0) { clearCountdown(); setLocked(true); }
    };
    tick();
    countdownTimer.current = setInterval(tick, 10_000);
  }, [clearCountdown]);

  const connect = useCallback(() => {
    const cfg = configRef.current;
    if (!cfg) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'register', pc_id: cfg.pc_id, pc_name: cfg.pc_name }));

      if (pingTimer.current) clearInterval(pingTimer.current);
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, PING_EVERY_MS);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'lock') {
          setLocked(true);
          clearCountdown();
        }
        if (msg.type === 'unlock') {
          const mins = typeof msg.duration_minutes === 'number' ? msg.duration_minutes : 60;
          setLocked(false);
          startCountdown(mins);
        }
      } catch {}
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      setConnected(false);
      if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
      reconnectTimer.current = setTimeout(connect, RECONNECT_MS);
    };
  }, [clearCountdown, startCountdown]);

  useEffect(() => {
    if (!config) return;
    connect();
    return () => {
      if (wsRef.current)        { wsRef.current.onclose = null; wsRef.current.close(); }
      if (pingTimer.current)    clearInterval(pingTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [config, connect]);

  if (!config) {
    return <SetupScreen onSave={cfg => setConfig(cfg)} />;
  }

  if (locked) return <PcLockScreen />;

  return (
    <div style={styles.playing}>
      <div style={styles.playingInner}>
        <div style={styles.playingTitle}>🎮 Gaming Session Active</div>
        {minutesLeft !== null && (
          <div style={styles.timer}>
            {minutesLeft > 0
              ? `⏱ ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} remaining`
              : 'Time up — locking soon…'}
          </div>
        )}
        <div style={styles.connDot}>
          {connected
            ? <span style={{ color: '#22c55e' }}>● Connected</span>
            : <span style={{ color: '#f87171' }}>● Reconnecting…</span>}
        </div>
        <button
          style={styles.resetBtn}
          onClick={() => { clearPcConfig(); setConfig(null); }}
        >
          ⚙ Reconfigure PC
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  setup: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif', padding: 24,
  },
  setupTitle: { fontSize: 32, margin: '0 0 8px', fontWeight: 700 },
  setupSub:   { fontSize: 14, color: '#94a3b8', margin: '0 0 32px', textAlign: 'center', maxWidth: 360 },
  form:       { display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 340 },
  label:      { fontSize: 13, color: '#94a3b8', fontWeight: 600 },
  input: {
    padding: '10px 14px', borderRadius: 8, border: '1px solid #334155',
    background: '#1e293b', color: '#f8fafc', fontSize: 15,
  },
  button: {
    marginTop: 8, padding: '12px 0', borderRadius: 8, border: 'none',
    background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
  },
  playing: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif',
  },
  playingInner: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
  playingTitle: { fontSize: 36, fontWeight: 700 },
  timer:        { fontSize: 20, color: '#86efac', fontWeight: 600 },
  connDot:      { fontSize: 13 },
  resetBtn: {
    marginTop: 24, padding: '8px 18px', borderRadius: 8, border: '1px solid #334155',
    background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
  },
};

export default GamePCApp;
