import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './Tennis.css';
import { tennisSounds, TennisCue } from './tennisSounds';

const BACKEND = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:2024').replace(/\/+$/, '');

// Local hub on the LAN — points land here in milliseconds instead of waiting on
// the cloud round trip. Empty string disables it and falls back to cloud-only.
const HUB = (process.env.REACT_APP_TENNIS_HUB_URL ?? 'http://immersia-hub.local:8080').replace(/\/+$/, '');

const POLL_INTERVAL = 4000; // fallback poll every 4 s

interface PointEvent {
  id: string;
  player: 'player1' | 'player2';
  ts: number;
  source?: string;
  undone?: boolean;
}

interface ServiceState {
  first_server: 'player1' | 'player2';
  server: 'player1' | 'player2';
  next_server: 'player1' | 'player2';
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
  first_server?: 'player1' | 'player2';
  service?: ServiceState;
  sets?: SetsSummary;
  created_at?: string;
}

const PHASE_LABELS: Record<string, string> = {
  main: 'Main Game',
  tb7: 'Tiebreak · 7pt',
  tb5: 'Tiebreak · 5pt',
};

/** Undone points stay in the log as tombstones — filter them for display. */
const livePoints = (history?: PointEvent[]): PointEvent[] =>
  (history ?? []).filter((e) => !e.undone);

/**
 * The display listens to two sources — the local hub and the cloud — and they
 * are briefly out of step after every point. Without this guard a stale cloud
 * snapshot arriving just after a hub update would look like an undo: the score
 * would jump backwards and the undo sound would fire for no reason.
 *
 * Tombstones make the two cases separable. A real undo keeps the event in the
 * log and flips `undone`, so the log never shrinks. An update that is simply
 * behind is *missing* events we already hold and brings nothing new — that one
 * is safe to drop, because the source that sent it will catch up on its next
 * sync anyway.
 */
function isStale(prev: TennisMatch | null, next: TennisMatch): boolean {
  if (!prev || prev.id !== next.id) return false;

  const prevEvents = prev.score_history ?? [];
  const nextEvents = next.score_history ?? [];

  const nextById: Record<string, PointEvent> = {};
  nextEvents.forEach((e) => { nextById[e.id] = e; });

  let missesKnown = false;
  for (const event of prevEvents) {
    const incoming = nextById[event.id];
    if (!incoming) { missesKnown = true; continue; }
    // `undone` is monotonic everywhere else, so un-undoing means it's behind.
    if (event.undone && !incoming.undone) missesKnown = true;
  }
  if (!missesKnown) return false;

  const prevIds: Record<string, true> = {};
  prevEvents.forEach((e) => { prevIds[e.id] = true; });
  const bringsNew = nextEvents.some((e) => !prevIds[e.id]);

  // Strictly behind. If it both misses and adds events the two sources have
  // genuinely diverged — take it and let the merge on the server converge.
  return !bringsNew;
}

/**
 * Works out which sounds to play from the difference between two match states.
 * Driven by the event log, not the score: scores reset to 0-0 on a tiebreak
 * transition, so a score diff would miss points and invent phantom undos.
 */
function detectCues(prev: TennisMatch | null, next: TennisMatch): TennisCue[] {
  // A different match means a new set was started — no point/undo cue applies.
  if (!prev || prev.id !== next.id) return [];

  const cues: TennisCue[] = [];
  const before = livePoints(prev.score_history);
  const after = livePoints(next.score_history);

  if (after.length > before.length) {
    const scorer = after[after.length - 1]?.player;
    cues.push(scorer === 'player2' ? 'point-player2' : 'point-player1');
  } else if (after.length < before.length) {
    cues.push('undo');
  }

  // Service handover — only while play continues, so it never collides with the
  // end-of-set fanfare.
  const stillActive = next.status !== 'ended';
  if (stillActive && prev.service && next.service && prev.service.server !== next.service.server) {
    cues.push('service-switch');
  }

  if (prev.status !== 'ended' && next.status === 'ended') {
    if (next.is_draw) {
      cues.push('match-draw');
    } else {
      // Escalate to the big fanfare when this set also puts the winner ahead in
      // a multi-set series; a standalone set gets the short one.
      const sets = next.sets;
      const winnerSets =
        sets && next.winner === next.player1_name ? sets.player1_sets_won :
        sets && next.winner === next.player2_name ? sets.player2_sets_won : 0;
      const loserSets =
        sets && next.winner === next.player1_name ? sets.player2_sets_won :
        sets && next.winner === next.player2_name ? sets.player1_sets_won : 0;
      cues.push(sets && sets.sets_played > 1 && winnerSets > loserSets ? 'series-won' : 'set-won');
    }
  }

  return cues;
}

