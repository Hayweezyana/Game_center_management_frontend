import React, { useState } from 'react';

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
  paymentMethods: { method: string; amount: number; }[];
  setPaymentMethods: React.Dispatch<React.SetStateAction<{ method: string; amount: number; }[]>>;
  onNext: () => void;
}

const CartAndPayment: React.FC<CartAndPaymentProps> = ({
  cartItems,
  cartTotal,
  onNext,
}) => {
  const [isPaying, setIsPaying] = useState(false);

  const handlePayWithPaystack = () => {
    setIsPaying(true);

    const paystack = (window as any).PaystackPop.setup({
      key: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY, // Replace with your public key
      email: 'immersiavr@immersiavr.com', // Replace with actual user's email
      amount: cartTotal * 100,
      currency: 'NGN',
      metadata: {
        cartItems: cartItems.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          duration: item.gameDuration,
        })),
      },
      callback: function (response: any) {
        console.log('Payment successful. Reference:', response.reference);
        setIsPaying(false);
        onNext(); // ✅ Proceed after successful payment
      },
      onClose: function () {
        setIsPaying(false);
        alert('Transaction was not completed.');
      },
    });

    paystack.openIframe();
  };

  return (
    <div>
      <ul>
        {cartItems.map((item, index) => (
          <li key={index}>
            {item.title} - ₦{item.price} x {item.quantity} = ₦{item.price * item.quantity}
          </li>
        ))}
      </ul>
      <h2>Total: ₦{cartTotal}</h2>

      <button onClick={handlePayWithPaystack} disabled={isPaying}>
        {isPaying ? 'Processing payment...' : 'Pay with Paystack'}
      </button>
    </div>
  );
};

export default CartAndPayment;