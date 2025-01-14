import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AdminLogin.css';

const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);

  const navigate = useNavigate();

  interface LoginResponse {
    message: string;
    token: string;
  }

  // Handle admin login
  const handleLogin = async () => {
    try {
      const response = await axios.post<LoginResponse>(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles`, {
        username,
        password,
      });

      const data = response.data as LoginResponse;
      alert(data.message);

      // Store token securely in localStorage
      localStorage.setItem('token', response.data.token);

      console.log('Login successful, token stored');
      navigate('./admin');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Login failed');
    }
  };

  // Handle password reset
  const handleResetPassword = async () => {
    try {
      const response = await axios.post<{ message: string }>(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/reset-password`, {
        username,
        newPassword,
      });

      alert(response.data.message);
      setIsResettingPassword(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Password reset failed');
    }
  };

  // Handle user creation
  const handleCreateUser = async () => {
    try {
      const response = await axios.post<{ message: string }>(`${process.env.REACT_APP_BACKEND_URL}/v1/user/create`, {
        username,
        password,
      });

      alert(response.data.message);
      setIsCreatingUser(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Admin creation failed');
    }
  };

  // Logout function (clear token)
  const handleLogout = () => {
    localStorage.removeItem('token');
    alert('Logged out successfully');
    navigate('/');
  };

  return (
    <div className="admin-login-container">
      <h1>Admin Panel</h1>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      {!isResettingPassword && !isCreatingUser ? (
        <>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleLogin}>Login</button>
          <button onClick={() => setIsResettingPassword(true)}>Forgot Password?</button>
          <button onClick={() => setIsCreatingUser(true)}>Create Admin</button>
        </>
      ) : isResettingPassword ? (
        <>
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button onClick={handleResetPassword}>Reset Password</button>
          <button onClick={() => setIsResettingPassword(false)}>Cancel</button>
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleCreateUser}>Create Admin</button>
          <button onClick={() => setIsCreatingUser(false)}>Cancel</button>
        </>
      )}
      <br />
      <button onClick={handleLogout} style={{ marginTop: '20px' }}>
        Logout
      </button>
    </div>
  );
};

export default AdminLogin;
