import React from 'react';
import { usePaystackPayment } from 'react-paystack';

interface PaymentPageProps {
  cartTotal: number;
  userDetails: { username: string; phone: string; email?: string };
  // paymentMethods: { method: string; amount: number }[];
  onPaymentSuccess: () => void;
}

const PaymentPage: React.FC<PaymentPageProps> = ({ cartTotal, userDetails, onPaymentSuccess }) => {
  //const isCashPayment = paymentMethods.some((method) => method.method === 'cash');

  const config = {
    reference: new Date().getTime().toString(),
    email: userDetails.email || 'immersiavr@immersiavr.com',
    amount: cartTotal * 100, // Paystack expects amount in kobo
    publicKey: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY!,
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = () => {
    onPaymentSuccess();
  };

  const onClose = () => {
    console.log('Payment window closed');
  };

  const handlePayment = () => {
    // if (isCashPayment) {
    //   onPaymentSuccess(); // Skip online payment
    // } else {
      initializePayment({ onSuccess, onClose }); // Trigger Paystack
    // }
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
