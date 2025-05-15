import React, { useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { useNavigate } from 'react-router-dom';
import { useCartContext } from '../hooks/useCart';

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

const AdminPaymentPage: React.FC<AdminPaymentPageProps> = ({
  cartTotal,
  userDetails,
  payment_methods,
  cartItems,
  onPaymentSuccess,
  isAdmin = false,
  discount_description,
  setDiscountDescription,
  otherReason,
  setOtherReason,
}) => {
  const [discount, setDiscount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reasonError, setReasonError] = useState('');
  const [otherReasonError, setOtherReasonError] = useState('');

  const navigate = useNavigate();
  const { setCart } = useCartContext();

  const isCashPayment = payment_methods.some((method) => method.method === '');
  const finalAmount = Math.max(0, cartTotal - discount);

  const config = {
    reference: new Date().getTime().toString(),
    email: userDetails.email,
    amount: finalAmount * 100,
    publicKey: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY || '',
  };

  const initializePayment = usePaystackPayment(config);

  const validateDiscountReason = () => {
    let isValid = true;

    if (isAdmin && discount > 0) {
      if (!discount_description) {
        setReasonError('Please select a discount reason.');
        isValid = false;
      } else {
        setReasonError('');
      }

      if (discount_description === 'other') {
        if (!otherReason.trim()) {
          setOtherReasonError('Please specify the discount reason.');
          isValid = false;
        } else {
          setOtherReasonError('');
        }
      } else {
        setOtherReasonError('');
      }
    } else {
      setReasonError('');
      setOtherReasonError('');
    }

    return isValid;
  };

  const handlePayment = () => {
    if (isProcessing) return;
    if (!validateDiscountReason()) return;

    setIsProcessing(true);

    if (isCashPayment) {
      completePayment();
    } else {
      initializePayment({ onSuccess: completePayment, onClose: onPaymentClose });
    }
  };

  const completePayment = async () => {
    try {
      onPaymentSuccess(finalAmount, discount);
      setCart([]);
    } catch (error) {
      console.error('Payment completion error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const onPaymentClose = () => {
    console.log('Payment closed');
    setIsProcessing(false);
  };

  const handleApplyDiscount = () => {
    if (discount > cartTotal) {
      setDiscount(cartTotal);
    }
  };

  const handleCancelTransaction = () => {
    if (window.confirm('Are you sure you want to cancel this transaction?')) {
      navigate('/admin');
    }
  };

  return (
    <div className="admin-payment-container">
      <h2>Admin Payment Processing</h2>

      <div className="payment-summary">
        <div className="summary-row">
          <span>Subtotal:</span>
          <span>₦{cartTotal.toFixed(2)}</span>
        </div>

        {isAdmin && (
          <div className="discount-controls">
            <div className="form-group">
              <label htmlFor="discount">Discount Amount (₦):</label>
              <input
                type="number"
                id="discount"
                min="0"
                max={cartTotal}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                onBlur={handleApplyDiscount}
              />
            </div>

            <div className="form-group">
              <label htmlFor="discountReason">Discount Reason:</label>
              <select
                id="discountReason"
                value={discount_description}
                onChange={(e) => setDiscountDescription(e.target.value)}
                className="discount-reason-select"
              >
                <option value="">Select a reason</option>
                <option value="student">Student Discount</option>
                <option value="family">Family & Friends</option>
                <option value="special">Special Customer</option>
                <option value="other">Others</option>
              </select>
              {reasonError && (
                <p style={{ color: 'red', fontSize: '0.9em' }}>{reasonError}</p>
              )}

              {discount_description === 'other' && (
                <>
                  <input
                    type="text"
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    placeholder="Please specify reason"
                    className="other-reason-input"
                    style={{ marginTop: '8px' }}
                  />
                  {otherReasonError && (
                    <p style={{ color: 'red', fontSize: '0.9em' }}>{otherReasonError}</p>
                  )}
                </>
              )}
            </div>

            <div className="summary-row">
              <span>Discount Applied:</span>
              <span>-₦{discount.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="summary-row total">
          <span>Total to Pay:</span>
          <span>₦{finalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div className="payment-methods">
        <h3>Payment Method: {isCashPayment ? 'Cash' : 'Online (Paystack)'}</h3>
      </div>

      <div className="action-buttons">
        <button
          onClick={handlePayment}
          disabled={isProcessing || finalAmount < 0}
          className="pay-button"
        >
          {isProcessing ? 'Processing...' : `Pay ₦${finalAmount.toFixed(2)}`}
        </button>

        {isAdmin && (
          <button onClick={handleCancelTransaction} className="cancel-button">
            Cancel Transaction
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="transaction-details">
          <h3>Transaction Details</h3>
          <p><strong>Customer:</strong> {userDetails.username}</p>
          <p><strong>Phone:</strong> {userDetails.phone}</p>
          {userDetails.email && <p><strong>Email:</strong> {userDetails.email}</p>}

          <h4>Items:</h4>
          <ul>
            {cartItems.map((item, index) => (
              <li key={index}>
                {item.title} - {item.quantity} × ₦{item.price.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdminPaymentPage;
