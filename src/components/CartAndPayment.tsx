import React, { useState, useEffect } from 'react';
import  UseCart  from './hooks/useCart'; // Adjust path if needed

interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  gameDuration: number;
}

interface CartAndPaymentProps {
  cartItems: CartItem[];
  cartTotal: number;
  payment_methods: { method: 'Moniepoint'; amount: number }[];
  setPaymentMethods: React.Dispatch<React.SetStateAction<{ method: 'Moniepoint'; amount: number }[]>>;
  onNext: () => void;
  userEmail?: string;
}

const CartAndPayment: React.FC<CartAndPaymentProps> = ({
  cartItems,
  cartTotal,
  setPaymentMethods,
  onNext,
}) => {
  
  const [isPaying,] = useState(false);
  const [items, setItems] = useState<CartItem[]>(cartItems);
  const [total, setTotal] = useState<number>(cartTotal);
  const { clearCart } = UseCart();

  useEffect(() => {
  const newTotal = items.reduce((sum, item) => {
    if (item.title === '360 Video Booth') {
      // First item at regular price, rest at ₦1000 each
      const extraQuantity = Math.max(0, item.quantity - 1);
      return sum + item.price + (extraQuantity * 1000);
    } else {
      return sum + item.price * item.quantity;
    }
  }, 0);

    // Update payment method total as well
    setTotal(newTotal);
    setPaymentMethods([{ method: 'Moniepoint', amount: newTotal }]);
  }, [items, setPaymentMethods]);

  const handleQuantityChange = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    );
  };


  const handleCancelTransaction = () => {
    if (window.confirm('Are you sure you want to cancel the transaction and clear the cart?')) {
      const zeroedItems = items.map(item => ({ ...item, quantity: 0 }));
    setItems(zeroedItems);
      setTotal(0);
      setPaymentMethods([]); // Clear payment methods
      clearCart(); // Clear the cart in the context
      alert('Transaction cancelled and cart cleared.');
    }
  };

  return (
    <div>
      <ul>
        {items.map((item, index) => (
          <li key={item.id}>
            <strong>{item.title}</strong> - ₦{item.price} x {item.quantity} = ₦
    {item.title === '360 Video Booth' 
      ? (item.price + ((item.quantity - 1) * 1000))
      : (item.price * item.quantity)}{' '}
            <button onClick={() => handleQuantityChange(index, -1)} disabled={item.quantity === 1}>
              -
            </button>
            <button onClick={() => handleQuantityChange(index, 1)}>+</button>
          </li>
        ))}
      </ul>

      <h2>Total: ₦{total}</h2>

      <button onClick={onNext} disabled={isPaying || total === 0}>
        {isPaying ? 'Processing...' : 'Enter Details'}
      </button>

      <button onClick={handleCancelTransaction} style={{ marginLeft: '1rem', color: 'red' }}>
        Cancel Transaction
      </button>
    </div>
  );
};

export default CartAndPayment;
