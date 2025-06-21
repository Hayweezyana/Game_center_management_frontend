import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import { CartProvider } from './components/hooks/useCart'; // Adjust path if necessary

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <CartProvider>
      <App />
    </CartProvider>
  );
