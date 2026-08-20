import { CartProvider } from './components/hooks/useCart';
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import './App.css';
import immersiaLogo from './components/logo/immersia.png';
import { trackPageView } from './utils/metaPixel';
import { trackRoute } from './utils/visitTracking';
import WhatsAppButton from './components/WhatsAppButton';

const WelcomePage = lazy(() => import('./components/WelcomePage'));
const Checkout = lazy(() => import('./components/checkout'));
const Queue = lazy(() => import('./components/Queue'));
const GameSelection = lazy(() => import('./components/GameSelection'));
const PC = lazy(() => import('./components/PC'));
const Ticket = lazy(() => import('./components/Ticket'));
const Report = lazy(() => import('./components/report'));
const PaymentSelection = lazy(() => import('./components/PaymentSelection'));
const CartAndPayment = lazy(() => import('./components/CartAndPayment'));
const UserDetails = lazy(() => import('./components/UserDetails'));
const ImmersiaPaymentPage = lazy(() => import('./components/ImmersiaPaymentPage'));
const FunstationPaymentPage = lazy(() => import('./components/FunstationPaymentPage'));
const PaystackPaymentPage = lazy(() => import('./components/PaystackPaymentPage'));
const GKGPaymentPage = lazy(() => import('./components/GKGPaymentPage'));
const AIChatBox = lazy(() => import('./components/AIChatBox'));
const AdminLogin = lazy(() => import('./components/users/AdminLogin'));
const Admin = lazy(() => import('./components/users/Admin'));
const CreateAdminForm = lazy(() => import('./components/users/CreateAdminForm'));
const AdminPaymentPage = lazy(() => import('./components/users/AdminPaymentPage'));
const OperatorAuth = lazy(() => import('./components/users/OperatorAuth'));
const DrinkInventory = lazy(() => import('./components/users/DrinkInventory'));
const OperatorConsumedGames = lazy(() => import('./components/users/OperatorConsumedGames'));
const AdminTransaction = lazy(() => import('./components/users/Admintransaction'));
const MarketersReportPage = lazy(() => import('./components/MarketersReportPage'));
const InternalControlEntry = lazy(() => import('./components/InternalControlEntry'));
const InternalControlDashboard = lazy(() => import('./components/InternalControlDashboard'));
const CustomerPortal = lazy(() => import('./components/customer/CustomerPortal'));
const TennisLiveScore = lazy(() => import('./components/TennisLiveScore'));
const CreditPaymentPage = lazy(() => import('./components/CreditPaymentPage'));

const RouteLoader: React.FC = () => (
  <div className="route-loader" role="status" aria-live="polite">
    Loading...
  </div>
);

// Requires either an admin session token or an operator token
const PrivateRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const hasAdminToken    = Boolean(sessionStorage.getItem('token'));
  const hasOperatorToken = Boolean(localStorage.getItem('operatorToken'));
  if (!hasAdminToken && !hasOperatorToken) {
    return <Navigate to="/AdminLogin" replace />;
  }
  return element;
};

// ── Children's Day — May 27 only (disappears at midnight) ────────
const CHILDRENS_DAY_DATE     = '2026-05-27';
const CHILDRENS_DAY_DISMISS_KEY = `childrens-day-dismissed:${CHILDRENS_DAY_DATE}`;

const isChildrensDayActiveAt = (date: Date) => {
  const start = new Date(2026, 4, 27, 0, 0, 0, 0); // May 27 00:00
  const end   = new Date(2026, 4, 28, 0, 0, 0, 0); // May 28 00:00
  return date >= start && date < end;
};

// ── Eid al-Adha 2026 — May 27 through end of Sunday May 31 ───────
const EID_THEME_DATE = (process.env.REACT_APP_EID_THEME_DATE || '').trim() || '2026-05-27';
// Theme is active from EID_THEME_DATE through EID_THEME_END_DATE (exclusive — midnight that day)
const EID_THEME_END_DATE = (process.env.REACT_APP_EID_THEME_END_DATE || '').trim() || '2026-06-01';
const EID_BANNER_DISMISS_KEY = `eid-adha-banner-dismissed:${EID_THEME_DATE}`;

