// Imports and component boilerplate
import React, { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useLocation, useNavigate } from 'react-router-dom';

const ImmersiaPaymentPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { finalAmount: originalAmount, userDetails, cartItems } = location.state || {};

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
  const [discountWarning, setDiscountWarning] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'POS' | 'Immersia_CASH'>('POS');

  const [selectedMarketer, setSelectedMarketer] = useState('');

  const finalAmount = paymentMethod === 'Immersia_CASH' ? originalAmount : Math.max(originalAmount - discountAmount, 0);

  const marketers = [
    'In House',
    'E. Success',
    'E. Precious',
    'O. Chinedu',
    'K. Ese',
    'Savior',
    'A. Godsaint',
    'O. Timileyin',
    'A. Damilola',
    'A. Precious',
    'O. Judith',
  ];

  const savePaymentRecord = async (amount: number, method: string) => {
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/marketer_payments`, {
        amount: Number(amount),
        marketer: selectedMarketer,
        station: "immersia",
        payment_method: method, 
      });
      console.log("Payment record saved.");
    } catch (err: any) {
      console.error("Failed to save payment record:", err.response?.data || err.message);
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
      alert("Admin authenticated successfully.");
    } catch (err: any) {
      alert("Invalid admin password.");
      console.error(err.response?.data || err.message);
    }
  };

  const handlePOSPayment = async () => {
    if (!selectedMarketer) {
      alert("Please select a staff before proceeding");
      return;
    }
    if (
      discountAmount > 0 &&
      (!discountReason || (discountReason === 'Others' && customDiscountReason.trim() === ''))
    ) {
      alert("Please select or enter a valid discount reason");
      return;
    }

    try {
      setLoading(true);
      setStatus('Initiating payment on Terminal 1...');

      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/moniepoint/transactions`, {
        amount: finalAmount * 100,
        terminalSerial: process.env.REACT_APP_TERMINAL_SERIAL_IMMERSIA,
        transactionType: 'PURCHASE',
        PaymentMethod: 'IMMERSIA_POS',
        merchantReference: merchantReference || transactionId,
        provider_metadata: {
          username: userDetails.username,
          phone: userDetails.phone,
          email: userDetails.email,
        },
      });

      if (response.status === 202) {
        setStatus('Awaiting payment on POS terminal 2...');
        pollTransactionStatus(merchantReference || transactionId);
      } else {
        setStatus('Payment initiation failed. Try again.');
      }
    } catch (error: any) {
      console.error('Error initiating payment:', error.response?.data || error.message);
      setStatus('Error initiating transaction on Terminal 2');
    } finally {
      setLoading(false);
    }
  };

  const handleCashPayment = async () => {
    if (!selectedMarketer) {
      alert("Please select a staff before proceeding");
      return;
    }
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
        payment_methods: [{ method: 'Immersia_CASH', amount: finalAmount }],
        game_time_slot: null,
      };

      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`, transactionPayload);

      await savePaymentRecord(finalAmount, "Cash");

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

  const pollTransactionStatus = (merchantReference: string) => {
    let pollTimeout: NodeJS.Timeout;
    let failedAttempts = 0;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/v1/admin/moniepoint/${merchantReference}`
        );
        const txStatus = res.data?.processingStatus;

        if (txStatus === 'PROCESSED') {
          await savePaymentRecord(finalAmount, "POS");
          clearInterval(interval);
          clearTimeout(pollTimeout);
          setStatus('Payment successful!');

          const transactionPayload = {
            ...userDetails,
            reference: uuidv4(),
            merchantReference,
            discount: discountAmount,
            discount_description: discountReason === 'Others' ? customDiscountReason : discountReason,
            cartItems,
            payment_methods: [{ method: 'Immersia_Moniepoint', amount: finalAmount }],
            provider_metadata: res.data,
            game_time_slot: null,
          };

          await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`, transactionPayload);

          navigate('/ticket', {
            state: {
              finalAmount,
              userDetails,
              cartItems,
              merchantReference,
              dateTime: new Date().toISOString(),
              discount: discountAmount,
            },
          });
        } else if (['CANCELLED', 'FAILED'].includes(txStatus)) {
          failedAttempts++;
          if (failedAttempts >= 2) {
            clearInterval(interval);
            clearTimeout(pollTimeout);
            setStatus('Payment failed or cancelled.');
          } else {
            setStatus(`Temporary issue (${txStatus}). Retrying...`);
          }
        } else {
          setStatus(`Awaiting payment... Current status: ${txStatus}`);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);

    pollTimeout = setTimeout(() => {
      clearInterval(interval);
      setStatus('Payment timed out. Please try again.');
    }, 600000);
  };

  const spinnerStyle = {
    width: '16px',
    height: '16px',
    border: '2px solid #f3f3f3',
    borderTop: '2px solid #3498db',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    display: 'inline-block',
    marginRight: '8px',
  };

  return (
    <div>
      <h1>Immersia Payment</h1>

      {/* ✅ Marketer selection */}
      <div>
        <label>Select Staff: </label>
        <select 
          value={selectedMarketer} 
          onChange={(e) => setSelectedMarketer(e.target.value)}
        >
          <option value="">-- Select Staff --</option>
          {marketers.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Payment Method Toggle */}
      <div>
        <label>
          <input
            type="radio"
            value="POS"
            checked={paymentMethod === 'POS'}
            onChange={() => setPaymentMethod('POS')}
          />
          Pay via POS
        </label>
        <label style={{ marginLeft: '20px' }}>
          <input
            type="radio"
            value="Immersia_CASH"
            checked={paymentMethod === 'Immersia_CASH'}
            onChange={() => setPaymentMethod('Immersia_CASH')}
          />
          Pay with Cash
        </label>

        {paymentMethod === 'Immersia_CASH' && (
    <span style={{ marginLeft: '10px', color: 'red' }}>
      (No Discounts for Cash Payments)
    </span>
  )}
      </div>

      {/* Admin & Discount Section */}
      {paymentMethod === 'POS' && !isAdminAuthenticated && (
        <div>
          <input
            type="text"
            placeholder="Admin username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Admin password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          <button onClick={handleAdminLogin}>Login as Admin</button>
        </div>
      )}

      {paymentMethod === 'POS' && isAdminAuthenticated && (
        <div>
          <h3>Apply Discount</h3>
          <input
            type="number"
            placeholder="Discount amount (₦)"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(parseInt(e.target.value, 10) || 0)}
          />
          <select value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}>
            <option value="">Select Discount Reason</option>
            <option value="Promo">Promo</option>
            <option value="Staff Discount">Staff Discount</option>
            <option value="Regular Customer">Regular Customer</option>
            <option value="Cash Payment">Cash Payment</option>
            <option value="Others">Others</option>
          </select>
          {discountReason === 'Others' && (
            <input
              type="text"
              placeholder="Custom reason"
              value={customDiscountReason}
              onChange={(e) => setCustomDiscountReason(e.target.value)}
            />
          )}
          {discountWarning && <p style={{ color: 'red' }}>{discountWarning}</p>}
        </div>
      )}

      {/* Price Summary */}
      <p>
        <strong>Total:</strong>{' '}
        {discountAmount > 0 && paymentMethod === 'POS' ? (
          <>
            <span style={{ textDecoration: 'line-through', color: 'gray' }}>
              ₦{originalAmount.toLocaleString()}
            </span>{' '}
            <span style={{ color: 'green' }}>₦{finalAmount.toLocaleString()}</span>
          </>
        ) : (
          <>₦{originalAmount.toLocaleString()}</>
        )}
      </p>

      {/* Action Buttons */}
      {paymentMethod === 'POS' ? (
        <button
          onClick={handlePOSPayment}
          disabled={loading || status?.includes('Awaiting')}
        >
          {(loading || status?.includes('Awaiting')) && <span style={spinnerStyle}></span>}
          {loading ? 'Processing...' : 'Pay Now via POS'}
        </button>
      ) : (
        <button onClick={handleCashPayment} disabled={loading}>
          {loading && <span style={spinnerStyle}></span>}
          Confirm Cash Payment
        </button>
      )}

      {/* Edit Cart & Status */}
      <button onClick={() => navigate('/gameselection', { state: { userDetails, cartItems, finalAmount } })}>
        Edit Cart
      </button>

      {status && <p>{status}</p>}
    </div>
  );
};

export default ImmersiaPaymentPage;
