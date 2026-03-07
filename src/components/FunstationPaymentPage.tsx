import React, { useRef, useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  extractApprovedAmountKobo,
  isFailurePosStatus,
  isSuccessPosStatus,
  normalizePosStatus,
} from './utils/moniepointStatus';
import './CheckoutExperience.css';
import { useCartContext } from './hooks/useCart';

const formatNaira = (amount: number) => `N${amount.toLocaleString()}`;
const isValidEmail = (email?: string) => Boolean(email && /\S+@\S+\.\S+/.test(email));
const getApiErrorMessage = (error: any) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  (typeof error?.response?.data?.details === 'string' ? error.response.data.details : '') ||
  error?.message ||
  'Request failed';

const FunstationPaymentPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useCartContext();
  const { finalAmount: originalAmount = 0, userDetails, cartItems } = (location.state as any) || {};

  const [hasSavedPaymentRecord, setHasSavedPaymentRecord] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [transactionId] = useState(uuidv4());
  const [merchantReference] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [customDiscountReason, setCustomDiscountReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'POS' | 'Funstation_CASH'>('POS');
  const [selectedMarketer, setSelectedMarketer] = useState('');

  const isProcessing = useRef(false);
  const finalAmount = paymentMethod === 'Funstation_CASH' ? originalAmount : Math.max(originalAmount - discountAmount, 0);
  const marketers = ['In House', 'Kayode', 'O. Judith'];

  const savePaymentRecord = async (amount: number, method: string, merchantRef: string) => {
    if (hasSavedPaymentRecord || isProcessing.current) return;
    isProcessing.current = true;
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/marketer_payments`, {
        amount: Number(amount),
        marketer: selectedMarketer,
        station: 'funstation',
        payment_method: method,
        merchantReference: merchantRef || transactionId,
      });
      setHasSavedPaymentRecord(true);
    } catch (err: any) {
      console.error('Failed to save payment record:', err.response?.data || err.message);
    } finally {
      isProcessing.current = false;
    }
  };

  const handleAdminLogin = async () => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/login`, {
        name: username,
        password: adminPassword,
      });
      const { token, role } = res.data;
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('adminData', JSON.stringify(role));
      setIsAdminAuthenticated(true);
      alert('Admin authenticated successfully.');
    } catch (err: any) {
      alert('Invalid admin password.');
      console.error(err.response?.data || err.message);
    }
  };

  const handlePOSPayment = async () => {
    if (!selectedMarketer) return alert('Please select a staff before proceeding');
    if (finalAmount <= 0) return alert('Amount must be greater than zero.');
    if (discountAmount > 0 && (!discountReason || (discountReason === 'Others' && customDiscountReason.trim() === ''))) {
      return alert('Please select or enter a valid discount reason');
    }

    try {
      setLoading(true);
      setStatus('Initiating payment on Funstation terminal...');
      const merchantRef = merchantReference || transactionId;
      const posAmountKobo = Math.round(finalAmount * 100);
      const terminalSerial = process.env.REACT_APP_TERMINAL_SERIAL_FUNSTATION;
      if (!terminalSerial) {
        throw new Error('Funstation terminal serial is not configured.');
      }
      const sanitizedUserDetails = {
        username: userDetails.username,
        phone: userDetails.phone,
        ...(isValidEmail(userDetails.email) ? { email: userDetails.email } : {}),
      };

      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/moniepoint/transactions`, {
        amount: posAmountKobo,
        cartAmountKobo: posAmountKobo,
        terminalSerial,
        transactionType: 'PURCHASE',
        PaymentMethod: 'FUNSTATION_POS',
        merchantReference: merchantRef,
        provider_metadata: {
          username: userDetails.username,
          phone: userDetails.phone,
          ...(isValidEmail(userDetails.email) ? { email: userDetails.email } : {}),
        },
        checkoutPayload: {
          userDetails: sanitizedUserDetails,
          cartItems,
          discount: discountAmount,
          discount_description: discountReason === 'Others' ? customDiscountReason : discountReason,
          payment_method: 'Funstation_Moniepoint',
        },
      });

      if (response.status === 202 || response.status === 200) {
        setStatus('Awaiting payment on POS terminal...');
        pollTransactionStatus(merchantRef);
      } else {
        setStatus('Payment initiation failed. Try again.');
      }
    } catch (error: any) {
      const msg = getApiErrorMessage(error);
      console.error('Error initiating payment:', error.response?.data || error.message);
      setStatus(`Error initiating transaction on terminal: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCashPayment = async () => {
    if (!selectedMarketer) return alert('Please select a staff before proceeding');
    try {
      setLoading(true);
      setStatus('Recording cash payment...');
      const transactionPayload = {
        ...userDetails,
        reference: uuidv4(),
        merchantReference: transactionId,
        discount: 0,
        discount_description: '',
        cartItems,
        payment_methods: [{ method: 'Funstation_CASH', amount: finalAmount }],
        game_time_slot: null,
      };

      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`, transactionPayload);
      await savePaymentRecord(finalAmount, 'Cash', transactionId);
      clearCart();

      navigate('/ticket', {
        state: {
          finalAmount,
          userDetails,
          cartItems,
          merchantReference: transactionId,
          dateTime: new Date().toISOString(),
          discount: 0,
        },
      });
    } catch (err: any) {
      console.error('Cash transaction failed:', err.response?.data || err.message);
      setStatus('Failed to record cash transaction.');
    } finally {
      setLoading(false);
    }
  };

  const pollTransactionStatus = (merchantRef: string) => {
    let pollTimeout: NodeJS.Timeout;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/moniepoint/${merchantRef}`);
        const txStatus = normalizePosStatus(res.data?.processingStatus || res.data?.internalStatus);
        const approvedAmountKobo = extractApprovedAmountKobo(res.data);
        const expectedAmountKobo = Math.round(finalAmount * 100);

        if (isSuccessPosStatus(txStatus)) {
          if (
            res.data?.amountMatches === false ||
            (approvedAmountKobo !== null && approvedAmountKobo !== expectedAmountKobo)
          ) {
            clearInterval(interval);
            clearTimeout(pollTimeout);
            setStatus('Amount mismatch detected between POS and cart total. Transaction not saved.');
            return;
          }

          await savePaymentRecord(finalAmount, 'POS', merchantRef);
          clearInterval(interval);
          clearTimeout(pollTimeout);
          setStatus('Payment successful!');

          if (!res.data?.applicationTransactionSaved) {
            const transactionPayload = {
              ...userDetails,
              reference: uuidv4(),
              merchantReference: merchantRef,
              discount: discountAmount,
              discount_description: discountReason === 'Others' ? customDiscountReason : discountReason,
              cartItems,
              payment_methods: [{ method: 'Funstation_Moniepoint', amount: finalAmount }],
              game_time_slot: null,
            };
            await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`, transactionPayload);
          }

          clearCart();
          navigate('/ticket', {
            state: {
              finalAmount,
              userDetails,
              cartItems,
              merchantReference: merchantRef,
              dateTime: new Date().toISOString(),
              discount: discountAmount,
            },
          });
        } else if (isFailurePosStatus(txStatus)) {
          clearInterval(interval);
          clearTimeout(pollTimeout);
          setStatus(`Payment not completed (${txStatus}).`);
        } else {
          setStatus(`Awaiting payment... Current status: ${txStatus || 'PENDING'}`);
        }
      } catch (err: any) {
        console.error('Polling error:', err?.response?.data || err?.message || err);
        setStatus('Temporary network delay while verifying payment. Retrying...');
      }
    }, 5000);

    pollTimeout = setTimeout(() => {
      clearInterval(interval);
      setStatus(
        'Payment verification is taking longer than expected. Transaction remains pending and will be reconciled automatically.'
      );
    }, 600000);
  };

  return (
    <div className="checkout-shell">
      <div className="payment-page-shell">
        <div className="payment-page-header">
          <h1>Funstation Payment</h1>
          <p>POS and cash collection with transaction reconciliation.</p>
        </div>
        <div className="payment-page-body">
          <div className="checkout-panel">
            <h3>Payment Route</h3>
            <div className="checkout-field">
              <label>Select Staff</label>
              <select className="checkout-select" value={selectedMarketer} onChange={(e) => setSelectedMarketer(e.target.value)}>
                <option value="">-- Select Staff --</option>
                {marketers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="checkout-actions">
              <button className="checkout-btn checkout-btn-secondary" onClick={() => setPaymentMethod('POS')}>
                POS
              </button>
              <button className="checkout-btn checkout-btn-secondary" onClick={() => setPaymentMethod('Funstation_CASH')}>
                Cash
              </button>
            </div>
            {paymentMethod === 'Funstation_CASH' && <div className="status-banner warn">Cash mode selected. Discounts are disabled.</div>}
          </div>

          {paymentMethod === 'POS' && !isAdminAuthenticated && (
            <div className="checkout-panel">
              <h3>Admin Authorization</h3>
              <div className="checkout-field-grid">
                <div className="checkout-field">
                  <label>Admin Username</label>
                  <input className="checkout-input" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div className="checkout-field">
                  <label>Admin Password</label>
                  <input
                    className="checkout-input"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="checkout-actions">
                <button className="checkout-btn checkout-btn-secondary" onClick={handleAdminLogin}>
                  Login as Admin
                </button>
              </div>
            </div>
          )}

          {paymentMethod === 'POS' && isAdminAuthenticated && (
            <div className="checkout-panel">
              <h3>Apply Discount</h3>
              <div className="checkout-field-grid">
                <div className="checkout-field">
                  <label>Discount Amount (N)</label>
                  <input
                    className="checkout-input"
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div className="checkout-field">
                  <label>Reason</label>
                  <select className="checkout-select" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}>
                    <option value="">Select Discount Reason</option>
                    <option value="Promo">Promo</option>
                    <option value="Staff Discount">Staff Discount</option>
                    <option value="Regular Customer">Regular Customer</option>
                    <option value="Cash Payment">Cash Payment</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>
              {discountReason === 'Others' && (
                <div className="checkout-field">
                  <label>Custom Reason</label>
                  <input
                    className="checkout-input"
                    type="text"
                    value={customDiscountReason}
                    onChange={(e) => setCustomDiscountReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="checkout-panel">
            <h3>Order Summary</h3>
            <p>
              Player: {userDetails?.username} ({userDetails?.phone})
            </p>
            <div className="summary-row">
              <span>Total</span>
              <span className="value">{formatNaira(finalAmount)}</span>
            </div>
            <div className="checkout-actions">
              {paymentMethod === 'POS' ? (
                <button className="checkout-btn checkout-btn-primary" onClick={handlePOSPayment} disabled={loading || status?.includes('Awaiting')}>
                  {loading ? 'Processing...' : 'Pay Now via POS'}
                </button>
              ) : (
                <button className="checkout-btn checkout-btn-primary" onClick={handleCashPayment} disabled={loading}>
                  {loading ? 'Processing...' : 'Confirm Cash Payment'}
                </button>
              )}
              <button
                className="checkout-btn checkout-btn-secondary"
                onClick={() => navigate('/gameselection', { state: { userDetails, cartItems, finalAmount } })}
              >
                Edit Cart
              </button>
            </div>
          </div>

          {status && <div className="status-banner">{status}</div>}
        </div>
      </div>
    </div>
  );
};

export default FunstationPaymentPage;
