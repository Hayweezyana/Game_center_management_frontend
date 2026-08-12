import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Tennis.css';

const BACKEND = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:2024').replace(/\/+$/, '');

type PlayerKey = 'player1' | 'player2';

interface PointEvent {
  id: string;
  player: PlayerKey;
  ts: number;
  source?: string;
  undone?: boolean;
}

interface ServiceState {
  first_server: PlayerKey;
  server: PlayerKey;
  next_server: PlayerKey;
  serves_taken_this_turn: number;
  serves_until_switch: number;
  total_serves: number;
}

interface SetsSummary {
  series_id: string;
  set_number: number;
  player1_sets_won: number;
  player2_sets_won: number;
  sets_played: number;
  sets: Array<{
    set_number: number;
    player1_score: number;
    player2_score: number;
    winner: string | null;
    is_draw: boolean;
    status: 'active' | 'ended';
  }>;
}

interface TennisMatch {
  id: string;
  player1_name: string;
  player2_name: string;
  player1_score: number;
  player2_score: number;
  game_type: 11 | 21;
  status: 'active' | 'ended';
  winner: string | null;
  is_deuce: boolean;
  is_draw: boolean;
  phase: 'main' | 'tb7' | 'tb5';
  score_history: PointEvent[];
  phase_history: Array<{ phase: string; player1_score: number; player2_score: number }>;
  series_id?: string;
  set_number?: number;
  first_server?: PlayerKey;
  service?: ServiceState;
  sets?: SetsSummary;
  created_at?: string;
}

/** Undone points remain in the log as tombstones — filter them for display. */
const livePoints = (history?: PointEvent[]): PointEvent[] =>
  (history ?? []).filter((e) => !e.undone);

/**
 * Client-generated id so a retried or duplicated request scores the point once.
 * The backend keys idempotency on this.
 */
const newEventId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const PHASE_LABELS: Record<string, string> = {
  main: 'Main Game',
  tb7: 'Tiebreak · 7pt',
  tb5: 'Tiebreak · 5pt',
};

const PHASE_SHORT: Record<string, string> = {
  main: '',
  tb7: 'TB·7PT',
  tb5: 'TB·5PT',
};

