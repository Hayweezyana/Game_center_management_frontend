import { CartProvider } from './components/hooks/useCart';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Importing pages
import WelcomePage from "./components/WelcomePage";
import Checkout from './components/checkout';
import Queue from './components/Queue';
import GameSelection from './components/GameSelection';
import PC from './components/PC';
import Ticket from './components/Ticket';
import Report from './components/report';
import Payment from './components/PaymentPage';
import CartAndPayment from './components/CartAndPayment';
import UserDetails from './components/UserDetails';

// Importing user-related pages
import AdminLogin from './components/users/AdminLogin';
import Admin from './components/users/Admin';
import CreateAdminForm from './components/users/CreateAdminForm';
import AdminPaymentPage from './components/users/AdminPaymentPage';
import OperatorLogin from './components/users/OperatorLogin';
import OperatorRegister from './components/users/OperatorRegister';
import OperatorForgotPassword from './components/users/OperatorForgotPassword';

const App: React.FC = () => {
  return (
    <CartProvider>
    <Router>
      <Routes>
        {/* Default route to WelcomePage */}
        <Route path="/" element={<WelcomePage />} />
          <Route path="/AdminLogin" element={<AdminLogin onLoginSuccess={() => {}} onClose={() => {}} />} />
          <Route path="/Admin" element={<Admin />} />
          <Route path="/CreateAdmin" element={<CreateAdminForm />} />
          <Route path="/GameSelection" element={<GameSelection />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/UserDetails" element={<UserDetails userDetails={{ username: '', phone: '' }} setUserDetails={() => {}} onNext={() => {}} />} />
          <Route path="/CartAndPayment" element={<CartAndPayment cartItems={[]} cartTotal={0} payment_methods={[]} setPaymentMethods={() => {}} onNext={() => {}} />} />
          <Route path="/Queue" element={<Queue />} />
          <Route path="/PC" element={<PC cart={[]} />} />
          <Route path="/Ticket/" element={<Ticket />} />
          <Route path="/report" element={<Report />} />
          <Route path="/PaymentPage" element={<Payment cartTotal={100} userDetails={{ username: '', phone: '' }} onPaymentSuccess={() => {}} />} />
          <Route path="/AdminPaymentPage" element={<AdminPaymentPage cartTotal={100} userDetails={{ username: '', phone: '' }} payment_methods={[]} cartItems={[]} onPaymentSuccess={() => {}} isAdmin={false} discount_description="" setDiscountDescription={() => {}} otherReason="" setOtherReason={() => {}} />} />
          <Route path="/OperatorLogin" element={<OperatorLogin onLogin={() => {}} />} />
          <Route path="/OperatorRegister" element={<OperatorRegister />} />
          <Route path="/OperatorForgotPassword" element={<OperatorForgotPassword />} />
          
        </Routes>
    </Router>
    </CartProvider>
  );
}

export default App;
