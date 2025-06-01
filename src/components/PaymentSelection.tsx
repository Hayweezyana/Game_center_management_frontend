// PaymentSelection.tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './PaymentSelection.css'

interface PaymentSelectionProps {
  cartTotal: number;
  userDetails: { username: string; phone: string; email?: string };
  cartItems: any[];
  finalAmount?: number; // Optional prop for final amount
  discount?: number;
  discountReason?: string;
  isAdmin?: boolean;
  handlePaymentSuccess: () => Promise<void>;
  onMerchantReference?: (merchantReference: string) => void; // new prop for Funstation

}

interface AdminPaymentPageProps {
  cartTotal: number;
  userDetails: { username: string; phone: string; email?: string };
  payment_methods: { method: string; amount: number }[];
  cartItems: any[];
  onPaymentSuccess: (finalAmount: number, discount: number) => void;
  isAdmin: boolean;
  discount_description: string;
  setDiscountDescription: (reason: string) => void;
  otherReason: string;
  setOtherReason: (reason: string) => void;
}


const PaymentSelection: React.FC<PaymentSelectionProps> = ({
  cartTotal,
  finalAmount = cartTotal, // Default to cartTotal if finalAmount is not provided
  userDetails,
  cartItems,
  discount,
  discountReason,
  isAdmin = false,

}) => {
  const navigate = useNavigate();

  const handleSelectPayment = (terminal: 'immersia' | 'funstation' | 'paystack') => {
    console.log(`Selected ${terminal} terminal`);
    navigate(`/${terminal}paymentpage`, {
      state: {
        finalAmount: cartTotal,
        userDetails,
        cartItems,
        discount,
        discountReason,
        isAdmin
      },
    });
  };

  // PaymentSelection.tsx
interface FunstationResponse {
  merchantReference: string;
}

const handlePayment = (funstationResponse: FunstationResponse): void => {
  const { merchantReference } = funstationResponse; // Extract from Funstation response

  console.log('Funstation merchantReference:', merchantReference);
};


  return (
    <div className="payment-selection-container">
      <h2>Select Payment Terminal</h2>
      
      {isAdmin && discount !== undefined && discount > 0 && (
        <div className="admin-discount-notice">
          <p>Admin Discount Applied: -₦{discount.toFixed(2)}</p>
          {discountReason && <p>Reason: {discountReason}</p>}
        </div>
      )}

      <div className="payment-total">
        <span>Total Amount:</span>
        <span className="amount">₦{finalAmount.toLocaleString()}</span>
      </div>
      
      <div className="payment-options-grid">
        <button className="payment-option" onClick={() => handleSelectPayment('immersia')}>
          <div className="terminal-icon immersia-icon"></div>
          <h3>Immersia Terminal</h3>
          <p>Physical terminal at Immersia station</p>
        </button>
        
        <button className="payment-option" onClick={() => handleSelectPayment('funstation')}>
          <div className="terminal-icon funstation-icon"></div>
          <h3>Funstation Terminal</h3>
          <p>Physical terminal at Funstation</p>
        </button>
        <button className="payment-option" onClick={() => handleSelectPayment('paystack')}>
          <div className="terminal-icon paystack-icon"></div>
          <h3>Paystack Online</h3>
          <p>Secure online payment</p>
        </button>
      </div>

      <button 
        className="back-button"
        onClick={() => navigate(isAdmin ? '/admin-payment' : '/checkout')}
      >
        Back to {isAdmin ? 'Admin' : 'Checkout'}
      </button>
    </div>
  );
};

export default PaymentSelection;