const TennisScoreEntry: React.FC = () => {
  const [match, setMatch] = useState<TennisMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recentMatches, setRecentMatches] = useState<TennisMatch[]>([]);

  const [p1Name, setP1Name] = useState('Player 1');
  const [p2Name, setP2Name] = useState('Player 2');
  const [gameType, setGameType] = useState<11 | 21>(11);
  const [showSetup, setShowSetup] = useState(false);
  const [firstServer, setFirstServer] = useState<PlayerKey>('player1');
  // Off by default: a rematch between the same two players continues the series
  // as the next set. Tick this to break that and start a fresh series.
  const [newSeries, setNewSeries] = useState(false);

  const getHeaders = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('operatorToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchLive = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/tennis/match/live`, { headers: getHeaders() });
      setMatch(res.data?.data ?? null);
    } catch {
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecent = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/tennis/matches`, { headers: getHeaders() });
      setRecentMatches(res.data?.data ?? []);
    } catch {
      setRecentMatches([]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLive();
    fetchRecent();
  }, [fetchLive, fetchRecent]);

  const handleStartMatch = async () => {
    if (!p1Name.trim() || !p2Name.trim()) { setError('Both player names are required.'); return; }
    setBusy(true); setError('');
    try {
      const res = await axios.post(
        `${BACKEND}/v1/admin/tennis/match`,
        {
          player1_name: p1Name.trim(),
          player2_name: p2Name.trim(),
          game_type: gameType,
          first_server: firstServer,
          new_series: newSeries,
        },
        { headers: getHeaders() }
      );
      setMatch(res.data?.data);
      setShowSetup(false);
      fetchRecent();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to start match');
    } finally {
      setBusy(false);
    }
  };

  const handlePoint = async (player: 'player1' | 'player2') => {
    if (!match || match.status === 'ended' || busy) return;
    setBusy(true);
    const prev = match;
    // Optimistic update — show +1 immediately
    setMatch({
      ...match,
      player1_score: match.player1_score + (player === 'player1' ? 1 : 0),
      player2_score: match.player2_score + (player === 'player2' ? 1 : 0),
    });
    try {
      const res = await axios.post(
        `${BACKEND}/v1/admin/tennis/match/${match.id}/point`,
        { player, event_id: newEventId(), ts: Date.now() },
        { headers: getHeaders() }
      );
      setMatch(res.data?.data);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to record point');
      setMatch(prev);
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!match || busy) return;
    setBusy(true);
    try {
      const res = await axios.post(
        `${BACKEND}/v1/admin/tennis/match/${match.id}/undo`,
        {},
        { headers: getHeaders() }
      );
      setMatch(res.data?.data);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Nothing to undo');
    } finally {
      setBusy(false);
    }
  };

  const handleEndMatch = async () => {
    if (!match || busy) return;
    if (!window.confirm('End this match now?')) return;
    setBusy(true);
    try {
      const res = await axios.post(
        `${BACKEND}/v1/admin/tennis/match/${match.id}/end`,
        {},
        { headers: getHeaders() }
      );
      setMatch(res.data?.data);
      fetchRecent();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to end match');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Next set of the same series — same players, same game type, service handed
   * to the other side. Saves re-entering names for every game of a session.
   */
  const handleNextSet = async () => {
    if (!match || busy) return;
    setBusy(true); setError('');
    try {
      const res = await axios.post(
        `${BACKEND}/v1/admin/tennis/match/${match.id}/next-set`,
        {},
        { headers: getHeaders() }
      );
      setMatch(res.data?.data);
      setShowSetup(false);
      fetchRecent();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to start next set');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="ts-shell">
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>
      </div>
    );
  }

  const isEnded = match?.status === 'ended';
  const hasActiveMatch = match && !isEnded;
  const phase = match?.phase ?? 'main';
  const service = match?.service;
  const sets = match?.sets;
  const isSeries = (sets?.sets.length ?? 0) > 1;
  const serverName =
    service && match
      ? (service.server === 'player1' ? match.player1_name : match.player2_name)
      : null;

  const centerLabel = () => {
    if (isEnded) return 'ENDED';
    if (phase !== 'main') return PHASE_SHORT[phase];
    return `${match?.game_type ?? 11}PT`;
  };

  return (
    <div className="ts-shell">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#13233f' }}>🏓 Table Tennis Score</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Record points live — customers see the score in real time.
          </p>
        </div>
        <button
          className="ts-ctrl-btn new-game"
          onClick={() => { setShowSetup(s => !s); setError(''); }}
        >
          {showSetup ? '✕ Cancel' : hasActiveMatch ? '↺ New Match' : '+ New Match'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* Setup Card */}
      {(showSetup || (!hasActiveMatch && !isEnded)) && (
        <div className="ts-setup-card">
          <h2><span>🏓</span>{hasActiveMatch ? 'Start New Match' : 'Set Up Match'}</h2>
          <div className="ts-type-row">
            {([11, 21] as const).map(t => (
              <button key={t} className={`ts-type-btn${gameType === t ? ' active' : ''}`} onClick={() => setGameType(t)}>
                {t}-Point Game
              </button>
            ))}
          </div>
          <div className="ts-players-row">
            <input
              className="ts-player-input p1"
              placeholder="Player 1 name"
              value={p1Name}
              onChange={e => setP1Name(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStartMatch()}
            />
            <div className="ts-vs-badge">VS</div>
            <input
              className="ts-player-input p2"
              placeholder="Player 2 name"
              value={p2Name}
              onChange={e => setP2Name(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStartMatch()}
            />
          </div>

          {/* Who serves first — shown on the display and used to derive the
              rotation, which changes hands every 5 services. */}
          <div className="ts-server-picker">
            <span className="ts-server-picker-label">First to serve</span>
            <div className="ts-server-options">
              <button
                className={`ts-server-btn p1${firstServer === 'player1' ? ' active' : ''}`}
                onClick={() => setFirstServer('player1')}
              >
                🏓 {p1Name.trim() || 'Player 1'}
              </button>
              <button
                className={`ts-server-btn p2${firstServer === 'player2' ? ' active' : ''}`}
                onClick={() => setFirstServer('player2')}
              >
                🏓 {p2Name.trim() || 'Player 2'}
              </button>
            </div>
          </div>

          <label className="ts-series-toggle">
            <input
              type="checkbox"
              checked={newSeries}
              onChange={e => setNewSeries(e.target.checked)}
            />
            <span>
              Start a fresh series
              <em>
                Leave unticked to keep scoring against the same pair as the next set.
              </em>
            </span>
          </label>

          <button className="ts-start-btn" onClick={handleStartMatch} disabled={busy}>
            {busy ? 'Starting…' : `Start ${gameType}-Point ${newSeries ? 'Match' : 'Set'}`}
          </button>
        </div>
      )}

      {/* Active Game Arena */}
      {match && (
        <div className="ts-arena">
          {/* Set + service strip */}
          <div className="ts-set-strip">
            {sets && (
              <span className="ts-set-badge">
                Set {sets.set_number}
                {isSeries && (
                  <span className="ts-set-tally">
                    &nbsp;·&nbsp; sets {sets.player1_sets_won} – {sets.player2_sets_won}
                  </span>
                )}
              </span>
            )}
            {service && !isEnded && (
              <span className="ts-serve-badge">
                🏓 <b>{serverName}</b> to serve
                <span className="ts-serve-count">
                  {service.serves_until_switch} of 5 left
                </span>
              </span>
            )}
          </div>

          {/* Score header */}
          <div className="ts-score-header">
            <div
              className={[
                'ts-player-side p1',
                match.winner === match.player1_name ? 'winner' : '',
                service?.server === 'player1' && !isEnded ? 'serving' : '',
              ].join(' ')}
            >
              {match.winner === match.player1_name && <span className="ts-winner-crown">👑</span>}
              <span className="ts-player-icon">🏓</span>
              <span className="ts-player-name">
                {match.player1_name}
                {service?.first_server === 'player1' && (
                  <span className="ts-first-server" title="Served first this set">1st</span>
                )}
              </span>
              {isSeries && sets && (
                <span className="ts-player-sets">{sets.player1_sets_won} {sets.player1_sets_won === 1 ? 'set' : 'sets'}</span>
              )}
              <span className="ts-player-score">{match.player1_score}</span>
              {service?.server === 'player1' && !isEnded && (
                <span className="ts-serving-dot">● serving</span>
              )}
            </div>

            <div className="ts-score-center">
              <span className="ts-score-sep">:</span>
              <span className="ts-status-pill">{centerLabel()}</span>
              {phase !== 'main' && !isEnded && (
                <span className="ts-phase-badge">{PHASE_LABELS[phase]}</span>
              )}
            </div>

            <div
              className={[
                'ts-player-side p2',
                match.winner === match.player2_name ? 'winner' : '',
                service?.server === 'player2' && !isEnded ? 'serving' : '',
              ].join(' ')}
            >
              {match.winner === match.player2_name && <span className="ts-winner-crown">👑</span>}
              <span className="ts-player-icon" style={{ transform: 'scaleX(-1)' }}>🏓</span>
              <span className="ts-player-name">
                {match.player2_name}
                {service?.first_server === 'player2' && (
                  <span className="ts-first-server" title="Served first this set">1st</span>
                )}
              </span>
              {isSeries && sets && (
                <span className="ts-player-sets">{sets.player2_sets_won} {sets.player2_sets_won === 1 ? 'set' : 'sets'}</span>
              )}
              <span className="ts-player-score">{match.player2_score}</span>
              {service?.server === 'player2' && !isEnded && (
                <span className="ts-serving-dot">● serving</span>
              )}
            </div>
          </div>

          {/* Phase transition history */}
          {(match.phase_history?.length ?? 0) > 0 && (
            <div className="ts-phase-history">
              {match.phase_history.map((ph, i) => (
                <span key={i} className="ts-phase-history-item">
                  {PHASE_LABELS[ph.phase] ?? ph.phase}: {ph.player1_score}–{ph.player2_score}
                </span>
              ))}
              {!isEnded && (
                <span className="ts-phase-history-item active">→ {PHASE_LABELS[phase]}</span>
              )}
            </div>
          )}

          {/* Court illustration */}
          <div className="ts-court-wrap">
            <div className="ts-court">
              <div className="ts-court-center-line" />
              <div className="ts-net" />
              <span className="ts-court-player p1">🧑</span>
              <span className="ts-court-player p2">🧑</span>
            </div>
          </div>

          {/* End state */}
          {isEnded && match.is_draw ? (
            <div className="ts-draw-overlay">
              <div className="ts-draw-icon">🤝</div>
              <h2>Draw!</h2>
              <p>Match ended in a draw after extended tiebreaks</p>
              <div className="ts-draw-phases">
                {match.phase_history?.map((ph, i) => (
                  <span key={i}>{PHASE_LABELS[ph.phase]}: {ph.player1_score}–{ph.player2_score}</span>
                ))}
                <span>{PHASE_LABELS[match.phase]}: {match.player1_score}–{match.player2_score}</span>
              </div>
              <div className="ts-end-actions">
                <button
                  className="ts-ctrl-btn next-set"
                  onClick={handleNextSet}
                  disabled={busy}
                >
                  ▶ Next Set (same players)
                </button>
                <button
                  className="ts-ctrl-btn new-game"
                  onClick={() => { setShowSetup(true); setNewSeries(true); setMatch(null); }}
                >
                  + New Match
                </button>
              </div>
            </div>
          ) : isEnded ? (
            <div className="ts-winner-overlay">
              <div className="trophy">🏆</div>
              <h2 className="ts-winner-name">{match.winner ?? 'Match Ended'}</h2>
              {match.winner && <p>wins the {match.game_type}-point match!</p>}
              <div className="ts-winner-final-score">
                <span className="s1">{match.player1_score}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 12px' }}>:</span>
                <span className="s2">{match.player2_score}</span>
              </div>
              {isSeries && sets && (
                <div className="ts-series-tally">
                  Series: {match.player1_name} {sets.player1_sets_won} – {sets.player2_sets_won} {match.player2_name}
                </div>
              )}
              <div className="ts-end-actions">
                <button
                  className="ts-ctrl-btn next-set"
                  onClick={handleNextSet}
                  disabled={busy}
                >
                  ▶ Next Set (same players)
                </button>
                <button
                  className="ts-ctrl-btn new-game"
                  onClick={() => { setShowSetup(true); setNewSeries(true); setMatch(null); }}
                >
                  + New Match
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="ts-actions">
                <button
                  className="ts-point-btn p1"
                  onClick={() => handlePoint('player1')}
                  disabled={busy || isEnded}
                >
                  <span className="btn-icon">+1</span>
                  <span className="btn-label">{match.player1_name}</span>
                </button>
                <button
                  className="ts-point-btn p2"
                  onClick={() => handlePoint('player2')}
                  disabled={busy || isEnded}
                >
                  <span className="btn-icon">+1</span>
                  <span className="btn-label">{match.player2_name}</span>
                </button>
              </div>

              <div className="ts-controls">
                <button
                  className="ts-ctrl-btn undo"
                  onClick={handleUndo}
                  disabled={busy || livePoints(match.score_history).length === 0}
                >
                  ↩ Undo Last Point
                </button>
                <button className="ts-ctrl-btn end" onClick={handleEndMatch} disabled={busy}>
                  ⏹ End Match
                </button>
                <button className="ts-ctrl-btn new-game" onClick={() => setShowSetup(true)}>
                  ↺ New Match
                </button>
              </div>
            </>
          )}

          {/* Per-set results in this series */}
          {isSeries && sets && (
            <div className="ts-sets-row">
              {sets.sets.map((s) => (
                <span key={s.set_number} className={`ts-set-chip${s.status === 'active' ? ' active' : ''}`}>
                  <span className="ts-set-chip-label">S{s.set_number}</span>
                  {s.player1_score}–{s.player2_score}
                </span>
              ))}
            </div>
          )}

          {/* Score history dots — undone points are dropped, not shown greyed */}
          {livePoints(match.score_history).length > 0 && (
            <div className="ts-history" title="Score history (blue = player 1, red = player 2)">
              {livePoints(match.score_history).map((h) => (
                <span key={h.id} className={`ts-history-dot ${h.player === 'player1' ? 'p1' : 'p2'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <div className="ts-recent">
          <div className="ts-recent-header">
            <h3>Recent Matches</h3>
            <button className="ts-recent-refresh" onClick={fetchRecent}>↻ Refresh</button>
          </div>
          <div className="ts-recent-list">
            {recentMatches.map(m => (
              <div key={m.id} className={`ts-recent-row${m.status === 'active' ? ' live' : ''}`}>
                <div className="ts-recent-status-col">
                  {m.status === 'active'
                    ? <span className="ts-recent-badge live">Live</span>
                    : m.is_draw
                    ? <span className="ts-recent-badge draw">Draw</span>
                    : <span className="ts-recent-badge done">Done</span>
                  }
                </div>
                <div className="ts-recent-players-col">
                  <span className={m.winner === m.player1_name ? 'ts-recent-winner' : 'ts-recent-player'}>
                    {m.player1_name}
                  </span>
                  <span className="ts-recent-score-display">
                    <span className="ts-recent-s1">{m.player1_score}</span>
                    <span className="ts-recent-sep">:</span>
                    <span className="ts-recent-s2">{m.player2_score}</span>
                  </span>
                  <span className={m.winner === m.player2_name ? 'ts-recent-winner' : 'ts-recent-player'}>
                    {m.player2_name}
                  </span>
                </div>
                <div className="ts-recent-meta-col">
                  <span className="ts-recent-type">{m.game_type}pt</span>
                  {m.winner && !m.is_draw && (
                    <span className="ts-recent-result">🏆 {m.winner}</span>
                  )}
                  {m.created_at && (
                    <span className="ts-recent-time">
                      {new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TennisScoreEntry;
