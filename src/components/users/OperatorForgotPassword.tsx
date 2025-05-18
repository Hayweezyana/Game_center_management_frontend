// OperatorForgotPassword.tsx
import React, { useState } from 'react';
import axios from 'axios';

const OperatorForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators/forgot-password`, { email });
      setMessage('Password reset instructions sent.');
    } catch (err) {
      setMessage('Failed to send instructions. Try again.');
    }
  };

  return (
    <form onSubmit={handleForgot}>
      <h2>Forgot Password</h2>
      {message && <p>{message}</p>}
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
      <button type="submit">Send Reset Link</button>
    </form>
  );
};

export default OperatorForgotPassword;