// Easter theme: Good Friday → Easter Monday (inclusive)
const EASTER_START_DATE = (process.env.REACT_APP_EASTER_START_DATE || '').trim() || '2026-04-03';
const EASTER_END_DATE   = (process.env.REACT_APP_EASTER_END_DATE   || '').trim() || '2026-04-07';
const EASTER_BANNER_DISMISS_KEY = `easter-banner-dismissed:${EASTER_START_DATE}`;

const isEasterThemeActiveAt = (date: Date) => {
  const [sY, sM, sD] = EASTER_START_DATE.split('-').map(Number);
  const [eY, eM, eD] = EASTER_END_DATE.split('-').map(Number);
  if (!isValidDateParts(sY, sM, sD) || !isValidDateParts(eY, eM, eD)) return false;
  const start = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
  const end   = new Date(eY, eM - 1, eD, 0, 0, 0, 0);
  return date >= start && date < end;
};

const isGoodFridayAt = (date: Date) => {
  const [sY, sM, sD] = EASTER_START_DATE.split('-').map(Number);
  if (!isValidDateParts(sY, sM, sD)) return false;
  return date.getFullYear() === sY && date.getMonth() === sM - 1 && date.getDate() === sD;
};

const CUSTOMER_FACING_PATHS = new Set([
  '/',
  '/gameselection',
  '/checkout',
  '/userdetails',
  '/cartandpayment',
  '/queue',
  '/pc',
  '/ticket',
  '/paymentselection',
  '/immersiapaymentpage',
  '/funstationpaymentpage',
  '/paystackpaymentpage',
  '/gkgpaymentpage',
  '/customer-portal',
  '/tennislive',
]);

const isValidDateParts = (year: number, month: number, day: number) =>
  Number.isFinite(year) &&
  Number.isFinite(month) &&
  Number.isFinite(day) &&
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= 31;

const isEidThemeActiveAt = (date: Date) => {
  const [sY, sM, sD] = EID_THEME_DATE.split('-').map(Number);
  const [eY, eM, eD] = EID_THEME_END_DATE.split('-').map(Number);

  if (!isValidDateParts(sY, sM, sD) || !isValidDateParts(eY, eM, eD)) {
    return false;
  }

  const start = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
  // end is midnight of EID_THEME_END_DATE (theme expires when that day begins)
  const end = new Date(eY, eM - 1, eD, 0, 0, 0, 0);
  return date >= start && date < end;
};

