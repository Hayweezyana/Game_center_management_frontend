import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import io, { Socket } from 'socket.io-client';
import logo from './logo/immersia.png';
import { trackPurchase } from '../utils/metaPixel';
import { recordStep } from '../utils/visitTracking';
import { useCartContext } from './hooks/useCart';
import './Ticket.css';

declare global {
  interface Window {
    fbq?: any;
  }
}

interface CartItem {
  id: string;
  pc_id: string;
  gameDuration: number;
  quantity: number;
  title: string;
  pc_title: string;
  price: number;
}

interface UserDetails {
  id: string;
  username: string;
  /** Optional — when present it is hashed server-side to improve Meta match quality. */
  phone?: string;
}

interface LocationState {
  merchantReference?: string;
  reference?: string;
  cartItems?: CartItem[];
  finalAmount?: number;
  dateTime?: string;
  adminName?: string;
  discount?: number;
  userDetails?: UserDetails;
}

type UnitState = 'queued' | 'up_next' | 'ready' | 'playing' | 'done' | 'expired';

interface ItineraryRow {
  game_id: string | null;
  game_title: string;
  rounds: number;
  position: number | null;
  est_start_at: string | null;
  est_end_at: string | null;
  state: UnitState;
  pc_title: string | null;
}

interface TicketUnit {
  transaction_item_id: string;
  unit_index: number;
  game_id: string | null;
  game_title: string;
  state: UnitState;
  position: number | null;
  est_start_at: string | null;
  est_end_at: string | null;
  pc_title: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  awaiting_feedback: boolean;
}

interface LiveTicket {
  reference: string;
  transaction_id: string;
  username: string;
  party_size: number;
  total_amount: number;
  discount: number;
  created_at: string | null;
  items: Array<{ id: string; game_id: string | null; title: string; quantity: number; price: number }>;
  itinerary: ItineraryRow[];
  units: TicketUnit[];
  finishes_at: string | null;
  all_done: boolean;
  awaiting_overall_feedback: boolean;
}

const STATE_COPY: Record<UnitState, { label: string; tone: string }> = {
  queued: { label: 'In the queue', tone: 'queued' },
  up_next: { label: 'Up next', tone: 'next' },
  ready: { label: 'Ready now', tone: 'ready' },
  playing: { label: 'Playing', tone: 'playing' },
  done: { label: 'Finished', tone: 'done' },
  expired: { label: 'Missed — rejoin at the desk', tone: 'expired' },
};

