import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Importing pages
import WelcomePage from "./components/WelcomePage";
import Checkout from './components/checkout';
import GameSelection from './components/GameSelection';
import PC from './components/PC';
import Ticket from './components/Ticket';
import Report from './components/report';
import Payment from './components/PaymentForm';

// Importing user-related pages
import AdminLogin from './components/users/AdminLogin';
import Admin from './components/users/Admin';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Default route to WelcomePage */}
        <Route path="/" element={<WelcomePage />} />
          {/* Define routes for each component */}
          <Route path="/AdminLogin" element={<AdminLogin />} />
          <Route path="/Admin" element={<Admin />} />
          <Route path="/GameSelection" element={<GameSelection />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/PC" element={<PC />} />
          <Route path="/Ticket/:id" element={<Ticket transactionId={123} />} />
          <Route path="/report" element={<Report />} />
          <Route path="/PaymentForm" element={<Payment cartTotal={100} />} />
          
        </Routes>
    </Router>
  );
}

export default App;