const AppShell: React.FC = () => {
  const location = useLocation();

  const [isChildrensDayActive, setIsChildrensDayActive] = React.useState<boolean>(() => isChildrensDayActiveAt(new Date()));
  const [isChildrensDayDismissed, setIsChildrensDayDismissed] = React.useState<boolean>(() => {
    try { return window.localStorage.getItem(CHILDRENS_DAY_DISMISS_KEY) === '1'; } catch { return false; }
  });

  const [isEidThemeActive, setIsEidThemeActive] = React.useState<boolean>(() => isEidThemeActiveAt(new Date()));
  const [isEidBannerDismissed, setIsEidBannerDismissed] = React.useState<boolean>(() => {
    try {
      return window.localStorage.getItem(EID_BANNER_DISMISS_KEY) === '1';
    } catch (_error) {
      return false;
    }
  });

  const [isEasterThemeActive, setIsEasterThemeActive] = React.useState<boolean>(() => isEasterThemeActiveAt(new Date()));
  const [isGoodFriday, setIsGoodFriday] = React.useState<boolean>(() => isGoodFridayAt(new Date()));
  const [isEasterBannerDismissed, setIsEasterBannerDismissed] = React.useState<boolean>(() => {
    try {
      return window.localStorage.getItem(EASTER_BANNER_DISMISS_KEY) === '1';
    } catch (_error) {
      return false;
    }
  });

  const normalizedPath = location.pathname.toLowerCase();
  const isCustomerRoute = CUSTOMER_FACING_PATHS.has(normalizedPath);

  // This is a SPA, so a hard page load happens once. index.html only loads the
  // pixel — every route change has to report its own PageView or the funnel
  // shows a single view per session.
  React.useEffect(() => {
    trackPageView();
    // First-party funnel tracking — counts the visitors ad blockers hide from
    // the pixel, and records which stage of checkout each session reached.
    trackRoute(location.pathname);
  }, [location.pathname]);

  const applyChildrensDay   = isCustomerRoute && isChildrensDayActive;
  const showChildrensDayBanner = applyChildrensDay && !isChildrensDayDismissed;

  const applyEidTheme  = isCustomerRoute && isEidThemeActive;
  const showEidBanner  = applyEidTheme && !isEidBannerDismissed;
  // Easter takes precedence over Eid if both somehow overlap
  const applyEasterTheme = isCustomerRoute && isEasterThemeActive && !applyEidTheme;
  const showEasterBanner = applyEasterTheme && !isEasterBannerDismissed;

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      const d = new Date();
      setIsChildrensDayActive(isChildrensDayActiveAt(d));
      setIsEidThemeActive(isEidThemeActiveAt(d));
      setIsEasterThemeActive(isEasterThemeActiveAt(d));
      setIsGoodFriday(isGoodFridayAt(d));
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    document.body.classList.toggle('eid-theme', applyEidTheme);
    return () => {
      document.body.classList.remove('eid-theme');
    };
  }, [applyEidTheme]);

  React.useEffect(() => {
    document.body.classList.toggle('easter-theme', applyEasterTheme);
    document.body.classList.toggle('easter-friday', applyEasterTheme && isGoodFriday);
    return () => {
      document.body.classList.remove('easter-theme', 'easter-friday');
    };
  }, [applyEasterTheme, isGoodFriday]);

  const closeChildrensDay = React.useCallback(() => {
    setIsChildrensDayDismissed(true);
    try { window.localStorage.setItem(CHILDRENS_DAY_DISMISS_KEY, '1'); } catch {}
  }, []);

  const closeEidBanner = React.useCallback(() => {
    setIsEidBannerDismissed(true);
    try {
      window.localStorage.setItem(EID_BANNER_DISMISS_KEY, '1');
    } catch (_error) {
      // Ignore storage errors and still dismiss in memory.
    }
  }, []);

  const closeEasterBanner = React.useCallback(() => {
    setIsEasterBannerDismissed(true);
    try {
      window.localStorage.setItem(EASTER_BANNER_DISMISS_KEY, '1');
    } catch (_error) {
      // Ignore storage errors and still dismiss in memory.
    }
  }, []);

  const themeShellClass = [
    applyChildrensDay ? `cd-theme-shell${showChildrensDayBanner ? ' has-cd-banner' : ''}` : '',
    applyEidTheme     ? `eid-theme-shell${showEidBanner ? ' has-eid-banner' : ''}` : '',
    applyEasterTheme  ? `easter-theme-shell${showEasterBanner ? ' has-easter-banner' : ''}${isGoodFriday ? ' easter-friday-shell' : ''}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={themeShellClass || undefined}>
      {/* ── Children's Day decorations (balloons + confetti) ─────── */}
      {applyChildrensDay ? (
        <>
          <div className="cd-balloons" aria-hidden="true">
            {['🎈','🎈','🎉','🎈','🎊','🎈','🎈','🎉','🎊','🎈','🎈','🎊'].map((em, i) => (
              <span key={i} className={`cd-balloon cd-balloon-${i + 1}`}>{em}</span>
            ))}
          </div>
          <div className="cd-confetti" aria-hidden="true">
            {[...Array(20)].map((_, i) => (
              <span key={i} className={`cd-dot cd-dot-${i + 1}`} />
            ))}
          </div>
        </>
      ) : null}
      {/* ── Children's Day banner (prominent — today only) ────────── */}
      {showChildrensDayBanner ? (
        <div className="cd-banner" role="note" aria-label="Happy Children's Day">
          <span className="cd-banner-emoji" aria-hidden="true">🎈🎉🎊</span>
          <img src={immersiaLogo} alt="Immersia logo" className="cd-banner-logo" />
          <div className="cd-banner-copy">
            <strong>Happy Children's Day! 🎈</strong>
            <span>Wishing all our young visitors a fun-filled day of play and adventure at Immersia!</span>
          </div>
          <button type="button" className="cd-banner-close" aria-label="Close" onClick={closeChildrensDay}>×</button>
        </div>
      ) : null}
      {applyEidTheme ? (
        <>
          <div className="eid-crescent" aria-hidden="true">
            <span className="eid-crescent-star">★</span>
          </div>
          <div className="eid-stars" aria-hidden="true">
            {[1,2,3,4,5,6,7,8,9,10].map(i => (
              <span key={i} className={`eid-star eid-star-${i}`}>✦</span>
            ))}
          </div>
          <div className="eid-lantern eid-lantern-left" aria-hidden="true">
            <div className="eid-lantern-cap" />
            <div className="eid-lantern-body" />
            <div className="eid-lantern-base" />
            <div className="eid-lantern-string" />
          </div>
          <div className="eid-lantern eid-lantern-right" aria-hidden="true">
            <div className="eid-lantern-cap" />
            <div className="eid-lantern-body" />
            <div className="eid-lantern-base" />
            <div className="eid-lantern-string" />
          </div>
        </>
      ) : null}
      {applyEasterTheme ? (
        <>
          {/* Floating eggs */}
          <div className="easter-eggs" aria-hidden="true">
            {['🥚','🐣','🌸','🌷','✝️','🥚','🐇','🌼','🥚','🌸'].map((em, i) => (
              <span key={i} className={`easter-egg easter-egg-${i + 1}`}>{em}</span>
            ))}
          </div>
          {/* CSS cross ornament — solemn on Good Friday, glowing on Easter */}
          <div className={`easter-cross${isGoodFriday ? ' easter-cross-friday' : ''}`} aria-hidden="true">
            <div className="easter-cross-v" />
            <div className="easter-cross-h" />
          </div>
          {/* Sunrise rays decoration */}
          {!isGoodFriday && (
            <div className="easter-sunrise" aria-hidden="true">
              {[...Array(8)].map((_, i) => <div key={i} className={`easter-ray easter-ray-${i + 1}`} />)}
            </div>
          )}
        </>
      ) : null}
      {showEidBanner ? (
        <div className="eid-banner" role="note" aria-label="Eid greeting">
          <div className="eid-banner-ornament eid-banner-ornament-left" aria-hidden="true">☪</div>
          <img src={immersiaLogo} alt="Immersia logo" className="eid-banner-logo" />
          <div className="eid-banner-copy">
            <strong>Eid al-Adha Mubarak! ✨</strong>
            <span>Wishing you blessings, joy, and winning game sessions from everyone at Immersia.</span>
          </div>
          <button type="button" className="eid-banner-close" aria-label="Close Eid greeting" onClick={closeEidBanner}>
            ×
          </button>
        </div>
      ) : null}
      {showEasterBanner ? (
        <div className="easter-banner" role="note" aria-label="Easter greeting">
          <div className="easter-banner-ornament" aria-hidden="true">{isGoodFriday ? '✝️' : '🐣'}</div>
          <img src={immersiaLogo} alt="Immersia logo" className="eid-banner-logo" />
          <div className="eid-banner-copy">
            <strong>{isGoodFriday ? 'Good Friday 🕊️' : 'Happy Easter! 🌷'}</strong>
            <span>{isGoodFriday
              ? 'Wishing you a reflective Good Friday from everyone at Immersia.'
              : 'Wishing you joy, new beginnings, and winning sessions this Easter!'
            }</span>
          </div>
          <button type="button" className="eid-banner-close" aria-label="Close Easter greeting" onClick={closeEasterBanner}>
            ×
          </button>
        </div>
      ) : null}
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/AdminLogin" element={<AdminLogin onLoginSuccess={() => {}} onClose={() => {}} />} />
        <Route path="/Admin"            element={<PrivateRoute element={<Admin />} />} />
        <Route path="/CreateAdmin"      element={<PrivateRoute element={<CreateAdminForm />} />} />
        <Route path="/GameSelection" element={<GameSelection />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route
          path="/UserDetails"
          element={<UserDetails userDetails={{ username: '', phone: '' }} setUserDetails={() => {}} onNext={() => {}} />}
        />
        <Route
          path="/CartAndPayment"
          element={<CartAndPayment cartItems={[]} cartTotal={0} payment_methods={[]} setPaymentMethods={() => {}} setCartItems={() => {}} onNext={() => {}} />}
        />
        <Route path="/Queue" element={<Queue />} />
        <Route path="/PC" element={<PC cart={[]} />} />
        <Route path="/Ticket" element={<Ticket />} />
        <Route path="/report"           element={<PrivateRoute element={<Report />} />} />
        <Route
          path="/PaymentSelection"
          element={<PaymentSelection cartTotal={0} userDetails={{ username: '', phone: '' }} cartItems={[]} handlePaymentSuccess={async () => {}} />}
        />
        <Route
          path="/AdminPaymentPage"
          element={
            <PrivateRoute element={
              <AdminPaymentPage
                cartTotal={0}
                userDetails={{ username: '', phone: '' }}
                payment_methods={[]}
                cartItems={[]}
                onPaymentSuccess={() => {}}
                isAdmin={false}
                discount_description=""
                setDiscountDescription={() => {}}
                otherReason=""
                setOtherReason={() => {}}
              />
            } />
          }
        />
        <Route path="/OperatorAuth" element={<OperatorAuth />} />
        <Route path="/OperatorDashboard"  element={<PrivateRoute element={<Admin />} />} />
        <Route path="/ImmersiaPaymentPage" element={<ImmersiaPaymentPage />} />
        <Route path="/FunstationPaymentPage" element={<FunstationPaymentPage />} />
        <Route path="/PaystackPaymentPage" element={<PaystackPaymentPage />} />
        <Route path="/GKGPaymentPage" element={<GKGPaymentPage />} />
        <Route path="/AIChatBox"          element={<PrivateRoute element={<AIChatBox isAdmin={true} />} />} />
        <Route path="/DrinkInventory"     element={<PrivateRoute element={<DrinkInventory isAdmin={true} />} />} />
        <Route path="/OperatorConsumedGames" element={<PrivateRoute element={<OperatorConsumedGames />} />} />
        <Route path="/AdminDashboard"     element={<PrivateRoute element={<Admin />} />} />
        <Route path="/PCLockDashboard"    element={<PrivateRoute element={<Admin />} />} />
        <Route path="/AdminTransaction"   element={<PrivateRoute element={<AdminTransaction />} />} />
        <Route path="/MarketersReportPage" element={<PrivateRoute element={<MarketersReportPage />} />} />
        <Route path="/InternalControlEntry" element={<PrivateRoute element={<InternalControlEntry />} />} />
        <Route path="/InternalControlDashboard" element={<PrivateRoute element={<InternalControlDashboard />} />} />
        <Route path="/AdminPcControl"     element={<PrivateRoute element={<Admin />} />} />
        <Route path="/customer-portal" element={<CustomerPortal />} />
        <Route path="/TennisLive" element={<TennisLiveScore />} />
        <Route path="/creditpaymentpage" element={<CreditPaymentPage />} />
      </Routes>
      {/* Customer support shortcut — hidden on admin/operator routes */}
      {isCustomerRoute ? <WhatsAppButton /> : null}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <CartProvider>
      <Router>
        <Suspense fallback={<RouteLoader />}>
          <AppShell />
        </Suspense>
      </Router>
    </CartProvider>
  );
};

export default App;
