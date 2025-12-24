import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePaystackPayment } from 'react-paystack';
import axios from 'axios';

// --- Types & Interfaces ---
interface CartItem {
  id: number;
  gameDuration: number;
  quantity: number;
  title: string;
}

interface UserDetails {
  id: number;
  username: string;
  phone: string;
  email?: string;
}

const styles = {
  homeButton: { marginLeft: '10px', padding: '8px 16px', cursor: 'pointer' }
};

const PaystackPaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { finalAmount: originalAmount, userDetails, cartItems } = (location.state as any) || {};

  // State
  const [adminPassword, setAdminPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [discountWarning, setDiscountWarning] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [customDiscountReason, setCustomDiscountReason] = useState('');
  const [selectedMarketer, setSelectedMarketer] = useState('');
  const [hasSavedPaymentRecord, setHasSavedPaymentRecord] = useState(false);

  const isProcessing = useRef(false);

  const finalAmount = Math.max(originalAmount - discountAmount, 0);

  const marketers = ['In House', 'O. Timileyin', 'O. Judith', 'Damilola', 'Saviour', 'E. Success', 'K. Ese'];

  // Save payment to marketer table
  const savePaymentRecord = async (amount: number, method: string, merchantRef: string) => {
    if (hasSavedPaymentRecord) return;
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/marketer_payments`, {
        amount: Number(amount),
        marketer: selectedMarketer || "In House",
        station: "online",
        payment_method: method,
        merchantReference: merchantRef
      });
      setHasSavedPaymentRecord(true);
    } catch (err: any) {
      console.error("Marketer record error:", err.response?.data || err.message);
    }
  };

  const handleAdminLogin = async () => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/login`, {
        name: username,
        password: adminPassword
      });
      if (res.status === 200) {
        setIsAdminAuthenticated(true);
        alert("Admin authenticated.");
      }
    } catch (err: any) {
      alert("Invalid admin credentials.");
    }
  };

  const config = {
    reference: new Date().getTime().toString(),
    email: userDetails?.email || 'customer@example.com',
    amount: finalAmount * 100,
    publicKey: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY!,
    currency: 'NGN',
    metadata: {
      custom_fields: [
        { display_name: "Username", variable_name: "username", value: userDetails?.username },
        { display_name: "Phone", variable_name: "phone", value: userDetails?.phone }
      ]
    },
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async (reference: any) => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    try {
      // 1. Save Transaction record
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`, {
        ...userDetails,
        reference: reference.reference,
        payment_methods: [{ method: 'Paystack', amount: finalAmount }],
        cartItems,
        discount: discountAmount,
        discount_description: discountReason === 'Others' ? customDiscountReason : discountReason,
      });

      // 2. Save Marketer record
      await savePaymentRecord(finalAmount, 'Paystack', reference.reference);

      // 3. Add games to Queue
      await Promise.all(
        cartItems.map((item: CartItem) =>
          axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/queue/add`, {
            game_id: item.id,
            user_id: userDetails.id,
            username: userDetails.username,
            game_duration: item.gameDuration,
            quantity: item.quantity,
            game_title: item.title,
          })
        )
      );

      // 4. Navigate only AFTER all async tasks finish
      navigate('/ticket', { 
        state: { finalAmount, userDetails, cartItems, reference: reference.reference, discount: discountAmount } 
      });

    } catch (error) {
      console.error('Finalization error:', error);
      alert("Payment successful, but failed to update records. Please contact admin.");
    }
  };

  const handlePayment = () => {
    // if (!selectedMarketer) return alert("Please select a staff member.");
    if (finalAmount <= 0) return alert("Amount must be greater than 0.");
    if (discountAmount > 0 && !discountReason) return alert("Reason required for discount.");
    
    initializePayment({ onSuccess, onClose: () => console.log('Closed') });
  };

  return (
    <div>
      {/* Marketer selection remains optional */}
      <div style={{ marginBottom: '15px' }}>
        <label>Staff: </label>
        <select value={selectedMarketer} onChange={(e) => setSelectedMarketer(e.target.value)}>
          <option value="">-- In House --</option>
          {marketers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Admin Discount Section */}
      {!isAdminAuthenticated ? (
        <fieldset>
          <legend>Admin Authorization (for discounts)</legend>
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
          <button onClick={handleAdminLogin}>Unlock Discount</button>
        </fieldset>
      ) : (
        <div style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
          <h3>Apply Discount</h3>
          <input 
            type="number" 
            placeholder="Amount ₦" 
            onChange={(e) => setDiscountAmount(Number(e.target.value))} 
          />
          <select value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}>
            <option value="">Reason...</option>
            <option value="Promo">Promo</option>
            <option value="Others">Others</option>
          </select>
          {discountReason === 'Others' && (
            <input placeholder="Describe reason" onChange={(e) => setCustomDiscountReason(e.target.value)} />
          )}
        </div>
      )}

      {/* Payment Summary */}
      <div style={{ marginTop: '20px', borderTop: '1px solid #ccc' }}>
        <h2>Order Summary</h2>
        <p>User: {userDetails?.username} ({userDetails?.phone})</p>
        <p>Total Payable: 
           <strong style={{ color: 'green', fontSize: '1.2em', marginLeft: '10px' }}>
             ₦{finalAmount.toLocaleString()}
           </strong>
        </p>
        
        <button 
          onClick={handlePayment} 
          style={{ padding: '10px 20px', background: 'blue', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Pay with Paystack
        </button>
      </div>
    </div>
  );
};

export default PaystackPaymentPage;
