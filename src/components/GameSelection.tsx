import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import YouTube from 'react-youtube';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import { useCartContext } from './hooks/useCart';
import styles from './GameSelection.module.css';
import { UUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaMinus } from 'react-icons/fa';
import { set } from 'lodash';

// Define types for the cart items
interface CartItem {
  id: string | UUID; // Accept both UUID and string ids
  title: string;
  price: number;
  quantity: number;
  gameDuration?: number; // Game duration in minutes
  type: 'game' | 'drink'; // Ensure every CartItem has a type
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

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [showAddDrinkForm, setShowAddDrinkForm] = useState(false);
  const [newDrinkTitle, setNewDrinkTitle] = useState('');
const [newDrinkPrice, setNewDrinkPrice] = useState<number>(0);
const [newDrinkQuantity, setNewDrinkQuantity] = useState<number>(0);


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
  const getDrinkQuantity = (drinkId: string) => {
  const drinkItem = cartItems.find(item => item.id === drinkId && item.type === 'drink');
  return drinkItem ? drinkItem.quantity : 0;
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
        type: 'game',
      });
    }
  }
};

const [drinks, setDrinks] = useState<{ id: string; title: string; price: number; quantity: number }[]>([]);
useEffect(() => {
  axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/drinks`)
    .then(res => {
      if (res.data.status) {
        // Ensure each drink has a quantity property (default to 0 if missing)
        setDrinks(res.data.data.map((drink: any) => ({
          ...drink,
          quantity: typeof drink.quantity === 'number' ? drink.quantity : 0,
        })));
      } else {
        throw new Error('Failed to load drinks');
      }
    })
    .catch(err => {
      console.error('Drink fetch error:', err);
    });
}, []);

const handleAddDrink = (drink: { id: string; title: string; price: number, quantity: number }) => {
  const cartItem = cartItems.find(item => item.id === drink.id && item.type === 'drink');
  const availableStock = drink.quantity;
  const currentQuantity = cartItem?.quantity || 0;

  if (currentQuantity >= availableStock) {
    alert(`Max stock reached for ${drink.title}. Cannot add more.`);
    return;
  }

  if (availableStock - currentQuantity <= 2) {
    alert(`Only ${availableStock - currentQuantity} unit(s) left for ${drink.title}.`);
  }

  if (cartItem) {
    updateCartItem(drink.id, currentQuantity + 1);
  } else {
    addToCart({
      id: drink.id,
      title: drink.title,
      price: drink.price,
      quantity: 1, // Default to 1 if quantity is not provided
      gameDuration: 0, // Drinks have no duration
      type: 'drink',
    });
  }
};

const handleAddNewDrink = async () => {
  if (!newDrinkTitle.trim() || newDrinkPrice <= 0) {
    alert('Please enter a valid drink name and price.');
    return;
  }

  try {
    const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/drinks`, {
      title: newDrinkTitle,
      price: newDrinkPrice,
      quantity:newDrinkQuantity,
    });

    if (response.data.status) {
      setDrinks(prev => [...prev, response.data.data]);
      setNewDrinkTitle('');
      setNewDrinkPrice(0);
      setNewDrinkQuantity(0);
      alert('Drink added successfully!');
      setShowAddDrinkForm(false);
    }
  } catch (err) {
    if (err instanceof Error) {
      alert('Error adding drink: ' + err.message);
    } else {
      alert('Error adding drink: ' + String(err));
    }
  }
};




const handleRemoveDrink = (drinkId: string) => {
  const existingItem = cartItems.find(item => item.id === drinkId && item.type === 'drink');
  if (existingItem && existingItem.quantity > 1) {
    updateCartItem(drinkId, existingItem.quantity - 1);
  } else {
    updateCartItem(drinkId, 0); // Remove
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
                <div onClick={() => setSelectedGameId(prev => (prev === game.id ? null : game.id))}>
                  <YouTube
                    videoId={game.url}
                    onReady={(event) => onPlayerReady(event, game.id)}
                    onError={(event) => onPlayerError(event, game.id)}
                  />
                </div>

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

            {selectedGameId === game.id && (
              <div className={styles['drink-list']}>
                <h4>Select a drink:</h4>
                <button
  onClick={() => setShowAddDrinkForm((prev) => !prev)}
  className={styles['add-drink-toggle']}
>
  {showAddDrinkForm ? 'Cancel Add Drink' : 'Add a New Drink'}
</button>
{showAddDrinkForm && (
  <div className={styles['add-drink-form']}>
    <h4>Add New Drink</h4>
    <input
      type="text"
      placeholder="Drink Name"
      value={newDrinkTitle}
      onChange={(e) => setNewDrinkTitle(e.target.value)}
    />
    <input
      type="number"
      placeholder="Price (₦)"
      value={newDrinkPrice}
      onChange={(e) => setNewDrinkPrice(Number(e.target.value))}
    />
    <input
      type="number"
      placeholder="Quantity"
      value={newDrinkQuantity}
      onChange={(e) => setNewDrinkQuantity(Number(e.target.value))}
    />
    <button onClick={handleAddNewDrink}>Add Drink</button>
  </div>
)}
                {drinks.map(drink => {
                  const qty = getDrinkQuantity(drink.id);
                  return (
                    <div key={drink.id} className={styles['drink-item']}>
                      <span>{drink.title} - ₦{drink.price}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
  <button onClick={() => handleAddDrink({ ...drink, quantity: drink.quantity })}
    disabled={qty >= drink.quantity || drink.quantity === 0}
    style={{ opacity: drink.quantity === 0 ? 0.4 : 1 }}><FaPlus /></button>
                        <span style={{ minWidth: '24px', textAlign: 'center' }}>{qty}</span>
                        <button onClick={() => handleRemoveDrink(drink.id)} disabled={qty === 0}><FaMinus /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
