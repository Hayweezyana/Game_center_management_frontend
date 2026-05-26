import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
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

const TennisLiveScore: React.FC = () => {
  const [match, setMatch] = useState<TennisMatch | null>(null);
  const [connected, setConnected] = useState(false);
  const [flashSide, setFlashSide] = useState<'player1' | 'player2' | null>(null);
  const [recentMatches, setRecentMatches] = useState<TennisMatch[]>([]);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  useEffect(() => {
    axios.get(`${BACKEND}/v1/admin/tennis/match/live`).then(res => setMatch(res.data?.data ?? null)).catch(() => setMatch(null));
    axios.get(`${BACKEND}/v1/admin/tennis/matches`).then(res => setRecentMatches(res.data?.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    const socket = io(BACKEND, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('tennis:score', (updated: TennisMatch) => {
      setMatch(prev => {
        if (prev) {
          if (updated.player1_score > prev.player1_score) setFlashSide('player1');
          else if (updated.player2_score > prev.player2_score) setFlashSide('player2');
        }
        return updated;
      });
      // Refresh recent when match ends
      if (updated.status === 'ended') {
        axios.get(`${BACKEND}/v1/admin/tennis/matches`).then(res => setRecentMatches(res.data?.data ?? [])).catch(() => {});
      }
    });
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (!flashSide) return;
    const t = setTimeout(() => setFlashSide(null), 600);
    return () => clearTimeout(t);
  }, [flashSide]);

  const isEnded = match?.status === 'ended';
  const noMatch = !match;
  const phase = match?.phase ?? 'main';

  return (
    <div className="tl-shell">
      {/* Header */}
      <div className="tl-header">
        <div className="tl-title">🏓 Immersia Table Tennis</div>
        {connected && match && !isEnded
          ? <span className="tl-live-dot">Live</span>
          : <span className="tl-idle-dot">{isEnded ? 'Match Ended' : 'Waiting for match'}</span>
        }
      </div>

      {/* Scoreboard */}
      <div className="tl-board">
        {noMatch ? (
          <div className="tl-idle">
            <div className="tl-idle-icon">🏓</div>
            <h2>No Active Match</h2>
            <p>Scores will appear here once a match begins.</p>
          </div>
        ) : (
          <>
            {/* Phase badge (when in tiebreak) */}
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
                style={flashSide === 'player1' ? { background: 'rgba(29,78,216,0.3)' } : {}}
              >
                {match.winner === match.player1_name && <span className="tl-winner-crown">👑</span>}
                <span className="tl-player-icon">🏓</span>
                <span className="tl-player-name">{match.player1_name}</span>
                <span
                  className="tl-player-score"
                  style={flashSide === 'player1' ? { transform: 'scale(1.08)', transition: 'transform 0.15s' } : { transition: 'transform 0.15s' }}
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
                style={flashSide === 'player2' ? { background: 'rgba(185,28,28,0.3)' } : {}}
              >
                {match.winner === match.player2_name && <span className="tl-winner-crown">👑</span>}
                <span className="tl-player-icon" style={{ transform: 'scaleX(-1)' }}>🏓</span>
                <span className="tl-player-name">{match.player2_name}</span>
                <span
                  className="tl-player-score"
                  style={flashSide === 'player2' ? { transform: 'scale(1.08)', transition: 'transform 0.15s' } : { transition: 'transform 0.15s' }}
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

            {/* Draw announcement */}
            {isEnded && match.is_draw && (
              <div className="tl-draw-announce">
                <span className="tl-draw-icon">🤝</span>
                <p className="tl-draw-text">Match ends in a Draw!</p>
                <p className="tl-winner-sub">
                  {match.player1_name} vs {match.player2_name} &nbsp;·&nbsp; {match.game_type}-point game
                </p>
              </div>
            )}

            {/* Winner announcement */}
            {isEnded && !match.is_draw && match.winner && (
              <div className="tl-winner-announce">
                <span className="tl-trophy">🏆</span>
                <p className="tl-winner-text">{match.winner}</p>
                <p className="tl-winner-sub">
                  wins! &nbsp;·&nbsp; Final: {match.player1_score} — {match.player2_score} &nbsp;·&nbsp; {match.game_type}-point game
                </p>
              </div>
            )}

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
                  {m.status === 'active'
                    ? '🔴 Live'
                    : m.is_draw
                    ? '🤝 Draw'
                    : m.winner
                    ? `🏆 ${m.winner}`
                    : '—'
                  }
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
