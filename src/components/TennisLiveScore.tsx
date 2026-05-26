import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './Tennis.css';

const BACKEND = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:2024').replace(/\/+$/, '');
const POLL_INTERVAL = 4000; // fallback poll every 4 s

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

const TennisLiveScore: React.FC = () => {
  const [match, setMatch] = useState<TennisMatch | null>(null);
  const [connected, setConnected] = useState(false);
  const [flashSide, setFlashSide] = useState<'player1' | 'player2' | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const [recentMatches, setRecentMatches] = useState<TennisMatch[]>([]);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const matchRef = useRef<TennisMatch | null>(null);

  // Keep ref in sync so polling can compare without stale closure
  useEffect(() => { matchRef.current = match; }, [match]);

  const applyUpdate = useCallback((updated: TennisMatch) => {
    const prev = matchRef.current;
    if (prev) {
      if (updated.player1_score > prev.player1_score) setFlashSide('player1');
      else if (updated.player2_score > prev.player2_score) setFlashSide('player2');
    }
    setMatch(updated);
    setJustUpdated(true);
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/tennis/match/live`);
      const incoming: TennisMatch | null = res.data?.data ?? null;
      const prev = matchRef.current;
      // Only apply if something actually changed
      if (!incoming && prev) { setMatch(null); return; }
      if (!incoming) return;
      if (!prev || incoming.player1_score !== prev.player1_score || incoming.player2_score !== prev.player2_score || incoming.status !== prev.status) {
        applyUpdate(incoming);
      }
    } catch {}
  }, [applyUpdate]);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/tennis/matches`);
      setRecentMatches(res.data?.data ?? []);
    } catch {}
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchLive();
    fetchRecent();
  }, [fetchLive, fetchRecent]);

  // Polling fallback — keeps score fresh even if socket drops
  useEffect(() => {
    const timer = setInterval(fetchLive, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchLive]);

  // Socket.IO for instant updates
  useEffect(() => {
    const socket = io(BACKEND, {
      transports: ['polling', 'websocket'], // start with polling (always works), upgrade to WS when available
      upgrade: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('tennis:score', (updated: TennisMatch) => {
      applyUpdate(updated);
      if (updated.status === 'ended') {
        fetchRecent();
      }
    });

    return () => { socket.disconnect(); };
  }, [applyUpdate, fetchRecent]);

  // Clear score-side flash
  useEffect(() => {
    if (!flashSide) return;
    const t = setTimeout(() => setFlashSide(null), 600);
    return () => clearTimeout(t);
  }, [flashSide]);

  // Clear board update flash
  useEffect(() => {
    if (!justUpdated) return;
    const t = setTimeout(() => setJustUpdated(false), 700);
    return () => clearTimeout(t);
  }, [justUpdated]);

  const isEnded = match?.status === 'ended';
  const noMatch = !match;
  const phase = match?.phase ?? 'main';

  return (
    <div className="tl-shell">
      {/* Header */}
      <div className="tl-header">
        <div className="tl-title">🏓 Immersia Table Tennis</div>
        {connected && match && !isEnded
          ? <span className="tl-live-badge">
              <span className="tl-live-ring" />
              <span className="tl-live-dot-inner" />
              Live
            </span>
          : <span className="tl-idle-dot">
              {isEnded ? 'Match Ended' : 'Waiting for match'}
            </span>
        }
      </div>

      {/* Scoreboard */}
      <div className={`tl-board${justUpdated ? ' just-updated' : ''}`}>
        {noMatch ? (
          <div className="tl-idle">
            <div className="tl-idle-icon">🏓</div>
            <h2>No Active Match</h2>
            <p>Scores will appear here once a match begins.</p>
          </div>
        ) : (
          <>
            {/* Winner banner — at the top of the board when match is over */}
            {isEnded && !match.is_draw && match.winner && (
              <div className="tl-winner-banner">
                <span className="tl-winner-banner-trophy">🏆</span>
                <span className="tl-winner-banner-name">{match.winner}</span>
                <span className="tl-winner-banner-sub">
                  wins &nbsp;·&nbsp; {match.player1_score} — {match.player2_score} &nbsp;·&nbsp; {match.game_type}-point game
                </span>
              </div>
            )}

            {/* Draw banner */}
            {isEnded && match.is_draw && (
              <div className="tl-draw-banner">
                <span className="tl-draw-banner-icon">🤝</span>
                <span className="tl-draw-banner-text">Draw!</span>
                <span className="tl-draw-banner-sub">
                  {match.player1_name} vs {match.player2_name} &nbsp;·&nbsp; {match.game_type}-point game
                </span>
              </div>
            )}

            {/* Phase strip (tiebreaks) */}
            {phase !== 'main' && !isEnded && (
              <div className="tl-phase-strip">
                <span className="tl-phase-badge">{PHASE_LABELS[phase]}</span>
                {(match.phase_history?.length ?? 0) > 0 && (
                  <span className="tl-phase-history">
                    {match.phase_history.map((ph, i) => (
                      <span key={i}>{PHASE_LABELS[ph.phase] ?? ph.phase}: {ph.player1_score}–{ph.player2_score}</span>
                    ))}
                  </span>
                )}
              </div>
            )}

            {/* Scores row */}
            <div className="tl-scores-row">
              {/* Player 1 */}
              <div
                className={['tl-player p1', match.winner === match.player1_name ? 'winner' : ''].join(' ')}
                style={flashSide === 'player1' ? { background: 'rgba(29,78,216,0.35)' } : {}}
              >
                {match.winner === match.player1_name && <span className="tl-winner-crown">👑</span>}
                <span className="tl-player-icon">🏓</span>
                <span className="tl-player-name">{match.player1_name}</span>
                <span
                  className="tl-player-score"
                  style={flashSide === 'player1' ? { transform: 'scale(1.1)', transition: 'transform 0.15s' } : { transition: 'transform 0.25s' }}
                >
                  {match.player1_score}
                </span>
              </div>

              {/* Center */}
              <div className="tl-center-col">
                <span className="tl-sep">:</span>
                {phase !== 'main' && !isEnded
                  ? <span className="tl-phase-pill">{phase === 'tb7' ? 'TB7' : 'TB5'}</span>
                  : <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {match.game_type}pt
                    </span>
                }
              </div>

              {/* Player 2 */}
              <div
                className={['tl-player p2', match.winner === match.player2_name ? 'winner' : ''].join(' ')}
                style={flashSide === 'player2' ? { background: 'rgba(185,28,28,0.35)' } : {}}
              >
                {match.winner === match.player2_name && <span className="tl-winner-crown">👑</span>}
                <span className="tl-player-icon" style={{ transform: 'scaleX(-1)' }}>🏓</span>
                <span className="tl-player-name">{match.player2_name}</span>
                <span
                  className="tl-player-score"
                  style={flashSide === 'player2' ? { transform: 'scale(1.1)', transition: 'transform 0.15s' } : { transition: 'transform 0.25s' }}
                >
                  {match.player2_score}
                </span>
              </div>
            </div>

            {/* Court */}
            <div className="tl-court-wrap">
              <div className="tl-court">
                <div className="ts-court-center-line" />
                <div className="tl-net" />
                <span className="tl-court-player p1">🧑</span>
                <span className="tl-court-player p2">🧑</span>
              </div>
            </div>

            {/* Footer */}
            <div className="tl-footer">
              <span>{match.game_type}-point game</span>
              <span>{match.score_history?.length ?? 0} points played</span>
              <span>{isEnded ? 'Finished' : 'In progress'}</span>
            </div>
          </>
        )}
      </div>

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <div className="tl-recent">
          <h3 className="tl-recent-title">Recent Matches</h3>
          <div className="tl-recent-list">
            {recentMatches.slice(0, 10).map(m => (
              <div key={m.id} className={`tl-recent-row${m.status === 'active' ? ' live' : ''}`}>
                <div className="tl-recent-players">
                  <span className={m.winner === m.player1_name ? 'tl-rw' : ''}>{m.player1_name}</span>
                  <span className="tl-recent-score">{m.player1_score} : {m.player2_score}</span>
                  <span className={m.winner === m.player2_name ? 'tl-rw' : ''}>{m.player2_name}</span>
                </div>
                <span className="tl-recent-result">
                  {m.status === 'active' ? '🔴 Live' : m.is_draw ? '🤝 Draw' : m.winner ? `🏆 ${m.winner}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TennisLiveScore;
