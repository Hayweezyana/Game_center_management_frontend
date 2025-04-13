import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import YouTube from 'react-youtube';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import { useCartContext } from './hooks/useCart';
import styles from './GameSelection.module.css';
import { UUID } from 'crypto';

// Define types for the cart items
interface CartItem {
  id: UUID;
  title: string;
  price: number;
  quantity: number;
  gameDuration: number; // Game duration in minutes
}

// Define types for the game data
interface Game {
  id: UUID;
  url: string;
  title: string;
  price: number;
  time_slot?: string; // Optional: If some games may not have this property
}

const GameSelection: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true); // Track loading state
  const [error, setError] = useState<string | null>(null); // Track errors
  const navigate = useNavigate();
  const { addToCart, cartItems, cartTotal } = useCartContext();
  const socket: Socket = useMemo(() => io("ws://127.0.0.1:2024", {
    transports: ["websocket"],
  }), []);

  // Ref to store YouTube player instances
  const playerRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    // Fetch games data from the backend
    const fetchGames = async () => {
      try {
        const response = await axios.get<{ status: boolean; data: Game[] }>(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/games`);
        if (response.data.status) {
          setGames(response.data.data);
        } else {
          throw new Error(`Unexpected response format: ${JSON.stringify(response.data)}`);
        }
      } catch (error) {
        console.error('Error loading games:', error instanceof Error ? error.message : String(error));
        setError('Failed to load games. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchGames();

    // Cleanup socket listeners to avoid memory leaks
    return () => {
      socket.disconnect();
      console.log('Socket disconnected');
    };
  }, [socket]);

  const handleAddToCart = useCallback((game: Game, quantity: number) => {
    const updatedItems = cartItems.map((item) =>
      item.id === game.id.toString() ? { ...item, quantity } : item
    );
    
    if (!cartItems.find((item) => item.id === game.id.toString())) {
      if (quantity > 0) {
        console.log('Adding to cart:', game, 'Quantity:', quantity);
        addToCart({
          id: game.id,
          title: game.title,
          price: game.price,
          quantity,
          gameDuration: game.time_slot ? parseInt(game.time_slot) : 10, // Assuming default duration is 10 minutes
        });
      }
    } else {
      setCart(updatedItems);
      console.log('Updated cart items:', cartItems);
    }
  }, [cartItems, addToCart]);

  const handleCheckout = useCallback(() => {
    if (cartItems.length === 0) {
      alert('No games selected for checkout!');
      return;
    }

    // Redirect to the checkout page with selected games
    navigate('/checkout');
  }, [cartItems, navigate]);

  const debouncedHandleAddToCart = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (game: Game, quantity: number) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => handleAddToCart(game, quantity), 300);
    };
  }, [handleAddToCart]);

  // Handle YouTube player ready event
  const onPlayerReady = (event: any, gameId: string) => {
    // Store the player instance in the ref
    playerRefs.current[gameId] = event.target;
  };

  // Handle YouTube player error event
  const onPlayerError = (error: any, gameId: string) => {
    console.error(`YouTube player error for game ${gameId}:`, error);
  };

  return (
    <div className={styles['game-selection-container']}>
      <h1 className={styles.title}>Immersia POS</h1>
      {loading ? (
        <p>Loading games...</p>
      ) : error ? (
        <p className={styles['error-message']}>{error}</p>
      ) : (
        <div className={styles['video-grid']}>
          {games.map((game) => (
            <div key={game.id} className={styles['video-container']}>
              <h2 className={styles['game-title']}>{game.title}</h2>
              <p className={styles['game-price']}>Price: ₦{game.price}</p>
              <p className={styles['game-time_slot']}>
                Duration: {game.time_slot || '10 minutes'}
              </p>
              <YouTube
                videoId={game.url}
                onReady={(event) => onPlayerReady(event, game.id)}
                onError={(event) => onPlayerError(event, game.id)}
              />
              <input
                type="number"
                min="0"
                className={styles['quantity-input']}
                onBlur={(e) => debouncedHandleAddToCart(game, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      )}
      <button
        className={styles['checkout-button']}
        onClick={handleCheckout}
        disabled={loading || !!error || cartItems.length === 0}
      >
        Checkout
      </button>
    </div>
  );
};

export default React.memo(GameSelection);

function setCart(updatedItems: CartItem[]) {
  throw new Error('Function not implemented.');
}