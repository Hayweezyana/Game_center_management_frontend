import React, { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePaystackPayment } from 'react-paystack';
import axios from 'axios';
import './CheckoutExperience.css';
import { useCartContext } from './hooks/useCart';

interface CartItem {
  id: number;
  gameDuration: number;
  quantity: number;
  title: string;
}

const formatNaira = (amount: number) => `N${amount.toLocaleString()}`;

const PaystackPaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCartContext();
  const { finalAmount: originalAmount = 0, userDetails, cartItems = [] } = (location.state as any) || {};

  const [adminPassword, setAdminPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [customDiscountReason, setCustomDiscountReason] = useState('');
  const [selectedMarketer, setSelectedMarketer] = useState('');
  const [hasSavedPaymentRecord, setHasSavedPaymentRecord] = useState(false);

  const isProcessing = useRef(false);
  const finalAmount = Math.max(originalAmount - discountAmount, 0);
  const marketers = ['In House', 'O. Timileyin', 'O. Judith', 'Damilola', 'Saviour', 'E. Success', 'K. Ese'];

  const savePaymentRecord = async (amount: number, method: string, merchantRef: string) => {
    if (hasSavedPaymentRecord) return;
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/marketer_payments`, {
        amount: Number(amount),
        marketer: selectedMarketer || 'In House',
        station: 'online',
        payment_method: method,
        merchantReference: merchantRef,
      });
      setHasSavedPaymentRecord(true);
    } catch (err: any) {
      console.error('Marketer record error:', err.response?.data || err.message);
    }
  };

  const handleAdminLogin = async () => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/login`, {
        name: username,
        password: adminPassword,
      });
      if (res.status === 200) {
        setIsAdminAuthenticated(true);
        alert('Admin authenticated.');
      }
    } catch (_err: any) {
      alert('Invalid admin credentials.');
    }
  };

  const config = {
    reference: new Date().getTime().toString(),
    email: userDetails?.email || 'customer@example.com',
    amount: finalAmount * 100,
    publicKey: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY!,
    currency: 'NGN',
    metadata: {
      custom_fields: [
        { display_name: 'Username', variable_name: 'username', value: userDetails?.username },
        { display_name: 'Phone', variable_name: 'phone', value: userDetails?.phone },
      ],
    },
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async (reference: any) => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    try {
      const paidAt = new Date().toISOString();

      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`, {
        ...userDetails,
        reference: reference.reference,
        payment_methods: [{ method: 'Paystack', amount: finalAmount }],
        cartItems,
        discount: discountAmount,
        discount_description: discountReason === 'Others' ? customDiscountReason : discountReason,
      });

      await savePaymentRecord(finalAmount, 'Paystack', reference.reference);
      clearCart();

      navigate('/ticket', {
        state: {
          finalAmount,
          userDetails,
          cartItems,
          reference: reference.reference,
          discount: discountAmount,
          dateTime: paidAt,
        },
      });

      void Promise.all(
        cartItems.map((item: CartItem) =>
          axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/queue/add`, {
            game_id: item.id,
            user_id: userDetails.id,
            username: userDetails.username,
            game_duration: item.gameDuration,
            quantity: item.quantity,
            game_title: item.title,
          })
        )
      ).catch((queueError) => {
        console.error('Queue insertion failed after receipt navigation:', queueError);
      });
    } catch (error) {
      console.error('Finalization error:', error);
      alert('Payment successful, but failed to update records. Please contact admin.');
    } finally {
      isProcessing.current = false;
    }
  };

  const handlePayment = () => {
    if (finalAmount <= 0) return alert('Amount must be greater than 0.');
    if (discountAmount > 0 && !discountReason) return alert('Reason required for discount.');

    initializePayment({ onSuccess, onClose: () => console.log('Closed') });
  };

  return (
    <div className="checkout-shell">
      <div className="payment-page-shell">
        <div className="payment-page-header">
          <h1>Paystack Checkout</h1>
          <p>Online payment with instant receipt and automatic queue update.</p>
        </div>

        <div className="payment-page-body">
          <div className="checkout-panel">
            <h3>Staff Attribution</h3>
            <div className="checkout-field">
              <label>Staff</label>
              <select className="checkout-select" value={selectedMarketer} onChange={(e) => setSelectedMarketer(e.target.value)}>
                <option value="">In House</option>
                {marketers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
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
                  <input
                    className="checkout-input"
                    type="password"
                    placeholder="Password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
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
                  <input
                    className="checkout-input"
                    type="number"
                    placeholder="Amount"
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  />
                </div>
                <div className="checkout-field">
                  <label>Reason</label>
                  <select className="checkout-select" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}>
                    <option value="">Reason...</option>
                    <option value="Promo">Promo</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>
              {discountReason === 'Others' && (
                <div className="checkout-field">
                  <label>Custom Reason</label>
                  <input
                    className="checkout-input"
                    placeholder="Describe reason"
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
              <span>Total Payable</span>
              <span className="value">{formatNaira(finalAmount)}</span>
            </div>
            <div className="checkout-actions">
              <button className="checkout-btn checkout-btn-primary" onClick={handlePayment}>
                Pay with Paystack
              </button>
              <button
                className="checkout-btn checkout-btn-secondary"
                onClick={() => navigate('/gameselection', { state: { userDetails, cartItems, finalAmount } })}
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
