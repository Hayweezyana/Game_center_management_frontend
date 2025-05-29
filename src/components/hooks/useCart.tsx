import { useState, useEffect, ReactNode, createContext, useContext } from 'react';

export type UUID = string;

interface CartItem {
  id: UUID; // Unique identifier for the item
  title: string;
  price: number;
  quantity: number;
  gameDuration: number; // Game duration in minutes
  //define ItemId as game_id
  
}

interface UseCart {
  cartItems: CartItem[];
  cartTotal: number;
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: UUID) => void;
  updateCartItem: (itemId: UUID, quantity: number) => void;
  clearCart: () => void;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}


const useCart = (): UseCart => {
  const [cartItems, setCart] = useState<CartItem[]>([]);
  useEffect(() => {
    console.log('Cart Items in useCart:', cartItems);
  }, [cartItems]);
  
  // Calculate the total cost of the cart
  const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

  // Add a new item to the cart
  const addToCart = (item: CartItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        return prevCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
            : cartItem
        );
      }
      return [...prevCart, item];
    });
  };

  // Remove an item from the cart
  const removeFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  };

  // Update the quantity of an existing cart item
  const updateCartItem = (itemId: UUID, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId); // Automatically remove the item if quantity is zero or less
    } else {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        )
      );
    }
  };

  // Clear the entire cart
  const clearCart = () => {
    setCart([]);
  };

  // Persist cart state to sessionStorage
  useEffect(() => {
    const storedCart = sessionStorage.getItem('cart');
    console.log('Stored Cart in sessionStorage:', sessionStorage.getItem('cart'), storedCart);
    if (storedCart) {
      setCart(JSON.parse(storedCart));
    }
  }, []);
  
  // clear cart after payment
  useEffect(() => {
    sessionStorage.removeItem('cart');
  }, [cartItems]);

  useEffect(() => {
    sessionStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  

  return {
    cartItems,
    cartTotal,
    addToCart,
    removeFromCart,
    updateCartItem,
    clearCart,
    setCart,
  };
};

const CartContext = createContext<UseCart | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
    const cart = useCart();
    return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
};
export const useCartContext = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider');
  }
  return context;
};

export default useCart;