const TennisLiveScore: React.FC = () => {
  const [match, setMatch] = useState<TennisMatch | null>(null);
  const [connected, setConnected] = useState(false);
  const [hubConnected, setHubConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [flashSide, setFlashSide] = useState<'player1' | 'player2' | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const [recentMatches, setRecentMatches] = useState<TennisMatch[]>([]);
  const matchRef = useRef<TennisMatch | null>(null);

  // Keep ref in sync so polling can compare without stale closure
  useEffect(() => { matchRef.current = match; }, [match]);

  // Unlock audio as early as possible — the kiosk has no user to click.
  useEffect(() => { tennisSounds.bindUnlock(); }, []);
  useEffect(() => { tennisSounds.enabled = !muted; }, [muted]);

  const applyUpdate = useCallback((updated: TennisMatch) => {
    const prev = matchRef.current;
    if (isStale(prev, updated)) return;

    for (const cue of detectCues(prev, updated)) {
      // Stagger slightly so a point and its fanfare don't smear together.
      if (cue === 'set-won' || cue === 'series-won' || cue === 'match-draw') {
        setTimeout(() => tennisSounds.play(cue), 260);
      } else {
        tennisSounds.play(cue);
      }
    }

    if (prev && prev.id === updated.id) {
      const before = livePoints(prev.score_history);
      const after = livePoints(updated.score_history);
      if (after.length > before.length) {
        setFlashSide(after[after.length - 1]?.player ?? null);
      }
    }

    matchRef.current = updated;   // set now so back-to-back events diff correctly
    setMatch(updated);
    setJustUpdated(true);
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND}/v1/admin/tennis/match/live`);
      const incoming: TennisMatch | null = res.data?.data ?? null;
      const prev = matchRef.current;

      if (!incoming) {
        // No active match — keep showing an ended match so the winner stays visible.
        // Only reset to "no match" if we had nothing before.
        if (!prev) setMatch(null);
        return;
      }
      // New active match, score change, or a point undone — update
      if (
        !prev ||
        incoming.id !== prev.id ||
        livePoints(incoming.score_history).length !== livePoints(prev.score_history).length ||
        incoming.status !== prev.status
      ) {
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

  // Polling fallback — keeps score fresh even if both sockets drop
  useEffect(() => {
    const timer = setInterval(fetchLive, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchLive]);

  // ── Local hub socket — the fast path ───────────────────────────────────────
  // Points from the button boxes arrive here within milliseconds. If the hub is
  // absent (no LAN box installed) this simply never connects and the cloud
  // socket below carries everything.
  useEffect(() => {
    if (!HUB) return;
    const socket = io(HUB, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
      timeout: 4000,
    });

    socket.on('connect', () => setHubConnected(true));
    socket.on('disconnect', () => setHubConnected(false));
    socket.on('connect_error', () => setHubConnected(false));
    socket.on('tennis:score', (updated: TennisMatch | null) => {
      if (updated) applyUpdate(updated);
    });

    return () => { socket.disconnect(); };
  }, [applyUpdate]);

  // ── Cloud socket — points entered in the admin frontend, and hub fallback ──
  useEffect(() => {
    const socket = io(BACKEND, {
      transports: ['polling', 'websocket'], // start with polling (always works), upgrade to WS when available
      upgrade: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

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
  const service = match?.service;
  const sets = match?.sets;
  const isSeries = (sets?.sets.length ?? 0) > 1;

  const serverName =
    service && match
      ? (service.server === 'player1' ? match.player1_name : match.player2_name)
      : null;

  return (
    <div className="tl-shell">
      {/* Header */}
      <div className="tl-header">
        <div className="tl-title">🏓 Immersia Table Tennis</div>
        <div className="tl-header-right">
          <button
            className="tl-mute-btn"
            onClick={() => setMuted(m => !m)}
            title={muted ? 'Unmute score sounds' : 'Mute score sounds'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          {hubConnected && <span className="tl-hub-badge" title="Local hub connected — points record instantly">⚡ LAN</span>}
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
                  wins {isSeries ? `set ${sets?.set_number}` : ''} &nbsp;·&nbsp; {match.player1_score} — {match.player2_score} &nbsp;·&nbsp; {match.game_type}-point game
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

            {/* Set + service strip */}
            <div className="tl-set-strip">
              {sets && (
                <span className="tl-set-badge">
                  Set {sets.set_number}
                  {isSeries && (
                    <span className="tl-set-tally">
                      &nbsp;·&nbsp; sets {sets.player1_sets_won} – {sets.player2_sets_won}
                    </span>
                  )}
                </span>
              )}
              {service && !isEnded && (
                <span className="tl-serve-badge">
                  <span className="tl-serve-ball">🏓</span>
                  <b>{serverName}</b> to serve
                  <span className="tl-serve-count">
                    {service.serves_until_switch} left
                  </span>
                </span>
              )}
            </div>

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
                className={[
                  'tl-player p1',
                  match.winner === match.player1_name ? 'winner' : '',
                  service?.server === 'player1' && !isEnded ? 'serving' : '',
                ].join(' ')}
                style={flashSide === 'player1' ? { background: 'rgba(29,78,216,0.35)' } : {}}
              >
                {match.winner === match.player1_name && <span className="tl-winner-crown">👑</span>}
                <span className="tl-player-icon">🏓</span>
                <span className="tl-player-name">
                  {match.player1_name}
                  {service?.first_server === 'player1' && (
                    <span className="tl-first-server" title="Served first this set">1st serve</span>
                  )}
                </span>
                {isSeries && sets && (
                  <span className="tl-player-sets">{sets.player1_sets_won} {sets.player1_sets_won === 1 ? 'set' : 'sets'}</span>
                )}
                <span
                  className="tl-player-score"
                  style={flashSide === 'player1' ? { transform: 'scale(1.1)', transition: 'transform 0.15s' } : { transition: 'transform 0.25s' }}
                >
                  {match.player1_score}
                </span>
                {service?.server === 'player1' && !isEnded && (
                  <span className="tl-serving-dot" title="Serving">● serving</span>
                )}
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
                className={[
                  'tl-player p2',
                  match.winner === match.player2_name ? 'winner' : '',
                  service?.server === 'player2' && !isEnded ? 'serving' : '',
                ].join(' ')}
                style={flashSide === 'player2' ? { background: 'rgba(185,28,28,0.35)' } : {}}
              >
                {match.winner === match.player2_name && <span className="tl-winner-crown">👑</span>}
                <span className="tl-player-icon" style={{ transform: 'scaleX(-1)' }}>🏓</span>
                <span className="tl-player-name">
                  {match.player2_name}
                  {service?.first_server === 'player2' && (
                    <span className="tl-first-server" title="Served first this set">1st serve</span>
                  )}
                </span>
                {isSeries && sets && (
                  <span className="tl-player-sets">{sets.player2_sets_won} {sets.player2_sets_won === 1 ? 'set' : 'sets'}</span>
                )}
                <span
                  className="tl-player-score"
                  style={flashSide === 'player2' ? { transform: 'scale(1.1)', transition: 'transform 0.15s' } : { transition: 'transform 0.25s' }}
                >
                  {match.player2_score}
                </span>
                {service?.server === 'player2' && !isEnded && (
                  <span className="tl-serving-dot" title="Serving">● serving</span>
                )}
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

            {/* Per-set results in this series */}
            {isSeries && sets && (
              <div className="tl-sets-row">
                {sets.sets.map((s) => (
                  <span
                    key={s.set_number}
                    className={`tl-set-chip${s.status === 'active' ? ' active' : ''}`}
                  >
                    <span className="tl-set-chip-label">S{s.set_number}</span>
                    {s.player1_score}–{s.player2_score}
                  </span>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="tl-footer">
              <span>{match.game_type}-point game</span>
              <span>{livePoints(match.score_history).length} points played</span>
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
