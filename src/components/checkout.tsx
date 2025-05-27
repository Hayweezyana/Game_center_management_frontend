import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartContext } from './hooks/useCart';
import axios from 'axios';
import './checkout.css';
import CartAndPayment from './CartAndPayment';
import UserDetails from './UserDetails';
import PaymentSelection from './PaymentSelection';
import AdminPaymentPage from './users/AdminPaymentPage';
import AdminLogin from './users/AdminLogin';


export interface UserInfo {
  id?: string;
  username: string;
  phone: string;
  email?: string; // Keep it optional
}

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, cartTotal, setCart } = useCartContext();

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [currentStep, setCurrentStep] = useState<'cart' | 'adminPayment' | 'user' | 'paymentSelection'>('cart');
  const [payment_methods, setPaymentMethods] = useState<{ method: 'Moniepoint'; amount: number }[]>([{ method: 'Moniepoint', amount: cartTotal }]);
  const [userDetails, setUserDetails] = useState<{
    username: string;
    phone: string;
    email?: string;
  }>({
    username: '',
    phone: '',
    email: '',
  });
  const [discount_description, setDiscountDescription] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [adminPaymentData, setAdminPaymentData] = useState<null | { finalAmount: number; discount: number }>(null);
  const [merchantReference, setMerchantReference] = useState<string | null>(null);


  const steps = isAdminMode
    ? ['Cart & Payment', 'User Details', 'Admin Payment']
    : ['Cart & Payment', 'User Details', 'Payment Selection'];

  const stepIndex = (() => {
    switch (currentStep) {
      case 'cart': return 0;
      case 'user': return 1;
      case 'adminPayment': return 2;
      case 'paymentSelection': return 2;
      default: return 0;
    }
  })();

  useEffect(() => {
    const adminData = localStorage.getItem('adminData');
    if (adminData) {
      const { name } = JSON.parse(adminData);
      setAdminName(name);
      setIsAdminMode(true);
      setCurrentStep('adminPayment');
    }
  }, []);

  const handleAdminLoginSuccess = (name: string) => {
    setAdminName(name);
    setIsAdminMode(true);
    setShowAdminLogin(false);
    setCurrentStep('adminPayment');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminData');
    localStorage.removeItem('token');
    setAdminName('');
    setIsAdminMode(false);
    setCurrentStep('cart');
  };

  const handleNextStep = () => {
    if (currentStep === 'cart') {
      setCurrentStep('user');
    } else if (currentStep === 'adminPayment') {
      setCurrentStep('user');
    } else if (currentStep === 'user') {
      if (!userDetails.username || !userDetails.phone) {
        alert("Please provide username and phone.");
        return;
      }

      if (isAdminMode && adminPaymentData) {
        completeAdminTransaction(adminPaymentData.finalAmount, adminPaymentData.discount, userDetails);
      } else {
        setCurrentStep('paymentSelection');
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 'user') {
      setCurrentStep(isAdminMode ? 'adminPayment' : 'cart');
    } else if (currentStep === 'adminPayment') {
      setCurrentStep('cart');
    } else if (currentStep === 'paymentSelection') {
      setCurrentStep('user');
    }
  };

  const mapCartItems = (items: typeof cartItems) =>
    items.map((item) => ({
      ...item,
      gameTitle: item.title,
      gameDuration: item.gameDuration ?? 0,
    }));

  const completeTransaction = (
    transactionData: any,
    finalAmount: number,
    discount: number
  ) => {
    console.log('Transaction completed:', {
    transactionData,
    finalAmount,
    discount,
  });

    setCart([]);
  };

  const handleAdminPaymentSuccess = async (finalAmount: number, discount: number) => {
    setAdminPaymentData({ finalAmount, discount });
    setCurrentStep('user');
  };

  const fullDiscountReason = discount_description === 'other'
    ? `Other: ${otherReason}`
    : discount_description;

  const completeAdminTransaction = async (
    cartTotal: number,
    discount: number,
    userDetails: { username: string; phone: string; email?: string }
  ) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`,
        {
          ...userDetails,
          reference: new Date().getTime().toString(),
          merchantReference,
          payment_methods: [{ method: 'Moniepoint', amount: cartTotal }],
          cartItems,
          discount,
          isAdmin: true,
          discount_description: discount > 0 ? fullDiscountReason : undefined,
        }
      );

      const transactionPayload = Array.isArray(response.data?.data)
        ? response.data.data[0]
        : response.data?.data;

      completeTransaction(transactionPayload, cartTotal, discount);
    } catch (error) {
      console.error('Error during admin payment:', error);
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      const payload = {
          ...userDetails,
          reference: new Date().getTime().toString(),
          merchantReference,
          payment_methods,
          cartItems,
          discount: 0,
          discount_description,
      };
      console.log('Submitting transaction:', payload);
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`,
        payload
      );

      const transactionPayload = Array.isArray(response.data?.data)
        ? response.data.data[0]
        : response.data?.data;

      completeTransaction(transactionPayload, cartTotal, 0);
    } catch (error) {
      console.error('Error during payment:', error);
    }
  };



  return (
    <div className="checkout-container">
      <div className="admin-mode-toggle">
        {isAdminMode ? (
          <div className="admin-info">
            <span className="admin-name">Admin: {adminName}</span>
            <button onClick={handleAdminLogout} className="admin-mode-button exit-admin">
              Exit Admin Mode
            </button>
          </div>
        ) : (
          <button onClick={() => setShowAdminLogin(true)} className="admin-mode-button enter-admin">
            Admin Mode
          </button>
        )}
      </div>

      {showAdminLogin && (
        <AdminLogin
          onLoginSuccess={handleAdminLoginSuccess}
          onClose={() => setShowAdminLogin(false)}
        />
      )}

      <h1>Checkout</h1>

      <div className="checkout-steps">
        {steps.map((label, index) => (
          <div key={label} className={`step ${index <= stepIndex ? 'active' : ''}`}>
            <div className="step-number">{index + 1}</div>
            <div className="step-label">{label}</div>
          </div>
        ))}
      </div>

      {currentStep === 'cart' && (
        <CartAndPayment
          cartItems={cartItems}
          cartTotal={cartTotal}
          payment_methods={payment_methods}
          setPaymentMethods={setPaymentMethods}
          onNext={handleNextStep}
          userEmail={userDetails.email}
        />
      )}

      {currentStep === 'adminPayment' && isAdminMode && (
        <AdminPaymentPage
          cartTotal={cartTotal}
          userDetails={userDetails}
          payment_methods={payment_methods}
          cartItems={cartItems}
          onPaymentSuccess={handleAdminPaymentSuccess}
          isAdmin={true}
          discount_description={discount_description}
          setDiscountDescription={setDiscountDescription}
          otherReason={otherReason}
          setOtherReason={setOtherReason}
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
          cartTotal={cartTotal}
          userDetails={userDetails}
          cartItems={cartItems}
          handlePaymentSuccess={handlePaymentSuccess}
          onMerchantReference={(ref) => setMerchantReference(ref)}
        />
      )}

      {currentStep !== 'cart' && (
        <div className="navigation-buttons">
          <button className="back-button" onClick={handleBack}>Back</button>
        </div>
      )}
    </div>
  );
};

export default Checkout;
