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
  paymentMethods: { method: string; amount: number }[];
  setPaymentMethods: React.Dispatch<React.SetStateAction<{ method: string; amount: number }[]>>;
  onNext: () => void;
  userEmail?: string;
}

const CartAndPayment: React.FC<CartAndPaymentProps> = ({
  cartItems,
  cartTotal,
  setPaymentMethods,
  onNext,
  userEmail,
}) => {
  const email = userEmail || 'immersiavr@immersiavr.com';
  const [isPaying, setIsPaying] = useState(false);
  const [items, setItems] = useState<CartItem[]>(cartItems);
  const [total, setTotal] = useState<number>(cartTotal);
  const { clearCart } = UseCart();

  useEffect(() => {
    const newTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    setTotal(newTotal);

    // Update payment method total as well
    setPaymentMethods([{ method: 'cash', amount: newTotal }]);
  }, [items, setPaymentMethods]);

  const handleQuantityChange = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    );
  };

  const handlePayWithPaystack = () => {
    setIsPaying(true);

    const paystack = (window as any).PaystackPop.setup({
      key: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY,
      email: email,
      amount: total * 100,
      currency: 'NGN',
      metadata: {
        cartItems: items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          duration: item.gameDuration,
        })),
      },
      callback: function (response: any) {
        console.log('Payment successful. Reference:', response.reference);
        setIsPaying(false);
        onNext(); // proceed after payment
      },
      onClose: function () {
        setIsPaying(false);
        alert('Transaction was not completed.');
      },
    });

    paystack.openIframe();
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
            {item.price * item.quantity}{' '}
            <button onClick={() => handleQuantityChange(index, -1)} disabled={item.quantity === 1}>
              -
            </button>
            <button onClick={() => handleQuantityChange(index, 1)}>+</button>
          </li>
        ))}
      </ul>

      <h2>Total: ₦{total}</h2>

      <button onClick={handlePayWithPaystack} disabled={isPaying}>
        {isPaying ? 'Processing payment...' : 'Pay with Paystack'}
      </button>

      <button onClick={handleCancelTransaction} style={{ marginLeft: '1rem', color: 'red' }}>
        Cancel Transaction
      </button>
    </div>
  );
};

export default CartAndPayment;
