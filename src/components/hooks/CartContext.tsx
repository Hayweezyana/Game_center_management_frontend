import { UUID } from 'crypto';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CartContextType {
  cart: any[];
  addToCart: (item: any) => void;
  removeFromCart: (id: UUID) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<any[]>([]);

  const addToCart = (item: any) => setCart([...cart, item]);
  const removeFromCart = (id: UUID) =>
    setCart(cart.filter((item) => item.id !== id));

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCartContext = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider');
  }
  return context;
};
