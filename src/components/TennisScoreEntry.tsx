import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Tennis.css';

const BACKEND = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:2024').replace(/\/+$/, '');

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
  score_history: Array<{ player: 'player1' | 'player2' }>;
  phase_history: Array<{ phase: string; player1_score: number; player2_score: number }>;
  created_at?: string;
}

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
        { player1_name: p1Name.trim(), player2_name: p2Name.trim(), game_type: gameType },
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
        { player },
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
          <button className="ts-start-btn" onClick={handleStartMatch} disabled={busy}>
            {busy ? 'Starting…' : `Start ${gameType}-Point Match`}
          </button>
        </div>
      )}

      {/* Active Game Arena */}
      {match && (
        <div className="ts-arena">
          {/* Score header */}
          <div className="ts-score-header">
            <div className={`ts-player-side p1${match.winner === match.player1_name ? ' winner' : ''}`}>
              {match.winner === match.player1_name && <span className="ts-winner-crown">👑</span>}
              <span className="ts-player-icon">🏓</span>
              <span className="ts-player-name">{match.player1_name}</span>
              <span className="ts-player-score">{match.player1_score}</span>
            </div>

            <div className="ts-score-center">
              <span className="ts-score-sep">:</span>
              <span className="ts-status-pill">{centerLabel()}</span>
              {phase !== 'main' && !isEnded && (
                <span className="ts-phase-badge">{PHASE_LABELS[phase]}</span>
              )}
            </div>

            <div className={`ts-player-side p2${match.winner === match.player2_name ? ' winner' : ''}`}>
              {match.winner === match.player2_name && <span className="ts-winner-crown">👑</span>}
              <span className="ts-player-icon" style={{ transform: 'scaleX(-1)' }}>🏓</span>
              <span className="ts-player-name">{match.player2_name}</span>
              <span className="ts-player-score">{match.player2_score}</span>
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
              <button
                className="ts-ctrl-btn new-game"
                style={{ fontSize: 15, padding: '12px 24px', marginTop: 16 }}
                onClick={() => { setShowSetup(true); setMatch(null); }}
              >
                + Start New Match
              </button>
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
              <button
                className="ts-ctrl-btn new-game"
                style={{ fontSize: 15, padding: '12px 24px' }}
                onClick={() => { setShowSetup(true); setMatch(null); }}
              >
                + Start New Match
              </button>
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
                  disabled={busy || !match.score_history?.length}
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

          {/* Score history dots */}
          {(match.score_history?.length ?? 0) > 0 && (
            <div className="ts-history" title="Score history (blue = player 1, red = player 2)">
              {match.score_history.map((h, i) => (
                <span key={i} className={`ts-history-dot ${h.player === 'player1' ? 'p1' : 'p2'}`} />
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
