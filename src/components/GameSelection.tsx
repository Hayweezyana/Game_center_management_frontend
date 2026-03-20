import React, { CSSProperties, useEffect, useMemo, useState } from 'react';
import YouTube from 'react-youtube';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { UUID } from 'crypto';
import { useCartContext } from './hooks/useCart';
import { trackAddToCart, trackInitiateCheckout } from '../utils/metaPixel';
import { getRoutePrefetchProps } from '../utils/routePrefetch';
import styles from './GameSelection.module.css';

interface CartItem {
  id: string | UUID;
  title: string;
  price: number;
  quantity: number;
  gameDuration?: number;
  type: 'game' | 'drink';
}

interface Game {
  id: UUID;
  url: string;
  title: string;
  price: number;
  time_slot?: string;
}

interface Drink {
  id: string;
  title: string;
  price: number;
  quantity: number;
}

const formatNaira = (amount: number) => `N${amount.toLocaleString()}`;
const MOBILE_BREAKPOINT = 860;
const MOBILE_INITIAL_GAMES = 6;
const DESKTOP_INITIAL_GAMES = 12;
const LOAD_MORE_STEP = 6;

const getYouTubeVideoId = (rawUrl: string) => {
  const value = (rawUrl || '').trim();
  if (!value) return '';
  if (/^[\w-]{11}$/.test(value)) return value;

  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '').slice(0, 11);
    }

    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return v.slice(0, 11);
      const splitPath = parsed.pathname.split('/').filter(Boolean);
      const tail = splitPath[splitPath.length - 1];
      return tail ? tail.slice(0, 11) : '';
    }
  } catch (_error) {
    return '';
  }

  return '';
};

