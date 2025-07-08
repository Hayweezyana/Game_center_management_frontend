import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

interface User {
  id: string;
  name: string;
  email: string[];
  password_hash: string;
  slug?: string;
}

type AuthMode = 'register' | 'login' | 'forgot';

const OperatorAuth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const socket: Socket = io('ws://127.0.0.1:2024', { transports: ['websocket'] });

  // Form states
  const [registerData, setRegisterData] = useState({
    name: '',
    email: [''],
    password: ''
  });
  const [loginData, setLoginData] = useState({
    name: '',
    password: ''
  });
  const [forgotData, setForgotData] = useState({
    email: ''
  });

  // Handle registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Sending register payload:', {
  name: registerData.name,
  email: registerData.email[0],
  password: registerData.password
});

      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators/register`, {
        name: registerData.name,
        email: registerData.email[0],
        password: registerData.password
      });

      if (res.data.status) {
        setMessage('Operator created successfully');
        setRegisterData({ name: '', email: [''], password: '' });
        fetchUsers();
      }
    } catch (err: any) {
      if (err.response) {
        if (err.response.status === 409) {
          setError('An operator with this name already exists.');
        } else {
          setError('Registration failed. Please try again.');
        }
      } else {
        setError('Network error. Please check your connection.');
      }
    }
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators/login`, {
        name: loginData.name,
        password: loginData.password
      });

      localStorage.setItem('operatorToken', res.data.token);
      navigate('/OperatorDashboard'); // Or your success route
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  // Handle password recovery
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators/:id`, {
        email: forgotData.email
      });
      setMessage('Password reset instructions sent to your email.');
      setForgotData({ email: '' });
    } catch (err) {
      setError('Failed to send reset instructions. Try again.');
    }
  };

  // Fetch users (for admin view)
  const fetchUsers = async () => {
    try {
      const res = await axios.get<{ status: boolean; data: User[] }>(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators`
      );
      if (res.data.status) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    // Only fetch users if in register mode (admin view)
    if (mode === 'register') {
      fetchUsers();
    }
  }, [mode]);

  // Handle user deletion
  const handleDeleteUser = async (id: string) => {
    try {
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators/${id}`);
      socket.emit('deleteUser', id);
      setUsers(prevUsers => prevUsers.filter(user => user.id !== id));
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-tabs">
        <button 
          onClick={() => setMode('login')}
          className={mode === 'login' ? 'active' : ''}
        >
          Login
        </button>
        <button 
          onClick={() => setMode('register')}
          className={mode === 'register' ? 'active' : ''}
        >
          Register
        </button>
        <button 
          onClick={() => setMode('forgot')}
          className={mode === 'forgot' ? 'active' : ''}
        >
          Forgot Password
        </button>
      </div>

      {message && <div className="message">{message}</div>}
      {error && <div className="error">{error}</div>}

      {mode === 'register' && (
        <form onSubmit={handleRegister} className="auth-form">
          <h2>Operator Registration</h2>
          <input
            value={registerData.name}
            onChange={(e) => setRegisterData({...registerData, name: e.target.value})}
            placeholder="Name"
            required
          />
          <input
            value={registerData.email[0] || ''}
            onChange={(e) => setRegisterData({...registerData, email: [e.target.value]})}
            placeholder="Email"
            type="email"
            required
          />
          <input
            type="password"
            value={registerData.password}
            onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
            placeholder="Password"
            required
          />
          <button type="submit">Register</button>

          {/* Admin view of registered operators */}
          <div className="users-list">
            <h3>Registered Operators</h3>
            <ul>
              {users.map(user => (
                <li key={user.id}>
                  {user.name} - {Array.isArray(user.email) ? user.email.join(', ') : user.email}
                  {/* <button 
                    type="button"
                    onClick={() => handleDeleteUser(user.id)}
                    className="delete-btn"
                  >Delete</button> */}
                </li>
              ))}
            </ul>
          </div>
        </form>
      )}

      {mode === 'login' && (
        <form onSubmit={handleLogin} className="auth-form">
          <h2>Operator Login</h2>
          <input
            value={loginData.name}
            onChange={(e) => setLoginData({...loginData, name: e.target.value})}
            placeholder="Name"
            required
          />
          <input
            type="password"
            value={loginData.password}
            onChange={(e) => setLoginData({...loginData, password: e.target.value})}
            placeholder="Password"
            required
          />
          <button type="submit">Login</button>
          <button 
            type="button"
            onClick={() => setMode('forgot')}
            className="forgot-link"
          >
            Forgot Password?
          </button>
        </form>
      )}

      {mode === 'forgot' && (
        <form onSubmit={handleForgotPassword} className="auth-form">
          <h2>Reset Password</h2>
          <input
            value={forgotData.email}
            onChange={(e) => setForgotData({email: e.target.value})}
            placeholder="Email"
            type="email"
            required
          />
          <button type="submit">Send Reset Link</button>
          <button 
            type="button"
            onClick={() => setMode('login')}
            className="back-link"
          >
            Back to Login
          </button>
        </form>
      )}
    </div>
  );
};

export default OperatorAuth;