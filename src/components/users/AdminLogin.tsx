import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaArrowLeft } from 'react-icons/fa';
import './AdminLogin.css';

interface AdminLoginProps {
  onLoginSuccess: (name: string) => void;
  onClose: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onClose }) => {
  const [name, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);
  const [passwordShown, setPasswordShown] = useState<boolean>(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  interface LoginResponse {
    message: string;
    token: string;
    role: any;
  }

  // Handle admin login
  const handleLogin = async () => {
    setIsLoading(true);
    try {
      if (!name || !password) {
        alert('Please enter both username and password');
        return;
      }
      if (password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
      }

      console.log("Attempting login with:", { name, password });

      const response = await axios.post<LoginResponse>(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/login`, {
        name,
        password,
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const { token, role } = response.data;
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('adminData', JSON.stringify(role));
    navigate('/admin');
    
  } catch (error: any) {
    console.error('Login error:', error);
    alert(error.response?.data?.message || 'Login failed. Please check your credentials.');
  } finally {
    setIsLoading(false);
  }
};

  // Handle password reset (no hashing here)
  const handleResetPassword = async () => {
    try {
      if (newPassword !== confirmPassword) {
        alert('Passwords do not match');
        return;
      }

      if (newPassword.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
      }

      const userResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/${name}`);
      if (!userResponse.data || !userResponse.data.data) {
        throw new Error('User not found');
      }

      const userData = userResponse.data.data;

      const response = await axios.put(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/${userData.id}`, {
        name,
        current_password: oldPassword,
        new_password: newPassword,
        permissions: userData.permissions?.length ? userData.permissions : [crypto.randomUUID()],
      });

      alert(response.data.message);
      setIsResettingPassword(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Password reset failed');
    }
  };

  const handleBackToLogin = () => {
    setIsResettingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="admin-login-container">
      <div className="login-card">
        {isResettingPassword ? (
          <div className="password-reset-form">
            <button className="back-button" onClick={handleBackToLogin}>
              <FaArrowLeft /> Back to Login
            </button>
            <h2>Reset Password</h2>
            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={name}
                onChange={(e) => setUsername(e.target.value)}
                className="floating-input"
              />
              <label className="floating-label">Admin Username</label>
            </div>
            <div className="input-group">
              <input
                type={showOldPassword ? 'text' : 'password'}
                placeholder=" "
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="floating-input"
              />
              <label className="floating-label">Old Password</label>
              <span className="password-toggle-icon" onClick={() => setShowOldPassword(!showOldPassword)}>
                {showOldPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
            <div className="input-group">
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder=" "
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="floating-input"
              />
              <label className="floating-label">New Password</label>
              <span className="password-toggle-icon" onClick={() => setShowNewPassword(!showNewPassword)}>
                {showNewPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
            <div className="input-group">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder=" "
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="floating-input"
              />
              <label className="floating-label">Confirm Password</label>
              <span className="password-toggle-icon" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
            <button className="primary-btn" onClick={handleResetPassword}>
              Reset Password
            </button>
          </div>
        ) : (
          <>
            <div className="card-header">
              <h1>Admin Portal</h1>
              <div className="logo-placeholder">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
                    fill="#4A6CF7"
                  />
                </svg>
              </div>
            </div>

            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={name}
                onChange={(e) => setUsername(e.target.value)}
                className="floating-input"
              />
              <label className="floating-label">Admin Username</label>
            </div>

            <div className="input-group">
              <div className="password-input-container">
                <input
                  type={passwordShown ? 'text' : 'password'}
                  placeholder=" "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="floating-input"
                />
                <label className="floating-label">Password</label>
                <span className="password-toggle-icon" onClick={() => setPasswordShown(!passwordShown)}>
                  {passwordShown ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
            </div>

            <div className="button-group">
              <button className="primary-btn" onClick={handleLogin} disabled={isLoading}>
                {isLoading ? <span className="loading-spinner"></span> : <span>Login</span>}
              </button>

              <div className="action-links">
                <button className="text-btn" onClick={() => setIsResettingPassword(true)}>
                  Forgot Password?
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminLogin;
