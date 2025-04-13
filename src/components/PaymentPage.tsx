import React from 'react';
import { usePaystackPayment } from 'react-paystack';

interface PaymentPageProps {
  cartTotal: number;
  userDetails: { username: string; phone: string; email?: string };
  paymentMethods: { method: string; amount: number }[];
  onPaymentSuccess: () => void;
}

const PaymentPage: React.FC<PaymentPageProps> = ({ cartTotal, userDetails, paymentMethods, onPaymentSuccess }) => {
  const isCashPayment = paymentMethods.some((method) => method.method === 'cash');

  const handlePayment = () => {
    if (isCashPayment) {
      // If payment method is cash, proceed directly to success
      onPaymentSuccess();
    } else {
      // Otherwise, use Paystack for payment
      initializePayment({ onSuccess, onClose });
    }
  };
  const config = {
    reference: new Date().getTime().toString(),
    email: userDetails.email || '',
    amount: cartTotal * 100, // Paystack expects amount in kobo
    publicKey: `process.env.REACT_APP_PAYSTACK_PUBLIC_KEY`,
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = () => {
    onPaymentSuccess();
  };

  const onClose = () => {
    console.log('Payment closed');
  };

  return (
    <div>
      <h2>Payment</h2>
      <p>Total: ₦{cartTotal}</p>
      <button onClick={handlePayment}>Pay Now</button>
    </div>
  );
};

export default PaymentPage;