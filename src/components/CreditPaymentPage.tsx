import React, { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useLocation, useNavigate } from 'react-router-dom';
import './CheckoutExperience.css';
import { useCartContext } from './hooks/useCart';
import { parseAdminRole, canGiveDiscount, getMaxDiscount } from '../utils/adminPermissions';

const formatNaira = (amount: number) => `N${amount.toLocaleString()}`;

const CreditPaymentPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useCartContext();
  const { finalAmount: originalAmount = 0, userDetails, cartItems } = (location.state as any) || {};

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [maxDiscount, setMaxDiscount] = useState<number | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [customDiscountReason, setCustomDiscountReason] = useState('');

  const finalAmount = Math.max(originalAmount - discountAmount, 0);

  const handleAdminLogin = async () => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/login`, {
        name: adminUsername,
        password: adminPassword,
      });
      const { token, role } = res.data;
      sessionStorage.setItem('token', token);

      let fullRole = role;
      try {
        const fullRes = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/${role.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        fullRole = fullRes.data?.data ?? role;
      } catch {}

      sessionStorage.setItem('adminData', JSON.stringify(fullRole));
      const parsed = parseAdminRole(fullRole);

      if (!canGiveDiscount(parsed)) {
        alert('This admin role is not permitted to apply discounts.');
        return;
      }

      setMaxDiscount(getMaxDiscount(parsed));
      setIsAdminAuthenticated(true);
    } catch {
      alert('Invalid admin credentials.');
    }
  };

  const handleConfirm = async () => {
    if (discountAmount > 0 && (!discountReason || (discountReason === 'Others' && !customDiscountReason.trim()))) {
      return alert('Please select or enter a discount reason.');
    }

    try {
      setLoading(true);
      setStatus('Recording credit transaction...');

      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`, {
        ...userDetails,
        reference: uuidv4(),
        merchantReference: uuidv4(),
        cartItems,
        discount: discountAmount,
        discount_description: discountReason === 'Others' ? customDiscountReason : discountReason,
        discount_given_by: discountAmount > 0 ? adminUsername : undefined,
        discount_given_by_role: discountAmount > 0
          ? (() => {
              try { return JSON.parse(sessionStorage.getItem('adminData') || '{}')?.name || null; }
              catch { return null; }
            })()
          : undefined,
        payment_methods: [{ method: 'CREDIT', amount: finalAmount }],
      });

      clearCart();
      navigate('/ticket', {
        state: {
          finalAmount,
          userDetails,
          cartItems,
          dateTime: new Date().toISOString(),
          discount: discountAmount,
          paymentNote: 'Recorded on credit — payment due later',
        },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to record transaction';
      setStatus(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-shell">
      <div className="payment-page-shell">
        <div className="payment-page-header">
          <h1>Record on Credit</h1>
          <p>Games will be recorded now. Customer pays later.</p>
        </div>

        <div className="payment-page-body">
          <div className="checkout-panel">
            <h3>Customer</h3>
            <p>{userDetails?.username} &mdash; {userDetails?.phone}</p>
          </div>

          {!isAdminAuthenticated && (
            <div className="checkout-panel">
              <h3>Admin Authorization <span style={{ fontWeight: 'normal', fontSize: '0.85em', color: '#888' }}>(optional — required for discount)</span></h3>
              <div className="checkout-field-grid">
                <div className="checkout-field">
                  <label>Admin Username</label>
                  <input className="checkout-input" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} />
                </div>
                <div className="checkout-field">
                  <label>Admin Password</label>
                  <input className="checkout-input" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                </div>
              </div>
              <div className="checkout-actions">
                <button className="checkout-btn checkout-btn-secondary" onClick={handleAdminLogin}>Login for Discount</button>
              </div>
            </div>
          )}

          {isAdminAuthenticated && (
            <div className="checkout-panel">
              <h3>Apply Discount</h3>
              <div className="checkout-field-grid">
                <div className="checkout-field">
                  <label>
                    Discount Amount (N)
                    {maxDiscount !== null && (
                      <span style={{ fontWeight: 'normal', color: '#e07b00', marginLeft: 8 }}>— max ₦{maxDiscount.toLocaleString()}</span>
                    )}
                  </label>
                  <input
                    className="checkout-input"
                    type="number"
                    min={0}
                    max={maxDiscount !== null ? Math.min(originalAmount, maxDiscount) : originalAmount}
                    value={discountAmount}
                    onChange={(e) => {
                      let v = parseInt(e.target.value, 10) || 0;
                      if (maxDiscount !== null) v = Math.min(v, maxDiscount);
                      setDiscountAmount(v);
                    }}
                  />
                </div>
                <div className="checkout-field">
                  <label>Reason</label>
                  <select className="checkout-select" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}>
                    <option value="">Select Reason</option>
                    <option value="Promo">Promo</option>
                    <option value="Staff Discount">Staff Discount</option>
                    <option value="Regular Customer">Regular Customer</option>
                    <option value="Credit Customer">Credit Customer</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>
              {discountReason === 'Others' && (
                <div className="checkout-field">
                  <label>Custom Reason</label>
                  <input className="checkout-input" value={customDiscountReason} onChange={(e) => setCustomDiscountReason(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <div className="checkout-panel">
            <h3>Order Summary</h3>
            <div className="summary-row">
              <span>Subtotal</span>
              <span className="value">{formatNaira(originalAmount)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="summary-row">
                <span>Discount</span>
                <span className="value" style={{ color: '#e07b00' }}>- {formatNaira(discountAmount)}</span>
              </div>
            )}
            <div className="summary-row">
              <span><strong>Amount Owed</strong></span>
              <span className="value"><strong>{formatNaira(finalAmount)}</strong></span>
            </div>
            <div className="status-banner warn" style={{ marginTop: 8 }}>
              This amount will be recorded as credit. No payment is collected now.
            </div>
            <div className="checkout-actions">
              <button className="checkout-btn checkout-btn-primary" onClick={handleConfirm} disabled={loading}>
                {loading ? 'Recording...' : 'Confirm — Record on Credit'}
              </button>
              <button className="checkout-btn checkout-btn-secondary" onClick={() => navigate(-1)}>
                Back
              </button>
            </div>
          </div>

          {status && <div className="status-banner">{status}</div>}
        </div>
      </div>
    </div>
  );
};

export default CreditPaymentPage;
