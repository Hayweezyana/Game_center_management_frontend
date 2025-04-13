import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './logo/immersia.png';
//import MovingSanta from "./MovingSanta";
import './WelcomePage.css';

const WelcomePage: React.FC = () => {
    const navigate = useNavigate();
    const currentYear = new Date().getFullYear();

    return (
        <div className="welcome-page">
            <div className="content-wrapper">
                <div className="logo-container">
                    <img src={logo} alt="Immersia Logo" className="logo" />
                    <h1 className="title">Welcome to Immersia</h1>
                </div>
                
                <div className="button-container">
                    <button 
                        className="welcome-button admin-button" 
                        onClick={() => navigate('/adminlogin')}
                    >
                        <span className="button-icon">👑</span>
                        Admin Portal
                    </button>
                    <button 
                        className="welcome-button customer-button" 
                        onClick={() => navigate('/GameSelection')}
                    >
                        <span className="button-icon">🎮</span>
                        Shall We?
                    </button>
                </div>
            </div>

            <footer className="welcome-footer">
                <p>&copy; {currentYear} Immersia. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default WelcomePage;