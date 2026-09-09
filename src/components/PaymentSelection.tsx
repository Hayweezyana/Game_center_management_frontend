import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './PaymentSelection.css';
import './CheckoutExperience.css';

interface PaymentSelectionProps {
  cartTotal: number;
  userDetails: { username: string; phone: string; email?: string };
  cartItems: any[];
  finalAmount?: number;
  discount?: number;
  discountReason?: string;
  isAdmin?: boolean;
  handlePaymentSuccess: () => Promise<void>;
  onMerchantReference?: (merchantReference: string) => void;
}

type Terminal = 'immersia' | 'funstation' | 'paystack' | 'gkg';

/**
 * Fallback list if the backend is unreachable — the counter must never be
 * blocked by a dropdown. The server copy at /v1/acquisition-channels is
 * authoritative so the options can be changed without a redeploy.
 */
const FALLBACK_CHANNELS = [
  'Instagram',
  'Facebook',
  'YouTube',
  'WhatsApp status or broadcast',
  'Google search',
  'TikTok',
  'A friend or family member',
  'Saw the sign / walked in',
  'Event or birthday party',
  "I've been here before",
  'Found it on my own',
  'Other',
];

const RETURNING_CHANNEL = "I've been here before";
const MAX_PARTY_SIZE = 20;

const terminals: Array<{ key: Terminal; title: string; description: string; lane: string; iconClass: string }> = [
  {
    key: 'immersia',
    title: 'Immersia POS',
    description: 'Use physical terminal at Immersia station',
    lane: 'On-Site POS',
    iconClass: 'terminal-icon immersia-icon',
  },
  {
    key: 'funstation',
    title: 'Funstation POS',
    description: 'Use Funstation terminal for card payments',
    lane: 'On-Site POS',
    iconClass: 'terminal-icon funstation-icon',
  },
  {
    key: 'gkg',
    title: 'Go Kart Galaxy POS',
    description: 'Collect payment at GKG terminal',
    lane: 'On-Site POS',
    iconClass: 'terminal-icon gkg-icon',
  },
  {
    key: 'paystack',
    title: 'Paystack Online',
    description: 'Fast online checkout with instant receipt',
    lane: 'Online Gateway',
    iconClass: 'terminal-icon paystack-icon',
  },
];

