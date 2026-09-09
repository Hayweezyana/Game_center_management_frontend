import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './PlayflowInsights.css';

/**
 * The operator side of the waiting page.
 *
 * Three things that all came out of the same work and are read together at the
 * end of a shift: what customers thought, where they came from, and whether the
 * wait times we are quoting them are based on real station counts.
 */

interface PerGameRating {
  game_title: string;
  responses: number;
  average_rating: number | null;
}

interface Comment {
  id: string;
  game_title: string | null;
  username: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface FeedbackSummary {
  per_game: PerGameRating[];
  overall: { responses: number; average_rating: number | null };
  recent_comments: Comment[];
  low_ratings: Comment[];
}

interface Acquisition {
  by_transaction: Array<{ channel: string; transactions: number; revenue: number }>;
  by_new_customer: Array<{ channel: string; customers: number }>;
  coverage: { answered: number; total: number; rate: number | null };
}

interface AvailabilityRow {
  game_id: string;
  title: string;
  stations_total: number;
  stations_online: number;
  units_ahead: number;
  sessions_ahead: number;
  players_per_session: number;
  own_stations: number;
  station_group: string | null;
  shares_with: string[];
  service_minutes: number;
  wait_minutes: number | null;
  confidence: 'high' | 'estimate' | 'unavailable';
  bookable: boolean;
}

const BACKEND = process.env.REACT_APP_BACKEND_URL?.replace(/\/+$/, '') || '';

const stars = (value: number | null): string => {
  if (value === null) return '—';
  const rounded = Math.round(value);
  return '★'.repeat(rounded) + '☆'.repeat(Math.max(0, 5 - rounded));
};

const PlayflowInsights: React.FC = () => {
  const operatorToken = localStorage.getItem('operatorToken') || '';
  const adminToken = sessionStorage.getItem('token') || '';
  const headers = useMemo(() => {
    const token = operatorToken || adminToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [operatorToken, adminToken]);

  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(today);

  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);
  const [acquisition, setAcquisition] = useState<Acquisition | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { stations: number; players: number }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    try {
      const [fb, acq, avail] = await Promise.all([
        axios.get(`${BACKEND}/v1/admin/feedback`, { headers, params }),
        axios.get(`${BACKEND}/v1/admin/acquisition`, { headers, params }),
        axios.get(`${BACKEND}/v1/games/availability`),
      ]);
      setFeedback(fb.data?.data ?? null);
      setAcquisition(acq.data?.data ?? null);
      setAvailability(avail.data?.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not load insights.');
    } finally {
      setLoading(false);
    }
  }, [headers, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCapacity = async (gameId: string, patch: Record<string, number>) => {
    setSavingId(gameId);
    try {
      await axios.patch(`${BACKEND}/v1/admin/games/${gameId}/capacity`, patch, { headers });
      const avail = await axios.get(`${BACKEND}/v1/games/availability`);
      setAvailability(avail.data?.data ?? []);
      // Drop the draft so the row shows the persisted value, not a stale edit.
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[gameId];
        return next;
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not save capacity.');
    } finally {
      setSavingId(null);
    }
  };

  // Experiences with no declared stations quote nothing to customers — these
  // are the rows that need a number typed into them.
  const uncapacitated = availability.filter(
    (row) => !row.bookable && row.service_minutes > 0 && row.title !== 'Drinks'
  );

  // Anything with no turn length is a catalogue row (Drinks), not something
  // people queue for. Unset experiences float to the top — they need attention.
  const capacityRows = useMemo(
    () =>
      availability
        .filter((row) => row.service_minutes > 0 && row.title !== 'Drinks')
        .sort((a, b) => {
          const aUnset = a.bookable ? 1 : 0;
          const bUnset = b.bookable ? 1 : 0;
          return aUnset - bUnset || a.title.localeCompare(b.title);
        }),
    [availability]
  );

  return (
    <div className="pf-page">
      <header className="pf-header">
        <div>
          <h1>Playflow Insights</h1>
          <p className="pf-sub">Ratings, where customers came from, and the station counts behind every wait time.</p>
        </div>
        <div className="pf-filters">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="End date" />
          <button type="button" onClick={() => { setStartDate(''); setEndDate(today); }}>Reset</button>
        </div>
      </header>

      {error && <p className="pf-error">{error}</p>}
      {loading && <p className="pf-muted">Loading…</p>}

      <section className={`pf-card${uncapacitated.length > 0 ? ' pf-card--warn' : ''}`}>
        <h2>Floor capacity</h2>
        <p className="pf-muted">
          {uncapacitated.length > 0 ? (
            <>
              <strong>
                {uncapacitated.length} experience{uncapacitated.length === 1 ? '' : 's'} below
                {uncapacitated.length === 1 ? ' is' : ' are'} off the menu
              </strong>
              — customers see “Not available right now” and cannot buy them.{' '}
            </>
          ) : null}
          <strong>Stations</strong> is how many run at once; 0 takes it off the menu.{' '}
          <strong>Seats</strong> is how many people one turn takes — 2 for boxing, 4 for Just Dance —
          so a group sharing a station queues once, not once each. Experiences marked as sharing
          stations run one at a time between them, so the largest count in the group is the bay.
        </p>

        <div className="pf-scroll">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Experience</th>
                <th className="pf-num">Turn</th>
                <th className="pf-num">Stations</th>
                <th className="pf-num">Seats</th>
                <th className="pf-num">Waiting</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {capacityRows.map((row) => {
                const draft = drafts[row.game_id] ?? {
                  stations: row.own_stations,
                  players: row.players_per_session,
                };
                const dirty =
                  draft.stations !== row.own_stations || draft.players !== row.players_per_session;

                return (
                  <tr key={row.game_id} className={row.bookable ? undefined : 'pf-row--warn'}>
                    <td>
                      {row.title}
                      {row.shares_with.length > 0 && (
                        <span className="pf-shares">
                          shares stations with {row.shares_with.join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="pf-num pf-muted">{row.service_minutes}m</td>
                    <td className="pf-num">
                      <input
                        className="pf-stations"
                        type="number"
                        min={0}
                        max={50}
                        value={draft.stations}
                        aria-label={`Stations for ${row.title}`}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.game_id]: { ...draft, stations: Math.max(0, Number(e.target.value) || 0) },
                          }))
                        }
                      />
                    </td>
                    <td className="pf-num">
                      <input
                        className="pf-stations"
                        type="number"
                        min={1}
                        max={20}
                        value={draft.players}
                        aria-label={`Players per turn for ${row.title}`}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.game_id]: { ...draft, players: Math.max(1, Number(e.target.value) || 1) },
                          }))
                        }
                      />
                    </td>
                    <td className="pf-num pf-muted">
                      {row.units_ahead > 0
                        ? `${row.units_ahead} in ${row.sessions_ahead} turn${row.sessions_ahead === 1 ? '' : 's'}`
                        : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="pf-btn"
                        disabled={!dirty || savingId === row.game_id}
                        onClick={() =>
                          void saveCapacity(row.game_id, {
                            stations: draft.stations,
                            players_per_session: draft.players,
                          })
                        }
                      >
                        {savingId === row.game_id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pf-grid">
        <section className="pf-card">
          <h2>Ratings by experience</h2>
          {feedback && feedback.overall.responses > 0 && (
            <p className="pf-overall">
              <span className="pf-stars">{stars(feedback.overall.average_rating)}</span>
              <span className="pf-muted">
                {feedback.overall.average_rating} overall · {feedback.overall.responses} visit
                {feedback.overall.responses === 1 ? '' : 's'} rated
              </span>
            </p>
          )}
          {feedback && feedback.per_game.length > 0 ? (
            <table className="pf-table">
              <thead>
                <tr><th>Experience</th><th>Rating</th><th className="pf-num">Responses</th></tr>
              </thead>
              <tbody>
                {feedback.per_game.map((row) => (
                  <tr key={row.game_title}>
                    <td>{row.game_title}</td>
                    <td>
                      <span className="pf-stars">{stars(row.average_rating)}</span>{' '}
                      <span className="pf-muted">{row.average_rating ?? '—'}</span>
                    </td>
                    <td className="pf-num">{row.responses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !loading && <p className="pf-muted">No ratings in this range yet.</p>
          )}
        </section>

        <section className="pf-card">
          <h2>How customers found us</h2>
          {acquisition && acquisition.coverage.rate !== null && (
            <p className="pf-muted pf-coverage">
              {acquisition.coverage.answered} of {acquisition.coverage.total} sales answered
              {' '}({Math.round(acquisition.coverage.rate * 100)}%)
            </p>
          )}
          {acquisition && acquisition.by_transaction.length > 0 ? (
            <table className="pf-table">
              <thead>
                <tr><th>Channel</th><th className="pf-num">Sales</th><th className="pf-num">New customers</th></tr>
              </thead>
              <tbody>
                {acquisition.by_transaction.map((row) => {
                  const newCustomers = acquisition.by_new_customer.find((c) => c.channel === row.channel);
                  return (
                    <tr key={row.channel}>
                      <td>{row.channel}</td>
                      <td className="pf-num">{row.transactions}</td>
                      <td className="pf-num">{newCustomers?.customers ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            !loading && <p className="pf-muted">No answers recorded in this range yet.</p>
          )}
        </section>
      </div>

      {feedback && feedback.low_ratings.length > 0 && (
        <section className="pf-card pf-card--alert">
          <h2>Needs a look — 2 stars or below</h2>
          <ul className="pf-comments">
            {feedback.low_ratings.map((row) => (
              <li key={row.id}>
                <span className="pf-stars pf-stars--low">{stars(row.rating)}</span>
                <span className="pf-comment-meta">
                  {row.game_title || 'Overall visit'} · {row.username || 'Anonymous'} ·{' '}
                  {new Date(row.created_at).toLocaleDateString()}
                </span>
                {row.comment && <p className="pf-comment-text">“{row.comment}”</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {feedback && feedback.recent_comments.length > 0 && (
        <section className="pf-card">
          <h2>Recent comments</h2>
          <ul className="pf-comments">
            {feedback.recent_comments.map((row) => (
              <li key={row.id}>
                <span className="pf-stars">{stars(row.rating)}</span>
                <span className="pf-comment-meta">
                  {row.game_title || 'Overall visit'} · {row.username || 'Anonymous'} ·{' '}
                  {new Date(row.created_at).toLocaleDateString()}
                </span>
                {row.comment && <p className="pf-comment-text">“{row.comment}”</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default PlayflowInsights;
