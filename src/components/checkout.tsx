import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartContext } from './hooks/useCart';
import axios from 'axios';
import './checkout.css';
import CartAndPayment from './CartAndPayment';
import UserDetails from './UserDetails';
import PaymentPage from './PaymentPage';
import AdminPaymentPage from './users/AdminPaymentPage';
import AdminLogin from './users/AdminLogin';

const Checkout: React.FC = () => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const { cartItems, cartTotal, setCart } = useCartContext();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<'cart' | 'user' | 'payment'>('cart');
  const [paymentMethods, setPaymentMethods] = useState([{ method: 'cash', amount: cartTotal }]);
  const [userDetails, setUserDetails] = useState<{ username: string; phone: string; email?: string }>({
    username: '',
    phone: '',
    email: '',
  });
  const [discount_description, setDiscountDescription] = useState('');
  const [otherReason, setOtherReason] = useState('');

  useEffect(() => {
    const adminData = localStorage.getItem('adminData');
    if (adminData) {
      const { name } = JSON.parse(adminData);
      setAdminName(name);
      setIsAdminMode(true);
    }
  }, []);

  const handleAdminLoginSuccess = (name: string) => {
    setAdminName(name);
    setIsAdminMode(true);
    setShowAdminLogin(false);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminData');
    localStorage.removeItem('token');
    setAdminName('');
    setIsAdminMode(false);
  };

  const handleNextStep = () => {
    if (currentStep === 'cart') setCurrentStep('user');
    else if (currentStep === 'user') setCurrentStep('payment');
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
    const transactionId = transactionData.transaction_id || transactionData.id;
    const mappedCartItems = mapCartItems(cartItems);

    navigate('/ticket', {
      state: {
        transactionId,
        games: mappedCartItems.map(({ title, quantity, price }) => ({
          name: title,
          quantity,
          price,
        })),
        totalAmount: finalAmount,
        discount,
        dateTime: new Date().toLocaleString(),
        userDetails,
        cartItems: mappedCartItems,
        ...(isAdminMode && { adminName }),
      },
    });

    setCart([]);
  };

  const handleAdminPaymentSuccess = async (finalAmount: number, discount: number) => {
    try {
      const fullDiscountReason =
        discount_description === 'other' ? `Other: ${otherReason}` : discount_description;

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`,
        {
          ...userDetails,
          paymentMethods,
          cartItems,
          discount,
          isAdmin: true,
          discount_description: discount > 0 ? fullDiscountReason : undefined,
        }
      );

      const createdTransaction = Array.isArray(response.data?.data)
        ? response.data.data[0]
        : response.data?.data;

      completeTransaction(createdTransaction, finalAmount, discount);
    } catch (error) {
      console.error('Error during admin payment:', error);
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`,
        {
          ...userDetails,
          paymentMethods,
          cartItems,
          discount: 0,
          discount_description,
        }
      );

      const createdTransaction = Array.isArray(response.data?.data)
        ? response.data.data[0]
        : response.data?.data;

      completeTransaction(createdTransaction, cartTotal, 0);
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
        <AdminLogin onLoginSuccess={handleAdminLoginSuccess} onClose={() => setShowAdminLogin(false)} />
      )}

      <h1>Checkout</h1>

      {currentStep === 'cart' && (
        <CartAndPayment
          cartItems={cartItems}
          cartTotal={cartTotal}
          paymentMethods={paymentMethods}
          setPaymentMethods={setPaymentMethods}
          onNext={handleNextStep}
        />
      )}

      {currentStep === 'user' && (
        <UserDetails userDetails={userDetails} setUserDetails={setUserDetails} onNext={handleNextStep} />
      )}

      {currentStep === 'payment' && (
        isAdminMode ? (
          <AdminPaymentPage
            cartTotal={cartTotal}
            userDetails={userDetails}
            paymentMethods={paymentMethods}
            cartItems={cartItems}
            onPaymentSuccess={handleAdminPaymentSuccess}
            isAdmin={true}
            discount_description={discount_description}
            setDiscountDescription={setDiscountDescription}
            otherReason={otherReason}
            setOtherReason={setOtherReason}
          />
        ) : (
          <PaymentPage
            cartTotal={cartTotal}
            userDetails={userDetails}
            paymentMethods={paymentMethods}
            onPaymentSuccess={handlePaymentSuccess}
          />
        )
      )}
    </div>
  );
};

export default Checkout;
