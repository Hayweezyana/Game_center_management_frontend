import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './logo/immersia.png';
import './WelcomePage.css';
import { getRoutePrefetchProps } from '../utils/routePrefetch';
import ComingSoonModal from './ComingSoonModal';

const useBodyTheme = () => {
  const get = () => ({
    isEid:          document.body.classList.contains('eid-theme'),
    isEaster:       document.body.classList.contains('easter-theme'),
    isGoodFriday:   document.body.classList.contains('easter-friday'),
  });
  const [theme, setTheme] = React.useState(get);
  React.useEffect(() => {
    const observer = new MutationObserver(() => setTheme(get()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return theme;
};

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const { isEid: isEidTheme, isEaster: isEasterTheme, isGoodFriday } = useBodyTheme();
  const [showComingSoon, setShowComingSoon] = React.useState(false);

  const goToGames = React.useCallback(() => {
    setShowComingSoon(false);
    navigate('/GameSelection');
  }, [navigate]);

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
            {isEasterTheme ? (
              <div className="easter-welcome-section">
                <div className="easter-welcome-icons">
                  {isGoodFriday
                    ? <><span>✝️</span><span>🕊️</span><span>✝️</span></>
                    : <><span>🌷</span><span>🐣</span><span>🌸</span></>
                  }
                </div>
                <h2 className="easter-welcome-heading">
                  {isGoodFriday ? 'Good Friday' : 'Happy Easter!'}
                </h2>
                <p className="easter-welcome-sub">
                  {isGoodFriday
                    ? 'A day of reflection & hope — from all of us at Immersia.'
                    : 'New beginnings & great sessions await you this Easter!'}
                </p>
              </div>
            ) : null}
            <h1 className="title">Welcome to Immersia</h1>
            <p className="subtitle">
              {isEasterTheme
                ? (isGoodFriday ? 'Games, community, and a moment of peace.' : 'Celebrate Easter with us — games, fun, and unforgettable moments await.')
                : isEidTheme
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
              onClick={() => setShowComingSoon(true)}
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

      <ComingSoonModal
        open={showComingSoon}
        onClose={() => setShowComingSoon(false)}
        onContinue={goToGames}
      />

      <footer className="welcome-footer">
        <p>&copy; {currentYear} Immersia. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default WelcomePage;
