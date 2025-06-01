import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UUID } from 'crypto';

// Define the structure of a cart item
export interface CartItem {
  id: UUID;
  title: string;
  price: number;
  quantity: number;
  gameDuration: number;
}

// Define what the context provides
interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: UUID) => void;
  clearCart: () => void;
  setCartFinalAmount?: (amount: number) => void; // Optional method for setting final amount
}

// Create the context
const CartContext = createContext<CartContextType | undefined>(undefined);

// Provider component
export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (item: CartItem) => setCart((prev) => [...prev, item]);

  const removeFromCart = (id: UUID) =>
    setCart((prev) => prev.filter((item) => item.id !== id));

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

// Hook to consume the cart context
export const useCartContext = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider');
  }
  return context;
};
