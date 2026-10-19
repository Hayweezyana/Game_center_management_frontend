import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './logo/immersia.png';
import './WelcomePage.css';
import { getRoutePrefetchProps } from '../utils/routePrefetch';

const useBodyTheme = () => {
  const get = () => ({
    isEid:          document.body.classList.contains('eid-theme'),
    isEaster:       document.body.classList.contains('easter-theme'),
    isGoodFriday:   document.body.classList.contains('easter-friday'),
    isIndependence: document.body.classList.contains('independence-theme'),
  });
  const [theme, setTheme] = React.useState(get);
  React.useEffect(() => {
    const observer = new MutationObserver(() => setTheme(get()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return theme;
};

// Line-art game icons that drift around the background. Purely decorative.
const DECOR_ICONS: Record<string, React.ReactNode> = {
  headset: (
    <svg viewBox="0 0 64 40" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
      <path d="M9 6h46a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H42l-6-7h-8l-6 7H9a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6z" fill="currentColor" fillOpacity=".08" />
      <circle cx="19" cy="19" r="6" />
      <circle cx="45" cy="19" r="6" />
      <path d="M3 15H0M64 15h-3" />
    </svg>
  ),
  controller: (
    <svg viewBox="0 0 64 40" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 6h30c8 0 13 8 14.5 19 1.2 8.5-6 12.5-11 6.5L45 26H19l-5.5 5.5c-5 6-12.2 2-11-6.5C4 14 9 6 17 6z" fill="currentColor" fillOpacity=".08" />
      <path d="M17 13v10M12 18h10" />
      <circle cx="44" cy="15" r="1.8" fill="currentColor" />
      <circle cx="50" cy="20" r="1.8" fill="currentColor" />
    </svg>
  ),
  joystick: (
    <svg viewBox="0 0 48 56" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="12" r="8" fill="currentColor" fillOpacity=".15" />
      <path d="M24 20v18" />
      <path d="M6 40h36l3 10H3z" fill="currentColor" fillOpacity=".08" />
      <circle cx="37" cy="45" r="1.6" fill="currentColor" />
    </svg>
  ),
  token: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
      <circle cx="24" cy="24" r="20" fill="currentColor" fillOpacity=".08" />
      <circle cx="24" cy="24" r="14" strokeDasharray="3 4" />
      <path d="M24 15l2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L24 29.4l-5.6 2.9 1.1-6.2-4.5-4.4 6.2-.9z" fill="currentColor" fillOpacity=".3" />
    </svg>
  ),
  cube: (
    <svg viewBox="0 0 48 52" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
      <path d="M24 3l20 11v24L24 49 4 38V14z" fill="currentColor" fillOpacity=".06" />
      <path d="M4 14l20 11 20-11M24 25v24" />
    </svg>
  ),
};

const FLOATERS = [
  { icon: 'headset', className: 'wp-float--a' },
  { icon: 'controller', className: 'wp-float--b' },
  { icon: 'joystick', className: 'wp-float--c' },
  { icon: 'token', className: 'wp-float--d' },
  { icon: 'cube', className: 'wp-float--e' },
  { icon: 'token', className: 'wp-float--f' },
];

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const { isEid: isEidTheme, isEaster: isEasterTheme, isGoodFriday, isIndependence } = useBodyTheme();
  const yearsOfIndependence = currentYear - 1960;

  return (
    <div className="welcome-page">
        <div className="wp-decor" aria-hidden="true">
          <span className="wp-aurora wp-aurora--1" />
          <span className="wp-aurora wp-aurora--2" />
          <span className="wp-aurora wp-aurora--3" />
          <span className="wp-floor" />
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className={`wp-spark wp-spark--${i + 1}`} />
          ))}
          {FLOATERS.map(f => (
            <span key={f.className} className={`wp-float ${f.className}`}>{DECOR_ICONS[f.icon]}</span>
          ))}
        </div>
        <div className="content-wrapper">
          <div className="logo-container">
            <div className="logo-stage">
              <span className="logo-ring" aria-hidden="true" />
              <img src={logo} alt="Immersia Logo" className={`logo${isEidTheme ? ' logo-eid' : ''}`} />
            </div>
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
            {isIndependence ? (
              <div className="ng-welcome-section">
                <div className="ng-welcome-flag" aria-hidden="true">
                  <span /><span /><span />
                </div>
                <h2 className="ng-welcome-heading">Happy Independence Day</h2>
                <p className="ng-welcome-sub">
                  Nigeria @ {yearsOfIndependence} — one nation, one love, endless play. 🎉
                </p>
              </div>
            ) : null}
            <h1 className="title">Welcome to Immersia</h1>
            <p className="subtitle">
              {isIndependence
                ? 'Celebrate Independence Day with us — games, fun, and green-white-green vibes all day.'
                : isEasterTheme
                ? (isGoodFriday ? 'Games, community, and a moment of peace.' : 'Celebrate Easter with us — games, fun, and unforgettable moments await.')
                : isEidTheme
                  ? 'Celebrate Eid with us — games, fun, and unforgettable moments await.'
                  : 'Arcade energy. Rewarded gameplay. Next-level sessions.'}
            </p>
          </div>

          <div className="button-container">
            <button
              className="welcome-button customer-button"
              style={{ '--i': 0 } as React.CSSProperties}
              onClick={() => navigate('/GameSelection')}
              {...getRoutePrefetchProps('/gameselection')}
            >
              <span className="button-icon">PLY</span>
              Let&apos;s play
            </button>
            <button
              className="welcome-button customer-button"
              style={{ '--i': 1 } as React.CSSProperties}
              onClick={() => navigate('/customer-portal')}
            >
              <span className="button-icon">XP</span>
              Customer Portal
            </button>
            <button
              className="welcome-button rentals-button"
              style={{ '--i': 2 } as React.CSSProperties}
              onClick={() => navigate('/rentals')}
              {...getRoutePrefetchProps('/rentals')}
            >
              <span className="button-icon">VR</span>
              Immersia Rentals
              <span className="rentals-button-new">New</span>
            </button>
          </div>

          {/* Static pages outside the app (scripts/build-technologies.js), so a
              plain link and a full page load rather than navigate(). */}
          <a className="studio-banner" href="/technologies">
            <span className="studio-banner-glyph" aria-hidden="true">IT</span>
            <span className="studio-banner-copy">
              <span className="studio-banner-kicker">Our software studio</span>
              <strong>Immersion Technologies</strong>
              <span className="studio-banner-sub">
                POS, commerce, compliance and AI brand experiences — ten products, ₦349M+ through them.
              </span>
            </span>
            <span className="studio-banner-cta">
              See our work <span aria-hidden="true">→</span>
            </span>
          </a>
        </div>

      <footer className="welcome-footer">
        <p>&copy; {currentYear} Immersia. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default WelcomePage;