const clockTime = (iso: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const countdown = (iso: string | null, now: number): string | null => {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - now;
  if (diff <= 0) return '0:00';
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const ordinal = (n: number): string => {
  const suffix = ['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th';
  return `${n}${suffix}`;
};

const Ticket: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ reference?: string }>();

  const [reference, setReference] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [finalAmount, setTotalAmount] = useState<number>(0);
  const [dateTime, setDateTime] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { setCart } = useCartContext();

  // Live schedule — this is what turns the receipt into a waiting page.
  const [live, setLive] = useState<LiveTicket | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const socketRef = useRef<Socket | null>(null);

  // ── Meta Purchase tracking ────────────────────────────────────────────────
  // Only when we have just come from a payment page. Reopening the ticket from
  // a link is a revisit, not a second sale, and must not be reported as one.
  const purchaseTrackedRef = useRef<string | null>(null);
  const arrivedFromPayment = Boolean((location.state as LocationState | null)?.cartItems);

  useEffect(() => {
    if (!arrivedFromPayment) return;
    if (!finalAmount || finalAmount <= 0 || !cartItems.length) return;

    const key = reference || `${finalAmount}:${cartItems.length}`;
    if (purchaseTrackedRef.current === key) return;
    purchaseTrackedRef.current = key;

    trackPurchase(finalAmount, cartItems, reference || undefined, {
      phone: userDetails?.phone,
      externalId: userDetails?.id,
    });

    recordStep('paid', reference || undefined);
  }, [arrivedFromPayment, finalAmount, cartItems, reference, userDetails]);

  // ── Where the ticket comes from ───────────────────────────────────────────
  // A reference in the URL wins, so /t/<reference> survives a refresh and can be
  // opened from a WhatsApp link. Router state is the fallback for the hand-off
  // straight after payment.
  useEffect(() => {
    const state = location.state as LocationState | null;
    const routeReference = params.reference?.trim();

    if (routeReference) {
      setReference(routeReference);
    } else if (state && (state.merchantReference || state.reference)) {
      setReference(state.merchantReference || state.reference || null);
    }

    if (state && state.cartItems) {
      setCartItems(state.cartItems || []);
      setTotalAmount(state.finalAmount || 0);
      setDateTime(state.dateTime || new Date().toISOString());
      setAdminName(state.adminName || '');
      setDiscount(state.discount || 0);
      setUserDetails(state.userDetails || null);
    } else if (!routeReference) {
      setErrorMessage('No ticket data available. Please complete a transaction first.');
    }
  }, [location.state, params.reference]);

  const loadTicket = useCallback(async (ref: string) => {
    try {
      const res = await axios.get<{ status: boolean; data: LiveTicket }>(
        `${process.env.REACT_APP_BACKEND_URL}/v1/tickets/${encodeURIComponent(ref)}`
      );
      const data = res.data?.data;
      if (!data) return;
      setLive(data);

      // Reopened from a link: rebuild the receipt from the server copy.
      setCartItems((current) =>
        current.length
          ? current
          : data.items.map((item) => ({
              id: item.id,
              pc_id: '',
              gameDuration: 0,
              quantity: item.quantity,
              title: item.title,
              pc_title: '',
              price: item.price,
            }))
      );
      setTotalAmount((current) => current || data.total_amount);
      setDiscount((current) => current || data.discount);
      setDateTime((current) => current || data.created_at || '');
      setUserDetails((current) => current || { id: data.transaction_id, username: data.username });
      setErrorMessage('');
    } catch (_error) {
      // A ticket without a schedule still prints — don't blank the page.
    }
  }, []);

  useEffect(() => {
    if (!reference) return;
    void loadTicket(reference);

    const socket = io(`${process.env.REACT_APP_BACKEND_URL}`, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('ticket:subscribe', reference));

    const apply = (payload: any) => {
      if (payload?.ticket) setLive(payload.ticket);
      else void loadTicket(reference);
    };

    socket.on('schedule.updated', apply);
    socket.on('unit.ready', apply);
    socket.on('unit.playing', apply);
    socket.on('unit.done', apply);
    socket.on('ticket.checked_in', apply);

    // The socket is the fast path, not the only one — a dropped connection on
    // arcade wifi must not leave someone staring at a stale position.
    const poll = window.setInterval(() => void loadTicket(reference), 15_000);

    return () => {
      window.clearInterval(poll);
      socket.emit('ticket:unsubscribe', reference);
      socket.off('schedule.updated', apply);
      socket.off('unit.ready', apply);
      socket.off('unit.playing', apply);
      socket.off('unit.done', apply);
      socket.off('ticket.checked_in', apply);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [reference, loadTicket]);

  // Drives every countdown on the page.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const submitRating = async (
    key: string,
    body: { transactionItemId?: string | null; unitIndex?: number | null }
  ) => {
    if (!reference) return;
    const rating = ratings[key];
    if (!rating) return;

    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/tickets/${encodeURIComponent(reference)}/feedback`,
        { ...body, rating, comment: comments[key] || null }
      );
      setSavedKeys((prev) => ({ ...prev, [key]: true }));
      void loadTicket(reference);
    } catch (_error) {
      setSavedKeys((prev) => ({ ...prev, [key]: false }));
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const printTicket = () => {
    const content = document.getElementById('printable-area')?.innerHTML;
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow && content) {
      printWindow.document.write('<html><head><title>Ticket</title></head><body>');
      printWindow.document.write(content);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  };

  const headline = useMemo(() => {
    if (!live) return null;

    const ready = live.units.find((u) => u.state === 'ready');
    if (ready) {
      return ready.pc_title
        ? `You're up — head to ${ready.pc_title} for ${ready.game_title}`
        : `You're up — head to the ${ready.game_title} station`;
    }

    const playing = live.units.find((u) => u.state === 'playing');
    if (playing) {
      const left = countdown(playing.est_end_at, now);
      return left ? `${playing.game_title} — ${left} left` : `${playing.game_title} in progress`;
    }

    if (live.all_done) return 'That’s a wrap. How did we do?';

    if (live.finishes_at) {
      return `Your last game should finish around ${clockTime(live.finishes_at)}`;
    }

    return 'Getting your games ready…';
  }, [live, now]);

  const doneUnits = useMemo(
    () => (live ? live.units.filter((u) => u.state === 'done') : []),
    [live]
  );

  if (errorMessage && !live) {
    return (
      <div style={styles.ticketContainer}>
        <p style={{ color: 'red' }}>{errorMessage}</p>
        <button style={styles.homeButton} onClick={() => navigate('/gameselection')}>
          Go to Home
        </button>
      </div>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div style={styles.ticketContainer}>
      {/* ── Live board ─────────────────────────────────────────────────── */}
      {live && live.itinerary.length > 0 && (
        <section className="wait-board" aria-live="polite">
          <div className="wait-headline">
            <span className="wait-pulse" aria-hidden="true" />
            <h2>{headline}</h2>
          </div>
          <p className="wait-sub">
            {live.party_size > 1
              ? `${live.party_size} players on this ticket — times update live.`
              : 'Times update live as the floor moves.'}
          </p>

          <ul className="wait-list">
            {live.itinerary.map((row) => {
              const copy = STATE_COPY[row.state] || STATE_COPY.queued;
              const left = row.state === 'playing' ? countdown(row.est_end_at, now) : null;

              return (
                <li key={`${row.game_title}-${row.game_id ?? 'x'}`} className={`wait-row wait-row--${copy.tone}`}>
                  <div className="wait-row-main">
                    <span className="wait-game">{row.game_title}</span>
                    {row.rounds > 1 && <span className="wait-rounds">{row.rounds} rounds</span>}
                  </div>

                  <div className="wait-row-meta">
                    <span className={`wait-pill wait-pill--${copy.tone}`}>{copy.label}</span>

                    {row.state === 'playing' && left && (
                      <span className="wait-time wait-time--live">{left} left</span>
                    )}

                    {row.state === 'ready' && row.pc_title && (
                      <span className="wait-time wait-time--live">{row.pc_title}</span>
                    )}

                    {(row.state === 'queued' || row.state === 'up_next') && (
                      <>
                        {row.position !== null && (
                          <span className="wait-position">
                            {row.position === 1 ? 'Next up' : `${ordinal(row.position)} in line`}
                          </span>
                        )}
                        <span className="wait-time">~{clockTime(row.est_start_at)}</span>
                      </>
                    )}

                    {row.state === 'done' && <span className="wait-time">{clockTime(row.est_end_at)}</span>}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ── Feedback, asked the moment a round ends ─────────────────── */}
          {doneUnits.map((unit) => {
            const key = `${unit.transaction_item_id}:${unit.unit_index}`;
            if (!unit.awaiting_feedback && !savedKeys[key]) return null;

            if (savedKeys[key]) {
              return (
                <div key={key} className="wait-feedback wait-feedback--saved">
                  Thanks for rating {unit.game_title}.
                </div>
              );
            }

            return (
              <div key={key} className="wait-feedback">
                <p className="wait-feedback-q">How was {unit.game_title}?</p>
                <div className="wait-stars" role="group" aria-label={`Rate ${unit.game_title}`}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      className={`wait-star${(ratings[key] || 0) >= star ? ' wait-star--on' : ''}`}
                      onClick={() => setRatings((prev) => ({ ...prev, [key]: star }))}
                      aria-label={`${star} star${star === 1 ? '' : 's'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {ratings[key] > 0 && (
                  <>
                    <input
                      className="wait-comment"
                      type="text"
                      maxLength={300}
                      placeholder="Anything you'd like to add? (optional)"
                      value={comments[key] || ''}
                      onChange={(e) => setComments((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="wait-send"
                      disabled={saving[key]}
                      onClick={() =>
                        submitRating(key, {
                          transactionItemId: unit.transaction_item_id,
                          unitIndex: unit.unit_index,
                        })
                      }
                    >
                      {saving[key] ? 'Sending…' : 'Send rating'}
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {live.awaiting_overall_feedback && !savedKeys.overall && (
            <div className="wait-feedback wait-feedback--overall">
              <p className="wait-feedback-q">How was your visit overall?</p>
              <div className="wait-stars" role="group" aria-label="Rate your visit">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    className={`wait-star${(ratings.overall || 0) >= star ? ' wait-star--on' : ''}`}
                    onClick={() => setRatings((prev) => ({ ...prev, overall: star }))}
                    aria-label={`${star} star${star === 1 ? '' : 's'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              {ratings.overall > 0 && (
                <>
                  <input
                    className="wait-comment"
                    type="text"
                    maxLength={300}
                    placeholder="Tell us more (optional)"
                    value={comments.overall || ''}
                    onChange={(e) => setComments((prev) => ({ ...prev, overall: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="wait-send"
                    disabled={saving.overall}
                    onClick={() => submitRating('overall', { transactionItemId: null, unitIndex: null })}
                  >
                    {saving.overall ? 'Sending…' : 'Send rating'}
                  </button>
                </>
              )}
            </div>
          )}

          {savedKeys.overall && ratings.overall >= 4 && (
            <a
              className="wait-google"
              href="https://share.google/H4XxOBqjnjzQwftrw"
              target="_blank"
              rel="noopener noreferrer"
            >
              Loved it? Leave us a Google review →
            </a>
          )}
        </section>
      )}

      {/* ── Printable receipt ──────────────────────────────────────────── */}
      <div id="printable-area">
        <div style={styles.header}>
          <img src={logo} alt="Immersia Logo" style={styles.logo} />
          <p style={styles.subtitle}>IG: @immersiang | www.immersiavr.com</p>
        </div>

        <div style={styles.details}>
          <h2 style={styles.sectionTitle}>Ticket Details</h2>
          <p>
            <strong>Reference:</strong> {reference || 'N/A'}
          </p>
          <p>
            <strong>Username:</strong> {live?.username || userDetails?.username || 'N/A'}
          </p>
          {live && live.party_size > 1 && (
            <p>
              <strong>Players:</strong> {live.party_size}
            </p>
          )}
          <p>
            <strong>Date &amp; Time:</strong> {formatDate(dateTime)}
          </p>
        </div>

        <div style={styles.games}>
          <h2 style={styles.sectionTitle}>Cart Items</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Game</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Price</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item, index) => (
                <tr key={index}>
                  <td style={styles.td}>{item.title}</td>
                  <td style={styles.td}>{item.quantity}</td>
                  <td style={styles.td}>₦{Number(item.price || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {discount > 0 && (
          <p>
            <strong>Discount:</strong> ₦{discount.toFixed(2)}
          </p>
        )}

        <div style={styles.total}>
          <p>
            <strong>Total Amount Paid:</strong> ₦{finalAmount.toFixed(2)}
          </p>
        </div>

        {adminName && (
          <p>
            <strong>Processed by:</strong> {adminName}
          </p>
        )}

        <div style={styles.footer}>
          <p style={styles.thankYou}>Thank you for choosing Immersia VR!</p>
        </div>
      </div>

      <button style={styles.printButton} onClick={printTicket}>
        Print Ticket
      </button>
      <button
        style={styles.homeButton}
        onClick={() => {
          setCart([]);
          navigate('/gameselection');
        }}
      >
        Let's play again
      </button>
    </div>
  );
};

export default Ticket;

const styles = {
  ticketContainer: {
    maxWidth: '800px',
    margin: '20px auto',
    padding: '20px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 0 10px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '18px',
    marginBottom: '15px',
    color: '#333'
  },
  games: {
    marginBottom: '20px',
    padding: '10px'
  },
  total: {
    marginTop: '20px',
    padding: '10px',
    borderTop: '1px solid #ddd'
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '20px'
  },
  details: {
    marginBottom: '20px',
    padding: '10px'
  },
  printButton: {
    padding: '10px 20px',
    margin: '10px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  logo: {
    maxWidth: '200px',
    height: 'auto'
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginTop: '10px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: '20px'
  },
  th: {
    border: '1px solid #ddd',
    padding: '8px',
    textAlign: 'left' as const,
    backgroundColor: '#f4f4f4'
  },
  td: {
    border: '1px solid #ddd',
    padding: '8px'
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '20px',
    borderTop: '1px solid #ddd',
    paddingTop: '10px'
  },
  thankYou: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333'
  },
  homeButton: {
    padding: '10px 20px',
    margin: '10px',
    backgroundColor: '#f0ad4e',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};
