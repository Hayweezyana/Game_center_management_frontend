import React, { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePaystackPayment } from 'react-paystack';
import axios from 'axios';
// TypeScript may not have CSS module declarations in this project setup.
// Ignore the missing module/type declarations for this side-effect import.
// @ts-ignore
import './CheckoutExperience.css';
import { useCartContext } from './hooks/useCart';

const formatNaira = (amount: number) => `N${amount.toLocaleString()}`;

const PaystackPaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCartContext();
  const {
    finalAmount: originalAmount = 0,
    userDetails,
    cartItems = [],
  } = (location.state as any) || {};

  const [adminPassword, setAdminPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [customDiscountReason, setCustomDiscountReason] = useState('');
  const [selectedMarketer, setSelectedMarketer] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const preventDoubleSubmit = useRef(false);
  const finalAmount = Math.max(originalAmount - discountAmount, 0);
  const marketers = ['In House', 'O. Judith', 'Kayode', 'Maxwell'];

  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const handleAdminLogin = async () => {
    try {
      const res = await axios.post(`${backendUrl}/v1/admin/roles/login`, {
        name: username,
        password: adminPassword,
      });
      if (res.status === 200) {
        setIsAdminAuthenticated(true);
        alert('Admin authenticated.');
      }
    } catch {
      alert('Invalid admin credentials.');
    }
  };

  const config = {
    reference: `immersia_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: userDetails?.email || 'customer@immersia.ng',
    amount: finalAmount * 100,
    publicKey: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY!,
    currency: 'NGN',
    metadata: {
      custom_fields: [
        { display_name: 'Username', variable_name: 'username', value: userDetails?.username },
        { display_name: 'Phone',    variable_name: 'phone',    value: userDetails?.phone },
        { display_name: 'Staff',    variable_name: 'staff',    value: selectedMarketer || 'In House' },
      ],
    },
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async (reference: any) => {
    if (preventDoubleSubmit.current) return;
    preventDoubleSubmit.current = true;
    setIsProcessing(true);

    const ref: string = reference?.reference ?? config.reference;
    const resolvedDiscountReason =
      discountReason === 'Others' ? customDiscountReason : discountReason;

    try {
      // ── Step 1: Server-side verification + transaction creation ──────────
      const verifyResponse = await axios.post(
        `${backendUrl}/v1/payments/paystack/verify`,
        {
          reference: ref,
          userDetails,
          cartItems,
          discount: discountAmount,
          discount_description: resolvedDiscountReason,
        }
      );

      if (!verifyResponse.data.success) {
        throw new Error(verifyResponse.data.error || 'Payment verification failed');
      }

      // ── Step 2: Save marketer attribution ──────────────────────────────
      try {
        await axios.post(`${backendUrl}/v1/admin/marketer_payments`, {
          amount: finalAmount,
          marketer: selectedMarketer || 'In House',
          station: 'online',
          payment_method: 'Paystack',
          merchantReference: ref,
        });
      } catch (marketerErr: any) {
        console.error('Marketer record error:', marketerErr.response?.data || marketerErr.message);
      }

      clearCart();

      // ── Step 3: Navigate to ticket ─────────────────────────────────────
      navigate('/ticket', {
        state: {
          finalAmount,
          userDetails,
          cartItems,
          reference: ref,
          discount: discountAmount,
          dateTime: verifyResponse.data.payment?.paid_at ?? new Date().toISOString(),
        },
      });

      // The play schedule is built server-side the moment the transaction is
      // saved, so there is no longer a separate queue insert to fire here.
    } catch (error: any) {
      console.error('Payment processing error:', error);
      alert(
        error.response?.data?.error ||
        error.message ||
        'Payment received but finalizing failed. Contact admin with reference: ' + ref
      );
    } finally {
      setIsProcessing(false);
      preventDoubleSubmit.current = false;
    }
  };

  const handlePayment = () => {
    if (finalAmount <= 0) return alert('Amount must be greater than 0.');
    if (discountAmount > 0 && !discountReason) return alert('A reason is required for the discount.');
    initializePayment({ onSuccess, onClose: () => console.log('Closed') });
  };

  return (
    <div className="checkout-shell">
      <div className="payment-page-shell">
        <div className="payment-page-header">
          <h1>Paystack Checkout</h1>
          <p>Payment is verified server-side before the booking is confirmed.</p>
        </div>

        <div className="payment-page-body">
          <div className="checkout-panel">
            <h3>Staff Attribution</h3>
            <div className="checkout-field">
              <label>Staff</label>
              <select className="checkout-select" value={selectedMarketer} onChange={(e) => setSelectedMarketer(e.target.value)}>
                <option value="">In House</option>
                {marketers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {!isAdminAuthenticated ? (
            <div className="checkout-panel">
              <h3>Admin Authorization (Discount Control)</h3>
              <div className="checkout-field-grid">
                <div className="checkout-field">
                  <label>Admin Username</label>
                  <input className="checkout-input" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div className="checkout-field">
                  <label>Admin Password</label>
                  <input className="checkout-input" type="password" placeholder="Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                </div>
              </div>
              <div className="checkout-actions">
                <button className="checkout-btn checkout-btn-secondary" onClick={handleAdminLogin}>
                  Unlock Discount
                </button>
              </div>
            </div>
          ) : (
            <div className="checkout-panel">
              <h3>Apply Discount</h3>
              <div className="checkout-field-grid">
                <div className="checkout-field">
                  <label>Discount Amount (N)</label>
                  <input className="checkout-input" type="number" placeholder="Amount" onChange={(e) => setDiscountAmount(Number(e.target.value))} />
                </div>
                <div className="checkout-field">
                  <label>Reason</label>
                  <select className="checkout-select" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}>
                    <option value="">Reason…</option>
                    <option value="Promo">Promo</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>
              {discountReason === 'Others' && (
                <div className="checkout-field">
                  <label>Custom Reason</label>
                  <input className="checkout-input" placeholder="Describe reason" onChange={(e) => setCustomDiscountReason(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <div className="checkout-panel">
            <h3>Order Summary</h3>
            <p>Player: {userDetails?.username} ({userDetails?.phone})</p>
            <div className="summary-row">
              <span>Total Payable</span>
              <span className="value">{formatNaira(finalAmount)}</span>
            </div>
            {isProcessing && (
              <p style={{ color: '#22c55e', marginTop: 8 }}>Verifying payment with Paystack…</p>
            )}
            <div className="checkout-actions">
              <button className="checkout-btn checkout-btn-primary" onClick={handlePayment} disabled={isProcessing}>
                {isProcessing ? 'Processing…' : 'Pay with Paystack'}
              </button>
              <button
                className="checkout-btn checkout-btn-secondary"
                onClick={() => navigate('/gameselection', { state: { userDetails, cartItems, finalAmount } })}
                disabled={isProcessing}
              >
                Edit Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaystackPaymentPage;
