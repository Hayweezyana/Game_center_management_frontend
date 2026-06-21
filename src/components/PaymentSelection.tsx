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

  const navState = {
    finalAmount: discountedAmount,
    userDetails,
    cartItems,
    discount,
    discountReason,
    isAdmin,
  };

  const handleSelectPayment = (terminal: Terminal) => {
    navigate(`/${terminal}paymentpage`, { state: navState });
  };

  const handleCreditPayment = () => {
    navigate('/creditpaymentpage', { state: navState });
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

      <div className="terminal-grid payment-options-grid">
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
