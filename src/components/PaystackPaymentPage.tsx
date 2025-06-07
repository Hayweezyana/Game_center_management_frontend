import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePaystackPayment } from 'react-paystack';
import axios from 'axios';

const styles = {
  homeButton: {
    marginLeft: '10px',
    padding: '8px 16px',
    cursor: 'pointer'
  }
};

const PaystackPaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { finalAmount, userDetails, cartItems } = location.state || {};
  

  const config = {
    reference: new Date().getTime().toString(),
    dateTime: new Date().toISOString(),
    email: userDetails.email || 'immersiavr@immersiavr.com',
    amount: finalAmount * 100, // Paystack expects amount in kobo
    publicKey: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY!,
    currency: 'NGN',

    metadata: {
      custom_fields: [
        {
          display_name: "Username",
          variable_name: "username",
          value: userDetails.username
        },
        {
          display_name: "Phone",
          variable_name: "phone",
          value: userDetails.phone
        },
        {
          display_name: "Transaction ID",
          variable_name: "transactionId",
          value: new Date().getTime().toString()
        }
      ]
    },
  };

  console.log("reference:", config.reference);

  const initializePayment = usePaystackPayment(config);

const onSuccess = async (reference: any) => {
  console.log("Paystack payment successful!", reference)
  try {
    const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`, {
      ...userDetails,
      reference: reference.reference, // from Paystack
      merchantReference: reference.reference, // optional, if using
      payment_methods: [{ method: 'Paystack', amount: finalAmount }],
      cartItems,
      discount: 0,
      discount_description: '', 
    });

    console.log('Submitting transaction:', response.data);
    navigate('/ticket', { state: { finalAmount, userDetails, cartItems, reference: config.reference, dateTime: config.dateTime } });
  } catch (error) {
    console.error('Transaction error:', error);
  }
};

  const onClose = () => {
    console.log('Payment window closed');
  };

  const handlePayment = () => {
    if (!finalAmount || finalAmount <= 0) {
      alert("Invalid cart total. Please go back and try again.");
      return;
    }
    if (!userDetails) {
      alert("Missing user details. Please go back and try again.");
      return;
    }
    if (!process.env.REACT_APP_PAYSTACK_PUBLIC_KEY) {
      alert("Missing Paystack public key in .env.");
      return;
    }
    initializePayment({ onSuccess, onClose }); // Trigger Paystack
  };

  return (
    <div>
      <h2>Payment</h2>
      <span>Total: ₦{finalAmount ? finalAmount.toLocaleString() : 0}</span>
      <p>Username: {userDetails?.username}</p>
      <p>Phone: {userDetails?.phone}</p>
      {userDetails?.email && <p>Email: {userDetails.email}</p>}
      <button onClick={handlePayment}>Pay Now</button>
      <button style={styles.homeButton} onClick={() => navigate('/gameselection', { state: { userDetails, cartItems, finalAmount } })}>
        Edit Cart
      </button>
    </div>
  );
};

export default PaystackPaymentPage;
