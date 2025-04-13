import React from 'react';

interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  gameDuration: number;
}

interface PaymentMethod {
  method: string;
  amount: number;
}

interface CartAndPaymentProps {
  cartItems: CartItem[];
  cartTotal: number;
  paymentMethods: PaymentMethod[];
  setPaymentMethods: (methods: PaymentMethod[]) => void;
  onNext: () => void;
}

const CartAndPayment: React.FC<CartAndPaymentProps> = ({
  cartItems,
  cartTotal,
  paymentMethods,
  setPaymentMethods,
  onNext,
}) => {
  const handleAddPaymentMethod = () => {
    if (cartTotal > paymentMethods.reduce((sum, method) => sum + method.amount, 0)) {
      setPaymentMethods([...paymentMethods, { method: '', amount: 0 }]);
    }
  };

  const handlePaymentChange = (index: number, field: keyof PaymentMethod, value: string | number) => {
    const updatedMethods = [...paymentMethods];
    if (field === 'amount') {
      updatedMethods[index][field] = Number(value);
    } else if (field === 'method') {
      updatedMethods[index][field] = value as string;
    }
    setPaymentMethods(updatedMethods);
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
      <h2>Payment Methods</h2>
      {paymentMethods.map((method, index) => (
        <div key={index}>
          <select
            value={method.method}
            onChange={(e) => handlePaymentChange(index, 'method', e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="pos">POS</option>
            <option value="transfer">Bank Transfer</option>
          </select>
          <input
            type="number"
            value={method.amount}
            onChange={(e) => handlePaymentChange(index, 'amount', e.target.value)}
            min="0"
            max={cartTotal}
          />
        </div>
      ))}
      <button onClick={handleAddPaymentMethod}>Add Payment Method</button>
      <button onClick={onNext}>Next</button>
    </div>
  );
};

export default CartAndPayment;