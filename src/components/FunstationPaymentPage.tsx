// PaymentPage2.tsx
import React, { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useLocation, useNavigate } from 'react-router-dom';

interface PaymentPageProps {
  finalAmount: number;
  userDetails: {
    id?: string;
        username: string;
        phone: string;
        email?: string;
    };
  cartItems: any[];
  merchantReference?: string;
  dateTime?: string;
  onPaymentSuccess: () => void;
}

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
const { finalAmount, userDetails, cartItems, dateTime } = location.state as PaymentPageProps;
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [transactionId] = useState(uuidv4());
  const [merchantReference] = useState<string>('');

  const handlePayment = async () => {
    try {
      setLoading(true);
      setStatus('Initiating payment on Terminal 2...');

      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/moniepoint/transactions`, {
        amount: finalAmount * 100,
        terminalSerial: process.env.REACT_APP_TERMINAL_SERIAL_FUNSTATION,
        transactionType: 'PURCHASE',
        PaymentMethod: 'FUNSTATION_POS',
        merchantReference: merchantReference || transactionId
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
            const { id, ...safeUserDetails } = userDetails;

    const transactionPayload = {
      ...safeUserDetails,
      reference: uuidv4(),
      merchantReference,
      total_amount: finalAmount * 100, // store in kobo
      discount: 0, 
      discount_description: '',
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

  navigate('/ticket', { state: { finalAmount, userDetails, cartItems, merchantReference, dateTime } });
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
      <h2>Pay with Moniepoint (Terminal 2)</h2>
      {/* ... rest of your JSX */}
    <p>Total: ₦{finalAmount.toLocaleString()}</p>
      <button onClick={handlePayment} disabled={loading}>
        {loading ? 'Processing...' : 'Pay Now via POS'}
      </button>
      <button style={styles.homeButton} onClick={() => navigate('/gameselection', { state: { userDetails, cartItems, finalAmount } })}>
      Edit cart
      </button>
      {status && <p>{status}</p>}
    </div>
  );
};

export default FunstationPaymentPage;
