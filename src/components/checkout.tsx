import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartContext } from './hooks/useCart';
import axios from 'axios';
import './checkout.css';
import './CheckoutExperience.css';
import CartAndPayment from './CartAndPayment';
import UserDetails from './UserDetails';
import PaymentSelection from './PaymentSelection';

export interface UserInfo {
  id?: string;
  username: string;
  phone: string;
  email?: string;
}

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, setCart, finalAmount } = useCartContext();

  const computedCartTotal = cartItems.reduce((sum, item) => {
    if (item.type === 'game' && item.title === '360 Video Booth') {
      const extraQuantity = Math.max(0, item.quantity - 1);
      return sum + item.price + (extraQuantity * 2500);
    } else {
      return sum + item.price * item.quantity;
    }
  }, 0);

  const [currentStep, setCurrentStep] = useState<'cart' | 'user' | 'paymentSelection'>('cart');
  const [payment_methods, setPaymentMethods] = useState<{ method: 'Moniepoint'; amount: number }[]>([{ method: 'Moniepoint', amount: 0 }]);
  const [userDetails, setUserDetails] = useState<UserInfo>({ username: '', phone: '', email: '' });
  const [merchantReference, setMerchantReference] = useState<string | null>(null);

  const steps = ['Cart & Payment', 'User Details', 'Payment Selection'];

  const stepIndex = (() => {
    switch (currentStep) {
      case 'cart': return 0;
      case 'user': return 1;
      case 'paymentSelection': return 2;
      default: return 0;
    }
  })();

  const handleNextStep = () => {
    switch (currentStep) {
      case 'cart':
        setCurrentStep('user');
        break;
      case 'user':
        if (!userDetails.username || !userDetails.phone) {
          alert("Please provide username and phone.");
          return;
        }
        setCurrentStep('paymentSelection');
        break;
    }
  };

  const handleBack = () => {
    if (currentStep === 'user') {
      setCurrentStep('cart');
    } else if (currentStep === 'paymentSelection') {
      setCurrentStep('user');
    } else if (currentStep === 'cart') {
      navigate('/gameselection');
    }
  };

  const completeTransaction = (transactionData: any, finalAmount: number) => {
    console.log('Transaction completed:', { transactionData, finalAmount });
    setCart([]);
  };

  const handlePaymentSuccess = async () => {
    try {
      const reference = new Date().getTime().toString();

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/transaction`,
        {
          ...userDetails,
          reference,
          merchantReference,
          payment_methods,
          cartItems,
        }
      );

      const transactionPayload = Array.isArray(response.data?.data)
        ? response.data.data[0]
        : response.data?.data;

      completeTransaction(transactionPayload, computedCartTotal);
    } catch (error) {
      console.error('Error during payment:', error);
    }
  };

  return (
    <div className="checkout-shell">
      <div className="checkout-glass">
        <div className="checkout-hero">
          <h1>Checkout Arena</h1>
          <p>Review your cart, confirm player details, then choose a payment terminal.</p>
        </div>
        <div className="checkout-content">
      <div className="checkout-steps">
        {steps.map((label, index) => (
          <div key={label} className={`checkout-step ${index <= stepIndex ? 'active' : ''}`}>
            <div className="checkout-step-number">{index + 1}</div>
            <div className="checkout-step-label">{label}</div>
          </div>
        ))}
      </div>

      {currentStep === 'cart' && (
        <CartAndPayment
          cartItems={cartItems}
          cartTotal={finalAmount ?? 0}
          payment_methods={payment_methods}
          setPaymentMethods={setPaymentMethods}
          onNext={handleNextStep}
          userEmail={userDetails.email}
          setCartItems={setCart}
        />
      )}

      {currentStep === 'user' && (
        <UserDetails
          userDetails={userDetails}
          setUserDetails={setUserDetails}
          onNext={handleNextStep}
        />
      )}

      {currentStep === 'paymentSelection' && (
        <PaymentSelection
          cartTotal={computedCartTotal}
          userDetails={userDetails}
          cartItems={cartItems}
          handlePaymentSuccess={handlePaymentSuccess}
          onMerchantReference={(ref) => setMerchantReference(ref)}
        />
      )}

      {currentStep !== 'cart' && (
        <div className="checkout-actions">
          <button className="checkout-btn checkout-btn-secondary" onClick={handleBack}>Back</button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default Checkout;
