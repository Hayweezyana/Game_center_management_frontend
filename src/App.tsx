import { CartProvider } from './components/hooks/useCart';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';


// Importing pages
import WelcomePage from "./components/WelcomePage";
import Checkout from './components/checkout';
import Queue from './components/Queue';
import GameSelection from './components/GameSelection';
import PC from './components/PC';
import Ticket from './components/Ticket';
import Report from './components/report';
import PaymentSelection from './components/PaymentSelection';
import CartAndPayment from './components/CartAndPayment';
import UserDetails from './components/UserDetails';
// import MoniepointDashboard from './components/MoniepointDashboard';
import OperatorDashboard from './components/OperatorDashboard';
import ImmersiaPaymentPage from './components/ImmersiaPaymentPage';
import FunstationPaymentPage from './components/FunstationPaymentPage';
import PaystackPaymentPage from './components/PaystackPaymentPage';
import AIChatBox from './components/AIChatBox';



// Importing user-related pages
import AdminLogin from './components/users/AdminLogin';
import Admin from './components/users/Admin';
import CreateAdminForm from './components/users/CreateAdminForm';
import AdminPaymentPage from './components/users/AdminPaymentPage';
import OperatorAuth from './components/users/OperatorAuth';
import DrinkInventory from './components/users/DrinkInventory';
import OperatorConsumedGames from './components/users/OperatorConsumedGames';

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
          <Route path="/CartAndPayment" element={<CartAndPayment cartItems={[]} cartTotal={0} payment_methods={[]} setPaymentMethods={() => {}} setCartItems={() => {}} onNext={() => {}} />} />
          <Route path="/Queue" element={<Queue />} />
          <Route path="/PC" element={<PC cart={[]} />} />
          <Route path="/Ticket" element={<Ticket />} />
          <Route path="/report" element={<Report />} />
          <Route path="/PaymentSelection" element={<PaymentSelection  cartTotal={0} userDetails={{ username: '', phone: '' }} cartItems={[]} handlePaymentSuccess={async () => {}} />} />
          <Route path="/AdminPaymentPage" element={<AdminPaymentPage cartTotal={0} userDetails={{ username: '', phone: '' }} payment_methods={[]} cartItems={[]} onPaymentSuccess={() => {}} isAdmin={false} discount_description="" setDiscountDescription={() => {}} otherReason="" setOtherReason={() => {}} />} />
          <Route path="/OperatorAuth" element={<OperatorAuth />} />
          {/* <Route path="/moniepoint" element={<MoniepointDashboard />} /> */}
          <Route path="/OperatorDashboard" element={<OperatorDashboard />} />
          <Route path="/ImmersiaPaymentPage" element={<ImmersiaPaymentPage finalAmount={0} userDetails={{ username: '', phone: '' }} cartItems={[]} onPaymentSuccess={() => {}} />} />
          <Route path="/FunstationPaymentPage" element={<FunstationPaymentPage finalAmount={0} userDetails={{ username: '', phone: '' }} cartItems={[]} onPaymentSuccess={() => {}} />} />
          <Route path="/PaystackPaymentPage" element={<PaystackPaymentPage />}/>
          <Route path="/AIChatBox" element={<AIChatBox isAdmin={true} />} />
          <Route path="/DrinkInventory" element={<DrinkInventory isAdmin={true} />} />
          <Route path="/OperatorConsumedGames" element={<OperatorConsumedGames />} />

          
        </Routes>
    </Router>
    </CartProvider>
  );
}

export default App;
