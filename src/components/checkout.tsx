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
  const [currentStep, setCurrentStep] = useState<'cart' | 'adminPayment' | 'user' | 'payment'>('cart');
  const [payment_methods, setPaymentMethods] = useState<{ method: 'paystack'; amount: number }[]>([{ method: 'paystack', amount: cartTotal }]);
  const [userDetails, setUserDetails] = useState<{ id?: string; username: string; phone: string; email?: string }>({
    id: undefined,
    username: '',
    phone: '',
    email: '',
  });
  const [discount_description, setDiscountDescription] = useState('');
  const [otherReason, setOtherReason] = useState('');

  const steps = isAdminMode
  ? ['Admin Payment', 'User Details']
  : ['Cart & Payment', 'User Details', 'Payment'];

const stepIndex = steps.findIndex((step, index) => {
  if (isAdminMode && currentStep === 'adminPayment') return index === 0;
  if (currentStep === 'cart') return index === 0;
  if (currentStep === 'user') return index === 1;
  if (currentStep === 'payment') return index === 2;
  return false;
});


  useEffect(() => {
    const adminData = localStorage.getItem('adminData');
    if (adminData) {
      const { name } = JSON.parse(adminData);
      setAdminName(name);
      setIsAdminMode(true);
      setCurrentStep('adminPayment');
    }
  }, []);

//   useEffect(() => {
//   const total = cartTotal;
//   const totalAssigned = paymentMethods.reduce((sum, p) => sum + Number(p.amount), 0);

//   if (totalAssigned !== total) {
//     setPaymentMethods([{ method: 'cash', amount: total }]);
//   }
// }, [cartTotal]);


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
    setCurrentStep('cart');
  };

  const handleNextStep = () => {
    if (currentStep === 'cart') { setCurrentStep('user');
    } else if (currentStep === 'adminPayment') { setCurrentStep('user');
    } else if (currentStep === 'user') {
      if (!userDetails.username || !userDetails.phone) {
    alert("Please provide username and phone.");
    return;
  }
      setCurrentStep('payment');
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
    console.log('Transaction data passed to completeTransaction:', transactionData);

    const transactionId = transactionData.transaction_id || transactionData.id;
    const mappedCartItems = mapCartItems(cartItems);
    const user = transactionData.user;

    navigate('/ticket', {
      state: {
        id: transactionData.id,
        transactionId,
        games: mappedCartItems.map(({ title, quantity, price }) => ({
          name: title,
          quantity,
          price,
        })),
        totalAmount: finalAmount,
        discount,
        dateTime: new Date().toLocaleString(),
        userDetails: {
          id: user?.id,
      username: user?.username,
      phone: user?.phone
    },
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

    const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`,
      {
        ...userDetails,
        payment_methods: [{ method: 'paystack', amount: cartTotal }],
        cartItems,
        discount,
        isAdmin: true,
        discount_description: discount > 0 ? fullDiscountReason : undefined,
      }
    );

    const transactionPayload = Array.isArray(response.data?.data)
      ? response.data.data[0]
      : response.data?.data;

    completeTransaction(transactionPayload, finalAmount, discount);
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
        payment_methods,
        cartItems,
        discount: 0,
        discount_description,
      }
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
        <AdminLogin onLoginSuccess={handleAdminLoginSuccess} onClose={() => setShowAdminLogin(false)} />
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
    onPaymentSuccess={(finalAmount, discount) => {
      handleAdminPaymentSuccess(finalAmount, discount);
      setCurrentStep('user'); // move to next step
    }}
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

{currentStep === 'payment' && (
  <PaymentPage
    cartTotal={cartTotal}
    userDetails={userDetails}
    //paymentMethods={paymentMethods}
    onPaymentSuccess={handlePaymentSuccess}
  />
)}

    </div>
  );
};

export default Checkout;