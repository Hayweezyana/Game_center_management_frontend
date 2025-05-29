import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import YouTube from 'react-youtube';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import { useCartContext } from './hooks/useCart';
import styles from './GameSelection.module.css';
import { UUID } from 'crypto';
import { FaPlus, FaMinus } from 'react-icons/fa';

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
  time_slot?: string;
}


const GameSelection: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const filteredGames = useMemo(() => {
    return games.filter(game =>
      game.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, games]);
  const [loading, setLoading] = useState(true); // Track loading state
  const [error, setError] = useState<string | null>(null); // Track errors
  const navigate = useNavigate();
  const { addToCart, cartItems, updateCartItem, } = useCartContext();
  const socket: Socket = useMemo(() => io("ws:https://game-center-management.onrender.com", {
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
  
  

  const getCartQuantity = (gameId: UUID) => {
    const item = cartItems.find((item) => item.id === gameId.toString());
    return item ? item.quantity : 0;
  };

  const handleQuantityChange = (game: Game, quantity: number) => {
  if (quantity <= 0) {
    // Remove from cart
    updateCartItem(game.id, 0); // This will trigger removal in useCart
  } else {
    const cartItem = cartItems.find((item) => item.id === game.id);
    if (cartItem) {
      updateCartItem(game.id, quantity); // Just update the quantity directly
    } else {
      addToCart({
        id: game.id,
        title: game.title,
        price: game.price,
        quantity, // Set initial quantity
        gameDuration: game.time_slot ? parseInt(game.time_slot) : 10,
      });
    }
  }
};


  const handleCheckout = () => {
    if (cartItems.length === 0) {
      alert('No games selected for checkout!');
      return;
    }
    navigate('/checkout');
  };

  const onPlayerReady = (event: any, gameId: string) => {
    playerRefs.current[gameId] = event.target;
  };

  const onPlayerError = (error: any, gameId: string) => {
    console.error(`YouTube player error for game ${gameId}:`, error);
  };

  return (
    <div className={styles['game-selection-container']}>
      <h1 className={styles.title}>Immersia POS</h1>
      <input
        type="text"
        placeholder="Search games..."
        className={styles.searchBar}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {loading ? (
        <p>Loading games...</p>
      ) : error ? (
        <p className={styles['error-message']}>{error}</p>
      ) : (
        <div className={styles['video-grid']}>
          {filteredGames.map((game) => {
            const cartItem = cartItems.find(item => item.id === game.id);
            const currentQty = cartItem?.quantity || 0;
            return (
              <div key={game.id} className={styles['video-container']}>
                <h2 className={styles['game-title']}>{game.title}</h2>
                <p className={styles['game-price']}>Price: ₦{game.price}</p>
                <p className={styles['game-time_slot']}>Duration: {game.time_slot || '10 minutes'}</p>
                <YouTube
                  videoId={game.url}
                  onReady={(event) => onPlayerReady(event, game.id)}
                  onError={(event) => onPlayerError(event, game.id)}
                />

                <div className={styles['quantity-controls']}>
        <button onClick={() => handleQuantityChange(game, currentQty - 1)} disabled={currentQty === 0}>
          <FaMinus />
        </button>
        <input
          type="number"
          min="0"
          value={currentQty}
          onChange={(e) => handleQuantityChange(game, Number(e.target.value))}
          className={styles['quantity-input']}
        />
        <button onClick={() => handleQuantityChange(game, currentQty + 1)}>
          <FaPlus />
        </button>
                </div>
              </div>
            );
          })}
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
