import React, { CSSProperties, useEffect, useMemo, useState } from 'react';
import YouTube from 'react-youtube';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { UUID } from 'crypto';
import { useCartContext } from './hooks/useCart';
import { trackAddToCart, trackInitiateCheckout } from '../utils/metaPixel';
import { getRoutePrefetchProps } from '../utils/routePrefetch';
import { formatWait, useAvailability, waitTone } from './hooks/useAvailability';
import { starFill, useRatings } from './hooks/useRatings';
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
  category?: string | null;
}

const CATEGORIES = ['All', 'Scary', 'Roam Free', 'Adventure', 'Sports', 'Wheels', 'Racing', 'Music', 'Console', 'Kids'] as const;
type Category = typeof CATEGORIES[number];

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
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
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
  // Next-available time per experience, so the wait is visible before choosing.
  const { byGameId: availability, now: availabilityNow } = useAvailability();
  // What previous players scored each experience — the same ratings collected on
  // the waiting page, shown back to the people choosing.
  const { byGameId: ratings } = useRatings();

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchesSearch = game.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All' ||
        (game.category ?? '').toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory, games]);
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
        const [gamesRes, popularRes] = await Promise.all([
          axios.get<{ status: boolean; data: Game[] }>(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/games`),
          axios.get<{ status: boolean; data: Array<{ game_title: string; play_count: number }> }>(
            `${process.env.REACT_APP_BACKEND_URL}/v1/admin/games/popular`
          ).catch(() => ({ data: { status: true, data: [] } })),
        ]);
        if (!gamesRes.data.status) {
          throw new Error(`Unexpected response format: ${JSON.stringify(gamesRes.data)}`);
        }
        const counts: Record<string, number> = {};
        for (const row of popularRes.data.data ?? []) {
          counts[row.game_title] = row.play_count;
        }
        // Sort most-played first
        const sorted = [...gamesRes.data.data].sort(
          (a, b) => (counts[b.title] ?? 0) - (counts[a.title] ?? 0)
        );
        setGames(sorted);
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
        <div className={styles.categoryPills}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`${styles.categoryPill}${selectedCategory === cat ? ` ${styles.categoryPillActive}` : ''}`}
              onClick={() => { setSelectedCategory(cat); setVisibleGameCount(isMobileView ? MOBILE_INITIAL_GAMES : DESKTOP_INITIAL_GAMES); }}
            >
              {cat}
            </button>
          ))}
        </div>
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
            // "Drinks" is a catalogue row with no session length, not something
            // anyone queues for — a wait time on it would be nonsense.
            const isTimedExperience = Number(game.time_slot) > 0;
            const slot = availability[String(game.id)];
            const waitLabel = isTimedExperience ? formatWait(slot, availabilityNow) : null;
            const tone = waitTone(slot, availabilityNow);
            // Deliberately not on offer — selling it would create a ticket
            // nobody can honour. A station that is merely offline stays sellable.
            const notOffered = isTimedExperience && slot ? !slot.bookable : false;
            // Absent until enough people have rated it — one score is an opinion,
            // not a rating, and would read as a verdict on the card.
            const rating = ratings[String(game.id)];

            return (
              <article key={game.id} className={styles.videoCard} style={cardStyle}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.gameTitle}>{game.title}</h2>
                  <div className={styles.metaRow}>
                    <span className={styles.priceTag}>{formatNaira(game.price)}</span>
                    <span className={styles.durationTag}>{game.time_slot || '10 min'}</span>
                  </div>
                  {waitLabel && (
                    <div className={`${styles.availability} ${styles[`availability_${tone}`]}`}>
                      <span className={styles.availabilityDot} aria-hidden="true" />
                      <span>{waitLabel}</span>
                      {slot && slot.units_ahead > 0 && tone !== 'none' && (
                        <span className={styles.availabilityAhead}>
                          {slot.units_ahead} ahead
                        </span>
                      )}
                    </div>
                  )}
                  {rating && (
                    <div
                      className={styles.rating}
                      aria-label={`Rated ${rating.average_rating} out of 5 by ${rating.responses} players`}
                    >
                      <span className={styles.ratingStars} aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const fill = starFill(rating.average_rating);
                          const cls =
                            fill >= star
                              ? styles.ratingStarOn
                              : fill >= star - 0.5
                              ? styles.ratingStarHalf
                              : styles.ratingStarOff;
                          return (
                            <span key={star} className={cls}>
                              ★
                            </span>
                          );
                        })}
                      </span>
                      <span className={styles.ratingScore}>{rating.average_rating.toFixed(1)}</span>
                      <span className={styles.ratingCount}>({rating.responses})</span>
                    </div>
                  )}
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

                {isOpen && rating && rating.comments.length > 0 && (
                  <div className={styles.reviews}>
                    <h3 className={styles.reviewsTitle}>What players said</h3>
                    <ul className={styles.reviewList}>
                      {rating.comments.map((review) => (
                        <li key={review.id} className={styles.review}>
                          <div className={styles.reviewHead}>
                            <span className={styles.reviewStars} aria-label={`${review.rating} out of 5`}>
                              {'★'.repeat(review.rating)}
                              <span className={styles.ratingStarOff}>{'★'.repeat(5 - review.rating)}</span>
                            </span>
                            <span className={styles.reviewName}>{review.name}</span>
                          </div>
                          <p className={styles.reviewText}>{review.comment}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {notOffered ? (
                  <p className={styles.notOffered}>Not available right now</p>
                ) : (
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
                )}

                {isOpen && (!game.time_slot || Number(game.time_slot) === 0) && (
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
