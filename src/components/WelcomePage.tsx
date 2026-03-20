import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './logo/immersia.png';
import './WelcomePage.css';
import { getRoutePrefetchProps } from '../utils/routePrefetch';

const useEidTheme = () => {
  const [isEid, setIsEid] = React.useState(() => document.body.classList.contains('eid-theme'));
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsEid(document.body.classList.contains('eid-theme'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isEid;
};

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const isEidTheme = useEidTheme();

  return (
    <div className="welcome-page">
        <div className="content-wrapper">
          <div className="logo-container">
            <img src={logo} alt="Immersia Logo" className={`logo${isEidTheme ? ' logo-eid' : ''}`} />
            {isEidTheme ? (
              <div className="eid-welcome-section">
                <div className="eid-welcome-icons">
                  <span className="eid-icon-star">★</span>
                  <span className="eid-icon-crescent">☪</span>
                  <span className="eid-icon-star">★</span>
                </div>
                <h2 className="eid-welcome-heading">Eid Mubarak</h2>
                <p className="eid-welcome-sub">من إمرشيا — May your Eid be filled with joy & winning streaks!</p>
              </div>
            ) : null}
            <h1 className="title">{isEidTheme ? 'Welcome to Immersia' : 'Welcome to Immersia'}</h1>
            <p className="subtitle">
              {isEidTheme
                ? 'Celebrate Eid with us — games, fun, and unforgettable moments await.'
                : 'Arcade energy. Rewarded gameplay. Next-level sessions.'}
            </p>
          </div>

          <div className="button-container">
            <button className="welcome-button admin-button" onClick={() => navigate('/adminlogin')}>
              <span className="button-icon">ADM</span>
              Admin Portal
            </button>
            <button
              className="welcome-button customer-button"
              onClick={() => navigate('/GameSelection')}
              {...getRoutePrefetchProps('/gameselection')}
            >
              <span className="button-icon">PLY</span>
              Let&apos;s play
            </button>
            <button className="welcome-button customer-button" onClick={() => navigate('/customer-portal')}>
              <span className="button-icon">XP</span>
              Customer Portal
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
