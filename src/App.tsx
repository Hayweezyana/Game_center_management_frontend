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
          <Route path="/CartAndPayment" element={<CartAndPayment cartItems={[]} cartTotal={0} paymentMethods={[]} setPaymentMethods={() => {}} onNext={() => {}} />} />
          <Route path="/UserDetails" element={<UserDetails userDetails={{ username: '', phone: '' }} setUserDetails={() => {}} onNext={() => {}} />} />
          <Route path="/Queue" element={<Queue />} />
          <Route path="/PC" element={<PC cart={[]} />} />
          <Route path="/Ticket/" element={<Ticket />} />
          <Route path="/report" element={<Report />} />
          <Route path="/PaymentPage" element={<Payment cartTotal={100} userDetails={{ username: '', phone: '' }} paymentMethods={[]} onPaymentSuccess={() => {}} />} />
          <Route path="/AdminPaymentPage" element={<AdminPaymentPage cartTotal={100} userDetails={{ username: '', phone: '' }} paymentMethods={[]} cartItems={[]} onPaymentSuccess={() => {}} isAdmin={false} discount_description="" setDiscountDescription={() => {}} otherReason="" setOtherReason={() => {}} />} />
          
        </Routes>
    </Router>
    </CartProvider>
  );
}

export default App;
