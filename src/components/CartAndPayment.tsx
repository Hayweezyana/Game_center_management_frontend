import React, { useState, useEffect } from 'react';
import  UseCart  from './hooks/useCart'; // Adjust path if needed

interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  gameDuration: number;
  type: 'game' | 'drink';
}

interface CartAndPaymentProps {
  cartItems: CartItem[];
  cartTotal: number;
  payment_methods: { method: 'Moniepoint'; amount: number }[];
  setPaymentMethods: React.Dispatch<React.SetStateAction<{ method: 'Moniepoint'; amount: number }[]>>;
  onNext: () => void;
  userEmail?: string;
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

const CartAndPayment: React.FC<CartAndPaymentProps> = ({
  cartItems,
  cartTotal,
  setPaymentMethods,
  onNext,
  setCartItems,
}) => {
  
  const [isPaying,] = useState(false);
  const [items, setItems] = useState<CartItem[]>(cartItems);
  const [total, setTotal] = useState<number>(cartTotal);
  const { clearCart } = UseCart();

  useEffect(() => {
  const newTotal = items.reduce((sum, item) => {
    if (item.type === 'game' && item.title === '360 Video Booth') {
      // First item at regular price, rest at ₦2500 each
      const extraQuantity = Math.max(0, item.quantity - 1);
      return sum + item.price + (extraQuantity * 2500);
    } else {
      return sum + item.price * item.quantity;
    }
  }, 0);

    // Update payment method total as well
    setTotal(newTotal);
    setPaymentMethods([{ method: 'Moniepoint', amount: newTotal }]);
  }, [items, setPaymentMethods]);

  const handleQuantityChangeById = (id: string, delta: number) => {
    setItems((prev) => {
    const updated = prev.map(item =>
      item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    );
    setCartItems(updated); // Update the global cart
    return updated;
  });
};

  const handleCancelTransaction = () => {
    if (window.confirm('Are you sure you want to cancel the transaction and clear the cart?')) {
      const zeroedItems = items.map(item => ({ ...item, quantity: 0 }));
    setItems(zeroedItems);
    setCartItems([]);
      setTotal(0);
      setPaymentMethods([]); // Clear payment methods
      clearCart(); // Clear the cart in the context
      alert('Transaction cancelled and cart cleared.');
    }
  };

  const renderCartItems = (type: 'game' | 'drink') => {
    return items
      .filter(item => item.type === type)
      .map((item) => {
        const itemTotal =
          item.type === 'game' && item.title === '360 Video Booth'
            ? item.price + (Math.max(0, item.quantity - 1) * 2500)
            : item.price * item.quantity;

  return (
          <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <strong>{type === 'drink' ? `Drink: ${item.title}` : item.title}</strong> – ₦{item.price} × {item.quantity} = ₦{itemTotal}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => handleQuantityChangeById(item.id, -1)} disabled={item.quantity === 1}>-</button>
            <span style={{ minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
            <button onClick={() => handleQuantityChangeById(item.id, 1)}>+</button>
          </div>
        </li>
        );
      });
  };

  return (
    <div>
      {items.some(item => item.type === 'game') && (
        <>
          <h3>Games</h3>
          <ul>{renderCartItems('game')}</ul>
        </>
      )}

      {items.some(item => item.type === 'drink') && (
        <>
          <h3>Drinks</h3>
          <ul>{renderCartItems('drink')}</ul>
        </>
      )}

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
