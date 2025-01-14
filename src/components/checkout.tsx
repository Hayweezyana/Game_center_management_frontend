import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PaymentForm from './PaymentForm';

// Define types for the location state
interface CartItem {
  title: string;
  price: number;
  quantity: number;
}

interface LocationState {
  checkoutCart: CartItem[];
  cartTotal: number;
}

const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract state from the location object with proper types
  const { checkoutCart = [], cartTotal = 0 } = (location.state || {}) as LocationState;

  const recalculatedTotal = checkoutCart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  return (
    <div>
      <h1>Checkout</h1>
      {/* Display the cartTotal */}
      <h2>Total: ₦{cartTotal}</h2>
      {/* Pass the cartTotal to the PaymentForm */}
      <PaymentForm cartTotal={recalculatedTotal} />
      <div>
        <h3>Items in your cart:</h3>
        <ul>
          {checkoutCart.map((item, index) => (
            <li key={index}>
              {item.title} - ₦{item.price} x {item.quantity} = ₦{item.price * item.quantity}
            </li>
          ))}
        </ul>
      </div>
      <button onClick={() => navigate('/PC', { state: { checkoutCart } })}>
        Proceed to Queue
      </button>
    </div>
  );
};

export default Checkout;
