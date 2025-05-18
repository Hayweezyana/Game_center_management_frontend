import React, { useState } from 'react';
import axios from 'axios';

const OperatorLogin = ({ onLogin }: { onLogin: (operator: any, token: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators/login`, {
        email,
        password,
      });

      localStorage.setItem('operatorToken', res.data.token);
      onLogin(res.data.operator, res.data.token);
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Operator Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
      <button type="submit">Login</button>
    </form>
  );
};

export default OperatorLogin;
