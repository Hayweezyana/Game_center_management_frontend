import React, { useState, useEffect, FC } from 'react';
import YouTube from 'react-youtube';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import styles from './GameSelection.module.css';

// Define types for the game data
interface Game {
  id: number;
  url: string;
  title: string;
  price: number;
  time_slot?: string; // Optional: If some games may not have this property
}

interface CartItem {
  title: string;
  price: number;
  quantity: number;
}

const GameSelection: FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [quantities, setQuantities] = useState<number[]>([]);
  const [loading, setLoading] = useState(true); // Track loading state
  const [error, setError] = useState<string | null>(null); // Track errors
  const navigate = useNavigate();
  const [selectedGames, setSelectedGames] = useState<CartItem[]>([]);
  const socket: Socket = io("ws://127.0.0.1:2024", {
  transports: ["websocket"],
});

  useEffect(() => {
    // Fetch games data from the backend
    axios
      .get<{ status: boolean; data: Game[] }>('http://localhost:2024/v1/admin/games')
      .then((response) => {
        if (response.data.status) {
          setGames(response.data.data);
        } else {
          throw new Error(`Unexpected response format: ${JSON.stringify(response.data)}`);
        }
      })
      .catch((error) => {
        console.error('Error loading games:', error.message || error);
        setError('Failed to load games. Please try again later.');
      })
      .then(() => setLoading(false), () => setLoading(false));

    // Cleanup socket listeners to avoid memory leaks
    return () => {
      socket.disconnect();
      console.log('Socket disconnected');
    };
  }, [socket]);

  const handleQuantityChange = (index: number, quantity: string) => {
    setQuantities((prevQuantities) => {
      const newQuantities = [...prevQuantities];
      newQuantities[index] = Number(quantity);
      return newQuantities;
    });
  };

  const calculateTotal = () => {
    return selectedGames.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const handleCheckout = () => {
    const selectedGames = games
      .map((game, index) => ({
        ...game,
        quantity: quantities[index],
      }))
      .filter((item) => item.quantity > 0); // Filter out games with 0 quantity

    if (selectedGames.length === 0) {
      alert('No games selected for checkout!');
      return;
    }
    const cartTotal = calculateTotal();

    // Redirect to the checkout page with selected games
    navigate('/checkout', { state: { checkoutCart: selectedGames, cartTotal: cartTotal, } });
  };

  return (
    <div className={styles['game-selection-container']}>
      <h1 className={styles.title}>Immersia POS</h1>
      {loading ? (
        <p>Loading games...</p>
      ) : error ? (
        <p className={styles['error-message']}>{error}</p>
      ) : (
        <div className={styles['games-grid']}>
          {games.map((game, index) => (
            <div key={game.id} className={styles['game-item']}>
              <YouTube videoId={game.url} className="youtube-video" />
              <h2 className={styles['game-title']}>{game.title}</h2>
              <p className={styles['game-price']}>Price: ₦{game.price}</p>
              <p className={styles['game-time_slot']}>
                Duration: {game.time_slot || '10 minutes'}
              </p>
              <input
                type="number"
                min="0"
                className={styles['quantity-input']}
                value={quantities[index] || 0}
                onChange={(e) => handleQuantityChange(index, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
      <button
        className={styles['checkout-button']}
        onClick={handleCheckout}
        disabled={loading || !!error}
      >
        Checkout
      </button>
    </div>
  );
};

export default GameSelection;
