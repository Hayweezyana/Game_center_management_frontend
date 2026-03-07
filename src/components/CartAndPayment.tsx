import React, { useEffect, useState } from 'react';
import UseCart from './hooks/useCart';
import './CheckoutExperience.css';

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

const formatNaira = (amount: number) => `N${amount.toLocaleString()}`;

const CartAndPayment: React.FC<CartAndPaymentProps> = ({
  cartItems,
  cartTotal,
  setPaymentMethods,
  onNext,
  setCartItems,
}) => {
  const [isPaying] = useState(false);
  const [items, setItems] = useState<CartItem[]>(cartItems);
  const [total, setTotal] = useState<number>(cartTotal);
  const { clearCart } = UseCart();

  useEffect(() => {
    const newTotal = items.reduce((sum, item) => {
      if (item.type === 'game' && item.title === '360 Video Booth') {
        const extraQuantity = Math.max(0, item.quantity - 1);
        return sum + item.price + extraQuantity * 2500;
      }
      return sum + item.price * item.quantity;
    }, 0);

    setTotal(newTotal);
    setPaymentMethods([{ method: 'Moniepoint', amount: newTotal }]);
  }, [items, setPaymentMethods]);

  const handleQuantityChangeById = (id: string, delta: number) => {
    setItems((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      );
      setCartItems(updated);
      return updated;
    });
  };

  const handleCancelTransaction = () => {
    if (!window.confirm('Are you sure you want to cancel the transaction and clear the cart?')) {
      return;
    }
    setItems([]);
    setCartItems([]);
    setTotal(0);
    setPaymentMethods([]);
    clearCart();
    alert('Transaction cancelled and cart cleared.');
  };

  const renderCartItems = (type: 'game' | 'drink') =>
    items
      .filter((item) => item.type === type)
      .map((item) => {
        const itemTotal =
          item.type === 'game' && item.title === '360 Video Booth'
            ? item.price + Math.max(0, item.quantity - 1) * 2500
            : item.price * item.quantity;

        return (
          <li key={item.id} className="cart-row">
            <div>
              <div className="cart-item-title">{type === 'drink' ? `Drink: ${item.title}` : item.title}</div>
              <div className="cart-item-meta">
                {formatNaira(item.price)} x {item.quantity} = {formatNaira(itemTotal)}
              </div>
            </div>
            <div className="quantity-controls">
              <button
                className="qty-btn"
                onClick={() => handleQuantityChangeById(item.id, -1)}
                disabled={item.quantity === 1}
              >
                -
              </button>
              <span>{item.quantity}</span>
              <button className="qty-btn" onClick={() => handleQuantityChangeById(item.id, 1)}>
                +
              </button>
            </div>
          </li>
        );
      });

  return (
    <div className="checkout-panel">
      {items.some((item) => item.type === 'game') && (
        <>
          <h3>Games</h3>
          <ul className="cart-list">{renderCartItems('game')}</ul>
        </>
      )}

      {items.some((item) => item.type === 'drink') && (
        <>
          <h3>Drinks</h3>
          <ul className="cart-list">{renderCartItems('drink')}</ul>
        </>
      )}

      <div className="summary-row">
        <span>Total Payable</span>
        <span className="value">{formatNaira(total)}</span>
      </div>

      <div className="checkout-actions">
        <button className="checkout-btn checkout-btn-primary" onClick={onNext} disabled={isPaying || total === 0}>
          {isPaying ? 'Processing...' : 'Enter Details'}
        </button>
        <button className="checkout-btn checkout-btn-danger" onClick={handleCancelTransaction}>
          Cancel Transaction
        </button>
      </div>
    </div>
  );
};

export default CartAndPayment;