const GameSelection: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [showAddDrinkForm, setShowAddDrinkForm] = useState(false);
  const [newDrinkTitle, setNewDrinkTitle] = useState('');
  const [newDrinkPrice, setNewDrinkPrice] = useState<number>(0);
  const [newDrinkQuantity, setNewDrinkQuantity] = useState<number>(0);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [isMobileView, setIsMobileView] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches : false
  );
  const [visibleGameCount, setVisibleGameCount] = useState<number>(
    isMobileView ? MOBILE_INITIAL_GAMES : DESKTOP_INITIAL_GAMES
  );

  const navigate = useNavigate();
  const { addToCart, cartItems, updateCartItem } = useCartContext();

  const filteredGames = useMemo(
    () => games.filter((game) => game.title.toLowerCase().includes(searchTerm.toLowerCase())),
    [searchTerm, games]
  );
  const visibleGames = useMemo(() => filteredGames.slice(0, visibleGameCount), [filteredGames, visibleGameCount]);
  const hasMoreGames = filteredGames.length > visibleGames.length;

  const gameCartCount = useMemo(
    () => cartItems.filter((item) => item.type === 'game').reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );
  const drinkCartCount = useMemo(
    () => cartItems.filter((item) => item.type === 'drink').reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );
  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [cartItems]);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await axios.get<{ status: boolean; data: Game[] }>(
          `${process.env.REACT_APP_BACKEND_URL}/v1/admin/games`
        );
        if (!response.data.status) {
          throw new Error(`Unexpected response format: ${JSON.stringify(response.data)}`);
        }
        setGames(response.data.data);
      } catch (fetchError) {
        console.error('Error loading games:', fetchError instanceof Error ? fetchError.message : String(fetchError));
        setError('Failed to load games. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = (event: MediaQueryListEvent) => setIsMobileView(event.matches);

    setIsMobileView(mediaQuery.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', onChange);
    } else {
      mediaQuery.addListener(onChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', onChange);
      } else {
        mediaQuery.removeListener(onChange);
      }
    };
  }, []);

  useEffect(() => {
    setVisibleGameCount(isMobileView ? MOBILE_INITIAL_GAMES : DESKTOP_INITIAL_GAMES);
    setSelectedGameId(null);
  }, [searchTerm, isMobileView]);

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/drinks`)
      .then((res) => {
        if (!res.data.status) {
          throw new Error('Failed to load drinks');
        }
        setDrinks(
          res.data.data.map((drink: any) => ({
            ...drink,
            quantity: typeof drink.quantity === 'number' ? drink.quantity : 0,
          }))
        );
      })
      .catch((err) => {
        console.error('Drink fetch error:', err);
      });
  }, []);

  const getCartQuantity = (gameId: UUID) => {
    const item = cartItems.find((item) => String(item.id) === String(gameId));
    return item ? item.quantity : 0;
  };

  const getDrinkQuantity = (drinkId: string) => {
    const drinkItem = cartItems.find((item) => item.id === drinkId && item.type === 'drink');
    return drinkItem ? drinkItem.quantity : 0;
  };

  const handleQuantityChange = (game: Game, quantity: number) => {
    if (quantity <= 0) {
      updateCartItem(game.id, 0);
      return;
    }

    const cartItem = cartItems.find((item) => String(item.id) === String(game.id));
    if (cartItem) {
      updateCartItem(game.id, quantity);
    } else {
      addToCart({
        id: game.id,
        title: game.title,
        price: game.price,
        quantity,
        gameDuration: game.time_slot ? parseInt(game.time_slot, 10) : 10,
        type: 'game',
      });
      trackAddToCart({
        id: game.id,
        title: game.title,
        price: game.price,
        quantity,
      });
    }
  };

  const handleAddDrink = (drink: Drink) => {
    const cartItem = cartItems.find((item) => item.id === drink.id && item.type === 'drink');
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
        quantity: 1,
        gameDuration: 0,
        type: 'drink',
      });
      trackAddToCart({
        id: drink.id,
        title: drink.title,
        price: drink.price,
        quantity: currentQuantity + 1,
      });
    }
  };

  const handleRemoveDrink = (drinkId: string) => {
    const existingItem = cartItems.find((item) => item.id === drinkId && item.type === 'drink');
    if (existingItem && existingItem.quantity > 1) {
      updateCartItem(drinkId, existingItem.quantity - 1);
      return;
    }
    updateCartItem(drinkId, 0);
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
        quantity: newDrinkQuantity,
      });

      if (response.data.status) {
        setDrinks((prev) => [...prev, response.data.data]);
        setNewDrinkTitle('');
        setNewDrinkPrice(0);
        setNewDrinkQuantity(0);
        setShowAddDrinkForm(false);
      }
    } catch (err) {
      if (err instanceof Error) {
        alert(`Error adding drink: ${err.message}`);
      } else {
        alert(`Error adding drink: ${String(err)}`);
      }
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      alert('No games selected for checkout!');
      return;
    }
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    trackInitiateCheckout(total, cartItems as CartItem[]);
    navigate('/checkout');
  };

  const onPlayerError = (playerError: any, gameId: string) => {
    console.error(`YouTube player error for game ${gameId}:`, playerError);
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerPanel}>
        <div>
          <h1 className={styles.title}>Game Selection</h1>
          <p className={styles.subtitle}>Pick your games, tune quantity, and lock in your session lineup.</p>
        </div>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span>Games in Cart</span>
            <strong>{gameCartCount}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Drinks in Cart</span>
            <strong>{drinkCartCount}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Cart Total</span>
            <strong>{formatNaira(cartTotal)}</strong>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          type="text"
          placeholder="Search games..."
          className={styles.searchBar}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <p className={styles.stateText}>Loading games...</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : (
        <div className={styles.videoGrid}>
          {visibleGames.map((game, index) => {
            const currentQty = getCartQuantity(game.id);
            const isOpen = selectedGameId === game.id;
            const cardStyle = { ['--stagger' as any]: `${index * 55}ms` } as CSSProperties;
            const videoId = getYouTubeVideoId(game.url);
            const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';

            return (
              <article key={game.id} className={styles.videoCard} style={cardStyle}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.gameTitle}>{game.title}</h2>
                  <div className={styles.metaRow}>
                    <span className={styles.priceTag}>{formatNaira(game.price)}</span>
                    <span className={styles.durationTag}>{game.time_slot || '10 min'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.videoFrame}
                  onClick={() => setSelectedGameId((prev) => (prev === game.id ? null : game.id))}
                >
                  {isOpen && videoId ? (
                    <YouTube
                      videoId={videoId}
                      opts={{
                        playerVars: {
                          rel: 0,
                          modestbranding: 1,
                          playsinline: 1,
                        },
                      }}
                      onError={(event) => onPlayerError(event, game.id)}
                    />
                  ) : (
                    <div className={styles.videoPreview}>
                      {thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          alt={`${game.title} preview`}
                          className={styles.videoThumbnail}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className={styles.videoFallback}>Preview unavailable</div>
                      )}
                      <span className={styles.previewHint}>Tap to preview</span>
                    </div>
                  )}
                </button>

                <div className={styles.quantityControls}>
                  <button className={styles.qtyButton} onClick={() => handleQuantityChange(game, currentQty - 1)} disabled={currentQty === 0}>
                    <FaMinus />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={currentQty}
                    onChange={(e) => handleQuantityChange(game, Number(e.target.value))}
                    className={styles.quantityInput}
                  />
                  <button className={styles.qtyButton} onClick={() => handleQuantityChange(game, currentQty + 1)}>
                    <FaPlus />
                  </button>
                </div>

                {isOpen && (
                  <div className={styles.drinkList}>
                    <div className={styles.drinkHead}>
                      <h4>Pair with Drinks</h4>
                      <button onClick={() => setShowAddDrinkForm((prev) => !prev)} className={styles.addDrinkToggle}>
                        {showAddDrinkForm ? 'Close Form' : 'Add New Drink'}
                      </button>
                    </div>

                    {showAddDrinkForm && (
                      <div className={styles.addDrinkForm}>
                        <input
                          type="text"
                          placeholder="Drink Name"
                          value={newDrinkTitle}
                          onChange={(e) => setNewDrinkTitle(e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="Price"
                          value={newDrinkPrice}
                          onChange={(e) => setNewDrinkPrice(Number(e.target.value))}
                        />
                        <input
                          type="number"
                          placeholder="Quantity"
                          value={newDrinkQuantity}
                          onChange={(e) => setNewDrinkQuantity(Number(e.target.value))}
                        />
                        <button onClick={handleAddNewDrink}>Save Drink</button>
                      </div>
                    )}

                    {drinks.map((drink) => {
                      const qty = getDrinkQuantity(drink.id);
                      return (
                        <div key={drink.id} className={styles.drinkItem}>
                          <span className={styles.drinkName}>
                            {drink.title} - {formatNaira(drink.price)}
                          </span>
                          <div className={styles.drinkControls}>
                            <button
                              className={styles.qtyButton}
                              onClick={() => handleAddDrink(drink)}
                              disabled={qty >= drink.quantity || drink.quantity === 0}
                            >
                              <FaPlus />
                            </button>
                            <span className={styles.drinkQty}>{qty}</span>
                            <button className={styles.qtyButton} onClick={() => handleRemoveDrink(drink.id)} disabled={qty === 0}>
                              <FaMinus />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
          {filteredGames.length === 0 && <p className={styles.stateText}>No games found for "{searchTerm}"</p>}
        </div>
      )}

      {hasMoreGames && (
        <button
          type="button"
          className={styles.loadMoreButton}
          onClick={() => setVisibleGameCount((current) => current + LOAD_MORE_STEP)}
        >
          Load More Games
        </button>
      )}

      <button
        className={styles.checkoutButton}
        onClick={handleCheckout}
        disabled={loading || !!error || cartItems.length === 0}
        {...getRoutePrefetchProps('/checkout')}
      >
        Checkout
      </button>
    </div>
  );
};

export default React.memo(GameSelection);
