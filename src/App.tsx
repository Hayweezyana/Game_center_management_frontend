import { CartProvider } from './components/hooks/useCart';
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';

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
const OperatorDashboard = lazy(() => import('./components/OperatorDashboard'));
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
const AdminDashboard = lazy(() => import('./components/users/AdminDashboard'));
const PCLockDashboard = lazy(() => import('./components/users/PCLockDashboard'));
const AdminTransaction = lazy(() => import('./components/users/Admintransaction'));
const MarketersReportPage = lazy(() => import('./components/MarketersReportPage'));
const AdminPcControl = lazy(() => import('./components/users/AdminPcControl'));
const CustomerPortal = lazy(() => import('./components/customer/CustomerPortal'));

const RouteLoader: React.FC = () => (
  <div className="route-loader" role="status" aria-live="polite">
    Loading...
  </div>
);

const App: React.FC = () => {
  return (
    <CartProvider>
      <Router>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/AdminLogin" element={<AdminLogin onLoginSuccess={() => {}} onClose={() => {}} />} />
            <Route path="/Admin" element={<Admin />} />
            <Route path="/CreateAdmin" element={<CreateAdminForm />} />
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
            <Route path="/report" element={<Report />} />
            <Route
              path="/PaymentSelection"
              element={<PaymentSelection cartTotal={0} userDetails={{ username: '', phone: '' }} cartItems={[]} handlePaymentSuccess={async () => {}} />}
            />
            <Route
              path="/AdminPaymentPage"
              element={
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
              }
            />
            <Route path="/OperatorAuth" element={<OperatorAuth />} />
            <Route path="/OperatorDashboard" element={<OperatorDashboard />} />
            <Route path="/ImmersiaPaymentPage" element={<ImmersiaPaymentPage />} />
            <Route path="/FunstationPaymentPage" element={<FunstationPaymentPage />} />
            <Route path="/PaystackPaymentPage" element={<PaystackPaymentPage />} />
            <Route path="/GKGPaymentPage" element={<GKGPaymentPage />} />
            <Route path="/AIChatBox" element={<AIChatBox isAdmin={true} />} />
            <Route path="/DrinkInventory" element={<DrinkInventory isAdmin={true} />} />
            <Route path="/OperatorConsumedGames" element={<OperatorConsumedGames />} />
            <Route path="/AdminDashboard" element={<AdminDashboard />} />
            <Route path="/PCLockDashboard" element={<PCLockDashboard />} />
            <Route path="/AdminTransaction" element={<AdminTransaction />} />
            <Route path="/MarketersReportPage" element={<MarketersReportPage />} />
            <Route path="/AdminPcControl" element={<AdminPcControl />} />
            <Route path="/customer-portal" element={<CustomerPortal />} />
          </Routes>
        </Suspense>
      </Router>
    </CartProvider>
  );
};

export default App;
