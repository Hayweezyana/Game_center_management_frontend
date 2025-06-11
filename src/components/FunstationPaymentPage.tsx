// PaymentPage2.tsx
import React, { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useLocation, useNavigate } from 'react-router-dom';

interface PaymentPageProps {
  finalAmount: number;
  userDetails: {
        username: string;
        phone: string;
        email?: string;
    };
  cartItems: any[];
  merchantReference?: string;
  dateTime?: string;
  onPaymentSuccess: () => void;
}

const spinnerKeyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const FunstationPaymentPage: React.FC<PaymentPageProps> = ({ onPaymentSuccess }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const styles = {
    homeButton: {
      margin: '10px',
      padding: '8px 16px',
      backgroundColor: '#f0f0f0',
      border: '1px solid #ddd',
      borderRadius: '4px',
      cursor: 'pointer'
    }
  };
const { finalAmount: originalAmount, userDetails, cartItems } = location.state || {};
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [transactionId] = useState(uuidv4());
  const [merchantReference] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState('');
  const [username, setUsername] = useState('');
const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
const [discountWarning, setDiscountWarning] = useState('');

const [discountAmount, setDiscountAmount] = useState(0);
const finalAmount = Math.max(originalAmount - discountAmount, 0);
const [discountReason, setDiscountReason] = useState('');
const [customDiscountReason, setCustomDiscountReason] = useState('');

const handleAdminLogin = async () => {
  try {
    const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/login`, {
      name: username,
      password: adminPassword
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

    const { token, role } = res.data;
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('adminData', JSON.stringify(role));

    if (res.status === 200) {
      setIsAdminAuthenticated(true);
      alert("Admin authenticated successfully.");
    }
  } catch (err: any) {
    alert("Invalid admin password.");
    console.error(err.response?.data || err.message);
  }
};


  const handlePayment = async () => {
    try {
      setLoading(true);
      setStatus('Initiating payment on Terminal 2...');

      if (discountAmount > 0 && (!discountReason || (discountReason === 'Others' && customDiscountReason.trim() === ''))) {
      alert("Please select or enter a valid discount reason");
      return;
    }

      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/moniepoint/transactions`, {
        amount: finalAmount * 100,
        terminalSerial: process.env.REACT_APP_TERMINAL_SERIAL_FUNSTATION,
        transactionType: 'PURCHASE',
        PaymentMethod: 'FUNSTATION_POS',
        merchantReference: merchantReference || transactionId,
        provider_metadata: { 
        username: userDetails.username,
        phone: userDetails.phone,
        email: userDetails.email
        }
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
  

  const pollTransactionStatus = (merchantReference: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/v1/admin/moniepoint/${merchantReference}`
        );
        const status = res.data?.processingStatus;

        if (status === 'PROCESSED') {
          clearInterval(interval);
          setStatus('Payment successful!');

          try {
    const transactionPayload = {
      ...userDetails,
      reference: uuidv4(),
      merchantReference,
      discount: discountAmount,
      discount_description: discountReason === 'Others' ? customDiscountReason : discountReason,
      cartItems,
      payment_methods: [{ method: 'Funstation_Moniepoint', amount: finalAmount,
 }],
      game_time_slot: null,
    };

    const txnRes = await axios.post(
      `${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`,
      transactionPayload
    );

    console.log("Transaction saved:", txnRes.data);
  } catch (err: any) {
    console.error("Failed to save transaction:", err.response?.data || err.message);
    setStatus('Payment succeeded but saving transaction failed');
  }

          onPaymentSuccess();

  navigate('/ticket', { state: { finalAmount, userDetails, cartItems, merchantReference, dateTime: new Date().toISOString(), discount: discountAmount } });
}

else if (status === 'CANCELLED') {
  clearInterval(interval);
  setStatus('Payment cancelled');
}
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000);
  };

  return (
    <div>
      {!isAdminAuthenticated && (
        <div>
    <input
    type="name"
    placeholder="username"
    value={username}
    onChange={(e) => setUsername(e.target.value)}
    />
    <input
      type="password"
      placeholder="Enter admin password"
      value={adminPassword}
      onChange={(e) => setAdminPassword(e.target.value)}
    />
    <button onClick={handleAdminLogin}>Login as Admin</button>
  </div>
)}

{isAdminAuthenticated && (
  <div>
    <h3>Apply Discount</h3>
    <input
      type="number"
      placeholder="Discount amount (₦)"
      value={discountAmount}
      onChange={(e) => {
          const value = parseInt(e.target.value, 10) || 0;
      setDiscountAmount(value);
      if (value > 0 && discountReason.trim() === '') {
        setDiscountWarning('Please select or enter a discount reason.');
      } else {
        setDiscountWarning('');
      }
    }}
  />
    <select
      value={discountReason}
      onChange={(e) => {
        setDiscountReason(e.target.value);
      if (discountAmount > 0 && e.target.value.trim() === '') {
        setDiscountWarning('Please select or enter a discount reason.');
      } else {
        setDiscountWarning('');
      }
    }}
    >
      <option value="">Select Discount Reason</option>
      <option value="Promo">Promo</option>
      <option value="Customer Request">Customer Request</option>
      <option value="Others">Others</option>
    </select>
        {discountReason === 'Others' && (
          <input
            type="text"
            placeholder="Enter custom discount reason"
            value={customDiscountReason}
            onChange={(e) => {
              
  setCustomDiscountReason(e.target.value);
  if (discountReason === 'Others' && discountAmount > 0 && e.target.value.trim() === '') {
    setDiscountWarning('Please enter a custom discount reason.');
  } else {
    setDiscountWarning('');
  }
}}
      />
    )}
    {discountWarning && (
      <p style={{ color: 'red', fontWeight: 'bold' }}>{discountWarning}</p>
        )}
      </div>
    )}
    <div>
          <style>{spinnerKeyframes}</style>
      <h1>Funstation Payment</h1>
      <h2>Pay with Moniepoint (Terminal 2)</h2>
      {/* ... rest of your JSX */}
    <p>
  <strong>Total:</strong>{' '}
  {discountAmount > 0 ? (
    <>
      <span style={{ textDecoration: 'line-through', color: 'gray' }}>
        ₦{originalAmount.toLocaleString()}
      </span>{' '}
      <span style={{ color: 'green' }}>
        ₦{finalAmount.toLocaleString()}
      </span>
    </>
  ) : (
    <>₦{originalAmount.toLocaleString()}</>
  )}
</p>

      <button onClick={handlePayment} disabled={loading || status?.includes('Awaiting') || (discountAmount > 0 && discountReason.trim() === '')}>
  {(loading || status?.includes('Awaiting')) && (
    <span style={spinnerStyle}></span>
  )}
         {loading ? 'Processing...' : status?.includes('Awaiting') ? 'Awaiting POS...' : 'Pay Now via POS'}
</button>
      <button style={styles.homeButton} onClick={() => navigate('/gameselection', { state: { userDetails, cartItems, finalAmount } })}>
      Edit cart
      </button>
      {status && <p>{status}</p>}
    </div>
    </div>
  );
};

export default FunstationPaymentPage;

const spinnerStyle = {
    width: '16px',
    height: '16px',
};

