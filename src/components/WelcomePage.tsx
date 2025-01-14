import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './logo/immersia.png';
import MovingSanta from "./MovingSanta";
import './WelcomePage.css';

const WelcomePage: React.FC = () => {
    const navigate = useNavigate();
    const currentYear = new Date().getFullYear();

    return (
        <div className="welcome-page">
            <div className="logo-placeholder">
                <h1>Welcome to Immersia</h1>
                <img src={logo} alt="Immersia Logo" style={{ width: "300px", height: "auto" }} />
            </div>
            <div className="button-container">
                <button className="welcome-button admin-button" onClick={() => navigate('/admin')}>
                    Enter as Admin
                </button>
                <button className="welcome-button customer-button" onClick={() => navigate('/GameSelection')}>
                    Enter as Customer
                </button>
            </div>
            <footer className="welcome-footer">
                <p>&copy; {currentYear} Immersia. All rights reserved.</p>
            </footer>
            <MovingSanta />
        </div>
    );
};

export default WelcomePage;
