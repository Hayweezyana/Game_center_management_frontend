import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Define TypeScript interfaces for payment methods and props
interface PaymentMethod {
  method: string;
  amount: number;
}

interface PaymentFormProps {
  cartTotal: number;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ cartTotal }) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { method: 'cash', amount: cartTotal },
  ]);
  const [remainingAmount, setRemainingAmount] = useState<number>(cartTotal);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Update remaining amount when payment methods change
  useEffect(() => {
    const totalPaid = paymentMethods.reduce((sum, method) => sum + method.amount, 0);
    setRemainingAmount(cartTotal - totalPaid);
  }, [paymentMethods, cartTotal]);

  const validateEmail = (email: string): boolean => /\S+@\S+\.\S+/.test(email);
  const validatePhone = (phone: string): boolean => /^\d{10,15}$/.test(phone);

  const handleAddPaymentMethod = () => {
    if (remainingAmount > 0) {
      setPaymentMethods([...paymentMethods, { method: 'cash', amount: 0 }]);
    }
  };

  const handlePaymentChange = (index: number, field: keyof PaymentMethod, value: string | number) => {
    const updatedMethods = [...paymentMethods];
    if (field === 'amount') {
      updatedMethods[index][field] = parseFloat(value as string);
    } else {
      updatedMethods[index][field] = value as string;
    }
    setPaymentMethods(updatedMethods);
};

  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const totalPaid = paymentMethods.reduce((sum, method) => sum + method.amount, 0);
    if (totalPaid !== cartTotal) {
      alert('Total payment must equal the cart total.');
      return;
    }

    // Simulate payment processing
    try {
      paymentMethods.forEach(({ method, amount }) => {
        console.log(`Processing ${method} payment of ₦${amount}`);
        // Assume all payments succeed for now
      });

      alert('Payment successful!');
      navigate('/PC', { state: { paymentStatus: 'success', email, phone, cartTotal } });
    } catch (error) {
      console.error('Error during payment:', error);
      alert('There was an error processing your payment.');
    }
  };

  const createUser = async (phone: string, email?: string) => {
    try {
      const requestBody: { phone: string; email?: string } = { phone };
      if (email) {
        requestBody.email = email;
      }
  
      const response = await fetch(`http://localhost:2024/v1/admin/users/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        throw new Error('Failed to create user');
      }
      const user = await response.json();
      console.log('User created:', user);
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Failed to create user');
    }
  }

  const getUserById = async (phone: string) => {
    try {
      const response = await fetch(`http://localhost:2024/v1/admin/users/:userId?phone=${phone}`);
      if (!response.ok) {
        throw new Error('User not found');
      }
      const user = await response.json();
      console.log('User found:', user);
      // You can add more logic here to handle the user data
    } catch (error) {
      console.error('Error fetching user:', error);
      setError('User not found');
    }
  }

  return (
    <form onSubmit={handlePaymentSubmit}>
      <label htmlFor="email">Email:</label>
      <label htmlFor="email">Email:</label>
      <input
        type="email"
        id="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter email (optional)"
      />
      {!validateEmail(email) && email && <p className="error">Invalid email format</p>}

      <label htmlFor="phone">Phone Number:</label>
      <input
        type="tel"
        id="phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Enter phone number"
        required
      />
      {!validatePhone(phone) && phone && <p className="error">Invalid phone number</p>}
      <button type="button" onClick={() => {
        createUser(phone);}}>
        Add User
      </button>

      <label htmlFor="cartTotal">Cart Total:</label>
      <input type="number" id="cartTotal" value={cartTotal} disabled />

      <label htmlFor="remainingAmount">Remaining Amount:</label>
      <input type="number" id="remainingAmount" value={remainingAmount} disabled />

      {paymentMethods.map((method, index) => (
        <div key={index}>
          <label htmlFor={`paymentMethod${index}`}>Payment Method {index + 1}:</label>
          <select
            id={`paymentMethod${index}`}
            value={method.method}
            onChange={(e) => handlePaymentChange(index, 'method', e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="pos">POS</option>
            <option value="transfer">Bank Transfer</option>
          </select>

          <label htmlFor={`amount${index}`}>Amount:</label>
          <input
            type="number"
            id={`amount${index}`}
            value={method.amount}
            onChange={(e) => handlePaymentChange(index, 'amount', e.target.value)}
            min="0"
            max={remainingAmount + method.amount}
            required
          />

          {method.method === 'transfer' && (
            <div>
              <h4>Bank Account Details:</h4>
              <p>Account Name: OLUWASEUN Aina-SCOTT MODUPEOLA</p>
              <p>Account Number: 611 162 7471</p>
              <p>Bank: OPAY</p>
            </div>
          )}
        </div>
      ))}

      <button type="button" onClick={handleAddPaymentMethod} disabled={remainingAmount === 0}>
        Add Payment Method
      </button>

      <button type="submit" disabled={remainingAmount > 0}>
        Pay Now
      </button>

      {error && <p className="error">{error}</p>}
    </form>
  );
};

export default PaymentForm;
