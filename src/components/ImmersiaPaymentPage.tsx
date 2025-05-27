// PaymentPage1.tsx
import React, { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useLocation } from 'react-router-dom';

interface PaymentPageProps {
  cartTotal: number;
  userDetails: {
        username: string;
        phone: string;
        email?: string;
    };
  onPaymentSuccess: () => void;
}

const ImmersiaPaymentPage: React.FC<PaymentPageProps> = ({ onPaymentSuccess }) => {
  const location = useLocation();
  console.log("Location state:", location.state);

const { cartTotal } = location.state as PaymentPageProps;
console.log("cartTotal in PaymentPage:", cartTotal);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [transactionId] = useState(uuidv4());

  const handlePayment = async () => {

    try {
      setLoading(true);
      setStatus('Initiating payment on Terminal 1...');

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/moniepointImmersia/transactions`,
        {
          terminalSerial: process.env.REACT_APP_TERMINAL_SERIAL_IMMERSIA, // Different terminal serial
          merchantReference: transactionId,
          transactionType: 'PURCHASE',
          PaymentMethod: 'CARD_PURCHASE',
          amount: cartTotal * 100,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );

      if (response.status === 202) {
        setStatus('Awaiting payment on POS terminal 1...');
        pollTransactionStatus(transactionId);
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

  // ... rest of the code remains the same as your original PaymentPage
  // Just make sure to update status messages to reference "Terminal 1"
  const pollTransactionStatus = (merchantReference: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/v1/admin/moniepointImmersia/${merchantReference}`
        );
        const status = res.data?.processingStatus;

        if (status === 'PROCESSED') {
          clearInterval(interval);
          setStatus('Payment successful!');
          onPaymentSuccess();
        } else if (status === 'CANCELLED') {
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
      <h2>Pay with Moniepoint (Immersia)</h2>
      {/* ... rest of your JSX */}
      <p>Total: ₦{cartTotal.toLocaleString()}</p>
      <button onClick={handlePayment} disabled={loading}>
        {loading ? 'Processing...' : 'Pay Now via POS'}
      </button>
      {status && <p>{status}</p>}
    </div>
  );
};

export default ImmersiaPaymentPage;
