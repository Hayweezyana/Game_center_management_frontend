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

const ImmersiaPaymentPage: React.FC<PaymentPageProps> = ({ onPaymentSuccess }) => {
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
const { finalAmount, userDetails, cartItems} = location.state || {};
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [transactionId] = useState(uuidv4());
  const [merchantReference] = useState<string>('');

  const handlePayment = async () => {
    try {
      setLoading(true);
      setStatus('Initiating payment on Terminal 1...');

      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/moniepoint/transactions`, {
        amount: finalAmount * 100,
        terminalSerial: process.env.REACT_APP_TERMINAL_SERIAL_IMMERSIA, // Different terminal serial for Immersia
        transactionType: 'PURCHASE',
        PaymentMethod: 'IMMERSIA_POS',
        merchantReference: merchantReference || transactionId
      });

      if (response.status === 202) {
        setStatus('Awaiting payment on POS terminal 1...');
        pollTransactionStatus(merchantReference || transactionId);  
      } else {
        setStatus('Payment initiation failed. Try again.');
      }
    } catch (error: any) {
      console.error('Error initiating payment:', error.response?.data || error.message);
      setStatus('Error initiating transaction on Terminal 1');
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
      discount: 0, // or apply discount logic if any
      discount_description: '',
      cartItems,
      payment_methods: [{ method: 'Immersia_Moniepoint', amount: finalAmount }],
      game_time_slot: null, // set if applicable
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

  navigate('/ticket', { state: { finalAmount, userDetails, cartItems, merchantReference, dateTime: new Date().toISOString()
 } });
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
      <style>{spinnerKeyframes}</style>
      <h1>Immersia Payment</h1>
      <h2>Pay with Moniepoint (Terminal 1)</h2>
      {/* ... rest of your JSX */}
    <p>Total: ₦{finalAmount.toLocaleString()}</p>
      <button onClick={handlePayment} disabled={loading || status?.includes('Awaiting')}>
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
  );
};

export default ImmersiaPaymentPage;

const spinnerStyle = {
    width: '16px',
    height: '16px',
    border: '2px solid #f3f3f3',
    borderTop: '2px solid #3498db',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginRight: '8px'
};

const spinnerKeyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
