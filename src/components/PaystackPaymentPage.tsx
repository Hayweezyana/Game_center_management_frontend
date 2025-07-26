import React, {useState} from 'react';
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
  const { finalAmount: originalAmount, userDetails, cartItems } = location.state || {};
  
    const [adminPassword, setAdminPassword] = useState('');
    const [username, setUsername] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [discountWarning, setDiscountWarning] = useState('');
  
  const [discountAmount, setDiscountAmount] = useState(0);
  const finalAmount = Math.max(originalAmount - discountAmount, 0);
  const [discountReason, setDiscountReason] = useState('');
  const [customDiscountReason, setCustomDiscountReason] = useState('');

  const handleAdminLogin = async () => {
  try {
    const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/login`, {
      name: username,
      password: adminPassword
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

    const { token, role } = res.data;
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('adminData', JSON.stringify(role));

    if (res.status === 200) {
      setIsAdminAuthenticated(true);
      alert("Admin authenticated successfully.");
    }
  } catch (err: any) {
    alert("Invalid admin password.");
    console.error(err.response?.data || err.message);
  }
};
  

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
      discount: discountAmount,
      discount_description: discountReason === 'Others' ? customDiscountReason : discountReason,
       
    });

    console.log('Submitting transaction:', response.data);
    navigate('/ticket', { state: { finalAmount, userDetails, cartItems, reference: config.reference, dateTime: config.dateTime, discount: discountAmount } });
  try {
  interface QueueItem {
    game_id: number;
    user_id: number;
    username: string;
    game_duration: number;
    quantity: number;
    game_title: string;
  }

  interface CartItem {
    id: number;
    gameDuration: number;
    quantity: number;
    title: string;
  }

  interface UserDetails {
    id: number;
    username: string;
  }

  await Promise.all<void>(
    cartItems.map((item: CartItem) =>
      axios.post<void>(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/queue/add`, {
        game_id: item.id,
        user_id: userDetails.id,
        username: userDetails.username,
        game_duration: item.gameDuration,
        quantity: item.quantity,
        game_title: item.title,
      } as QueueItem)
    )
  );
  console.log('Games and User successfully queued.');
  alert('Games queued successfully. You can now proceed to the assigned station.');
} catch (queueError) {
  console.error('Failed to queue games:', queueError);
}
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
    if (discountAmount > 0 && (!discountReason || (discountReason === 'Others' && customDiscountReason.trim() === ''))) {
      alert("Please select or enter a valid discount reason");
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
      <div>
      {!isAdminAuthenticated && (
        <div>
    <input
    type="name"
    placeholder="username"
    value={username}
    onChange={(e) => setUsername(e.target.value)}
    />
    <input
      type="password"
      placeholder="Enter admin password"
      value={adminPassword}
      onChange={(e) => setAdminPassword(e.target.value)}
    />
    <button onClick={handleAdminLogin}>Login as Admin</button>
  </div>
)}

{isAdminAuthenticated && (
  <div>
    <h3>Apply Discount</h3>
    <input
      type="number"
      placeholder="Discount amount (₦)"
      value={discountAmount}
      onChange={(e) => {
        const value = parseInt(e.target.value, 10) || 0;
      setDiscountAmount(value);
      if (value > 0 && discountReason.trim() === '') {
        setDiscountWarning('Please select or enter a discount reason.');
      } else {
        setDiscountWarning('');
      }
    }}
    />
    <select
      value={discountReason}
      onChange={(e) => {
        setDiscountReason(e.target.value);
      if (discountAmount > 0 && e.target.value.trim() === '') {
        setDiscountWarning('Please select or enter a discount reason.');
      } else {
        setDiscountWarning('');
      }
    }}
    >
      <option value="">Select Discount Reason</option>
      <option value="Promo">Promo</option>
      <option value="Customer Request">Customer Request</option>
      <option value="Others">Others</option>
    </select>
        {discountReason === 'Others' && (
          <input
            type="text"
            placeholder="Enter custom discount reason"
            value={customDiscountReason}
            onChange={(e) => {
              setCustomDiscountReason(e.target.value);
  if (discountReason === 'Others' && discountAmount > 0 && e.target.value.trim() === '') {
    setDiscountWarning('Please enter a custom discount reason.');
  } else {
    setDiscountWarning('');
  }
}}
          />
          )}
    {discountWarning && (
      <p style={{ color: 'red', fontWeight: 'bold' }}>{discountWarning}</p>
        )}
      </div>
    )}
    <div>
      <h2>Payment</h2>
      <p>
  <strong>Total:</strong>{' '}
  {discountAmount > 0 ? (
    <>
      <span style={{ textDecoration: 'line-through', color: 'gray' }}>
        ₦{originalAmount.toLocaleString()}
      </span>{' '}
      <span style={{ color: 'green' }}>
        ₦{finalAmount.toLocaleString()}
      </span>
    </>
  ) : (
    <>₦{originalAmount.toLocaleString()}</>
  )}
</p>
      <p>Username: {userDetails?.username}</p>
      <p>Phone: {userDetails?.phone}</p>
      {userDetails?.email && <p>Email: {userDetails.email}</p>}
    <button 
      onClick={handlePayment}
      disabled={discountAmount > 0 && discountReason.trim() === ''}
    >
      Pay Now
    </button>
      <button>Edit Cart</button>
    </div>
    </div>
    </div>
  );
};

export default PaystackPaymentPage;