const PaymentSelection: React.FC<PaymentSelectionProps> = ({
  cartTotal,
  finalAmount = cartTotal,
  userDetails,
  cartItems,
  discount,
  discountReason,
  isAdmin = false,
}) => {
  const navigate = useNavigate();
  const discountedAmount = cartTotal - (discount || 0);

  const [creditEligible, setCreditEligible] = useState(false);
  const [creditChecked, setCreditChecked] = useState(false);

  // How many people share this ticket. Four rounds bought by one player is a
  // queue of four; the same four bought by a family is a single slot — the
  // scheduler cannot estimate a finish time without knowing which.
  //
  // Starts unset rather than at 1: defaulting produces a confidently wrong
  // allocation for every group, which is worse than no answer, and nobody would
  // ever notice they had skipped it.
  const [partySize, setPartySize] = useState<number | null>(null);
  const [partyTouched, setPartyTouched] = useState(false);

  const [channels, setChannels] = useState<string[]>(FALLBACK_CHANNELS);
  const [heardAboutUs, setHeardAboutUs] = useState('');
  const [heardDetail, setHeardDetail] = useState('');
  const [isReturningCustomer, setIsReturningCustomer] = useState(false);
  const [attributionTouched, setAttributionTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/v1/acquisition-channels`)
      .then((res) => {
        const list = res.data?.data;
        if (!cancelled && Array.isArray(list) && list.length) setChannels(list);
      })
      .catch(() => {
        // Keep the fallback list — never block a sale on this.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Regulars have already told us where they heard about us. Asking again on
  // every visit slows the counter and buries the real acquisition channel under
  // a pile of "been here before".
  useEffect(() => {
    const phone = userDetails?.phone;
    if (!phone || phone.length < 10) return;

    let cancelled = false;
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/users/search`, {
        params: { q: phone, limit: 1 },
      })
      .then((res) => {
        const match = Array.isArray(res.data?.data) ? res.data.data[0] : null;
        if (cancelled || !match) return;
        if (Number(match.visits) > 0) {
          setIsReturningCustomer(true);
          setHeardAboutUs((current) => current || RETURNING_CHANNEL);
        }
      })
      .catch(() => {
        // Unknown means treat them as new — asking once too often beats never.
      });

    return () => {
      cancelled = true;
    };
  }, [userDetails?.phone]);

  useEffect(() => {
    const phone = userDetails?.phone;
    if (!phone || phone.length < 10) {
      setCreditChecked(true);
      return;
    }
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/credit/eligible?phone=${encodeURIComponent(phone)}`)
      .then((res) => {
        setCreditEligible(res.data?.data?.eligible === true);
      })
      .catch(() => {
        setCreditEligible(false);
      })
      .finally(() => setCreditChecked(true));
  }, [userDetails?.phone]);

  const needsAttribution = !isReturningCustomer;
  const attributionMissing = needsAttribution && !heardAboutUs;
  const detailMissing = heardAboutUs === 'Other' && !heardDetail.trim();
  const partyMissing = partySize === null;
  const canPay = !partyMissing && !attributionMissing && !detailMissing;

  // Every payment page spreads userDetails straight into its transaction
  // payload, so merging here carries both new fields through all five terminals
  // without touching any of them.
  const navState = {
    finalAmount: discountedAmount,
    userDetails: {
      ...userDetails,
      party_size: partySize,
      heard_about_us: heardAboutUs || null,
      heard_about_us_detail: heardAboutUs === 'Other' ? heardDetail.trim() : null,
    },
    cartItems,
    discount,
    discountReason,
    isAdmin,
  };

  const guardAndGo = (path: string) => {
    if (!canPay) {
      setPartyTouched(true);
      setAttributionTouched(true);
      // Send them to whichever question is unanswered rather than leaving the
      // error off-screen on a phone.
      const anchor = document.getElementById(partyMissing ? 'party-size' : 'heard-about-us');
      anchor?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      anchor?.focus({ preventScroll: true });
      return;
    }
    navigate(path, { state: navState });
  };

  const handleSelectPayment = (terminal: Terminal) => {
    guardAndGo(`/${terminal}paymentpage`);
  };

  const handleCreditPayment = () => {
    guardAndGo('/creditpaymentpage');
  };

  return (
    <div className="checkout-panel">
      <h2>Choose Payment Terminal</h2>

      {isAdmin && discount !== undefined && discount > 0 && (
        <div className="status-banner warn">
          Admin Discount Applied: -N{discount.toLocaleString()}
          {discountReason ? ` | Reason: ${discountReason}` : ''}
        </div>
      )}

      <div className="summary-row">
        <span>Total Amount</span>
        <span className="value">N{finalAmount.toLocaleString()}</span>
      </div>

      <div className="prepay-panel">
        <div className="prepay-field">
          <label htmlFor="party-size">
            How many people are playing on this ticket? <span className="prepay-required">Required</span>
          </label>
          <div className="party-stepper">
            <button
              type="button"
              className="party-btn"
              onClick={() => {
                setPartyTouched(true);
                setPartySize((n) => Math.max(1, (n ?? 1) - 1));
              }}
              disabled={partySize === null || partySize <= 1}
              aria-label="Fewer players"
            >
              −
            </button>
            <input
              id="party-size"
              className={`party-input${partyTouched && partyMissing ? ' party-input-error' : ''}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PARTY_SIZE}
              placeholder="—"
              aria-required="true"
              aria-invalid={partyTouched && partyMissing}
              value={partySize ?? ''}
              onChange={(e) => {
                setPartyTouched(true);
                const raw = e.target.value;
                // Clearing the box returns to unset rather than snapping to 1,
                // so a mistyped number can be corrected without being locked in.
                if (raw.trim() === '') {
                  setPartySize(null);
                  return;
                }
                const next = Number(raw);
                if (!Number.isFinite(next)) return;
                setPartySize(Math.min(MAX_PARTY_SIZE, Math.max(1, Math.round(next))));
              }}
            />
            <button
              type="button"
              className="party-btn"
              onClick={() => {
                setPartyTouched(true);
                setPartySize((n) => Math.min(MAX_PARTY_SIZE, (n ?? 0) + 1));
              }}
              disabled={partySize !== null && partySize >= MAX_PARTY_SIZE}
              aria-label="More players"
            >
              +
            </button>
          </div>
          <p className="prepay-hint">
            {partySize === null
              ? 'Needed to work out when each game starts — count everyone sharing this ticket.'
              : partySize === 1
              ? 'One player — rounds will be played one after another.'
              : `${partySize} players — rounds can run at the same time, so you finish sooner.`}
          </p>
          {partyTouched && partyMissing && (
            <p className="prepay-error">Enter how many people are playing before choosing a terminal.</p>
          )}
        </div>

        <div className="prepay-field">
          <label htmlFor="heard-about-us">
            How did you hear about us?{needsAttribution ? '' : ' (optional)'}
          </label>
          <select
            id="heard-about-us"
            className="prepay-input"
            value={heardAboutUs}
            onChange={(e) => {
              setHeardAboutUs(e.target.value);
              setAttributionTouched(true);
              if (e.target.value !== 'Other') setHeardDetail('');
            }}
          >
            <option value="">Select an option</option>
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>

          {heardAboutUs === 'Other' && (
            <input
              className="prepay-input prepay-detail"
              type="text"
              placeholder="Tell us where"
              maxLength={200}
              value={heardDetail}
              onChange={(e) => setHeardDetail(e.target.value)}
            />
          )}

          {isReturningCustomer && (
            <p className="prepay-hint">Welcome back — we already have this on file.</p>
          )}
          {attributionTouched && attributionMissing && (
            <p className="prepay-error">Please pick an option before choosing a terminal.</p>
          )}
          {attributionTouched && detailMissing && (
            <p className="prepay-error">Let us know where you heard about us.</p>
          )}
        </div>
      </div>

      <div
        className={`terminal-grid payment-options-grid${canPay ? '' : ' payment-options-locked'}`}
      >
        {terminals.map((terminal) => (
          <button className="payment-option terminal-card" key={terminal.key} onClick={() => handleSelectPayment(terminal.key)}>
            <div className={terminal.iconClass} aria-hidden="true" />
            <span className="terminal-pill">{terminal.lane}</span>
            <h3>{terminal.title}</h3>
            <p>{terminal.description}</p>
          </button>
        ))}

        {creditChecked && creditEligible && (
          <button className="payment-option terminal-card credit-card-option" onClick={handleCreditPayment}>
            <div className="terminal-icon credit-icon" aria-hidden="true">📋</div>
            <span className="terminal-pill credit-pill">Deferred Payment</span>
            <h3>Record on Credit</h3>
            <p>Play now, pay later — available for regular customers</p>
          </button>
        )}
      </div>

      <div className="checkout-actions">
        <button className="checkout-btn checkout-btn-secondary" onClick={() => navigate(isAdmin ? '/admin-payment' : '/checkout')}>
          Back to {isAdmin ? 'Admin Checkout' : 'Checkout'}
        </button>
      </div>
    </div>
  );
};

export default PaymentSelection;
