import React, { useState, useEffect, ChangeEvent, SetStateAction } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import UserDetails from '../UserDetails';
import CartAndPayment from '../CartAndPayment';
import Admin from './Admin';

interface Game {
  id: string;
  title: string;
  price: number;
}

export interface UserInfo {
  id?: string;
  username: string;
  phone: string;
  email?: string;
}

interface CartItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
  gameDuration: number;
  type: "game" | "drink";
}

// interface UserDetailsProps {
//   userDetails: { id?: string; username: string; phone: string; email?: string };
//   setUserDetails: (details: { id?: string; username: string; phone: string; email?: string }) => void;
//   onNext: () => void;
// }

const AdminTransaction = () => {
const [errors, setErrors] = useState<{ id?: string; username?: string; phone?: string; email?: string }>({});
const [userDetails, setUserDetails] = useState<UserInfo>({ username: '', phone: '', email: '' }); 
const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [status, setStatus] = useState<string | null>(null);
  const [payment_methods, setPaymentMethods] = useState<{ method: "Moniepoint"; amount: number }[]>([]);

  const [games, setGames] = useState<Game[]>([]);
  const [selectedGames, setSelectedGames] = useState<{ [id: string]: number }>({}); // id -> qty
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  // ✅ Fetch games on mount
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await axios.get<{ status: boolean; data: Game[] }>(
          `${process.env.REACT_APP_BACKEND_URL}/v1/admin/games`
        );
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
  }, []);

  // Save/Update User
//   const handleSubmitUser = async () => {
//     setIsLoading(true);
//     setSubmitError(null);

//     try {
//       const url = isExistingUser
//         ? `${process.env.REACT_APP_BACKEND_URL}/v1/admin/users/${userDetails.id}`
//         : `${process.env.REACT_APP_BACKEND_URL}/v1/admin/users`;

//       const method = isExistingUser ? 'PUT' : 'POST';

//       const response = await fetch(url, {
//         method,
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(userDetails),
//       });

//       const result = await response.json();
//       if (!response.ok) throw new Error(result.message || 'Failed to process user');
//     } catch (error) {
//       setSubmitError(error instanceof Error ? error.message : 'User save error');
//     } finally {
//       setIsLoading(false);
//     }
//   };

  // Save Transaction
  const saveTransaction = async () => {
    try {
      const cartItems = Object.entries(selectedGames).map(([gameId, qty]) => {
        const game = games.find((g) => g.id === gameId)!;
        return { game_id: game.id, title: game.title, qty: Number(qty) || 0,
        price: Number(game.price) || 0 };
      });

      const finalAmount = cartItems.reduce((sum, item) => sum + item.qty * item.price, 0);

      if (isNaN(finalAmount)) {
        setStatus("Error: Invalid cart items or prices.");
        return <div>No transactions available</div>;
      }

      const transactionPayload = {
        ...userDetails,
        reference: uuidv4(),
        merchantReference: uuidv4(),
        amount: finalAmount,
        discount: 0,
        discount_description: '',
        cartItems,
        payment_methods: [{ method: "Moniepoint", amount: finalAmount }],
        gameDuration: 0,
      };

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/transaction`,
        transactionPayload
      );

      console.log('✅ Transaction Saved:', response.data);

      navigate('/ticket', {
        state: {
          finalAmount,
          userDetails,
          cartItems,
          merchantReference: transactionPayload.merchantReference,
          dateTime: new Date().toISOString(),
          discount: 0,
        },
      });
    } catch (err: any) {
      console.error('❌ Transaction save failed:', err.response?.data || err.message);
      setStatus('Failed to record transaction.');
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setUserDetails({ ...userDetails, [name]: value });
  };

  // ✅ Enable transaction button only if valid
  const canSaveTransaction =
    userDetails.username &&
    userDetails.phone &&
    selectedMethod &&
    Object.keys(selectedGames).length > 0;

const cartItems = Object.entries(selectedGames).map(([gameId, qty]) => {
    const game = games.find((g) => g.id === gameId);
    return {
    id: game?.id || '',
    title: game?.title || 'Unknown',
    quantity: Number(qty) || 0,
    price: Number(game?.price) || 0,
    gameDuration: 0,
    type: "game" as "game",
  };
});

const finalAmount = cartItems.reduce(
  (sum, item) => sum + Number(item.quantity) * Number(item.price),
  0
);

    function setCart(value: SetStateAction<CartItem[]>): void {
        if (typeof value === 'function') {
            setPaymentMethods((prev) =>
                prev.map((item) => ({
                    method: "Moniepoint",
                    amount: item.amount || 0,
                }))
            );
        } else {
            setPaymentMethods(
                value.map((item) => ({
                    method: "Moniepoint",
                    amount: item.price * item.quantity || 0,
                }))
            );
        }
    }

// // Guard against NaN
// if (isNaN(finalAmount)) {
//   console.error("❌ Final amount is NaN, cartItems:", cartItems);
//   setStatus("Error: Invalid cart items or prices.");
//   return <div>No transactions available</div>;
// }

  return (
    <div>
      {/* User Details */}
      {(
        <UserDetails
          userDetails={userDetails}
          setUserDetails={setUserDetails}
          onNext={() => {}}
        />
      )}

      {/* Payment method */}
      <div className="mt-4">
        <label>Payment Method:</label>
        <select
          value={selectedMethod}
          onChange={(e) => setSelectedMethod(e.target.value)}
          className="w-full p-2 border rounded mt-2"
        >
          <option value="">-- Select Payment Method --</option>
          <option value="Funstation_Moniepoint">Funstation_Moniepoint</option>
          <option value="Paystack">Paystack</option>
          <option value="Immersia_Moniepoint">Immersia_Moniepoint</option>
          <option value="Immersia_CASH">Immersia_CASH</option>
          <option value="Funstation_CASH">Funstation_CASH</option>
        </select>
      </div>

      {/* Game selection */}
      <div className="mt-6">
        <h3>Select Games</h3>
        {loading && <p>Loading games...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {!loading && games.length > 0 && (
          <ul>
            {games.map((game) => (
              <li key={game.id} className="flex items-center gap-2">
                <span>{game.title} (₦{game.price})</span>
                <input
                  type="number"
                  min={0}
                  value={selectedGames[game.id] || 0}
                  onChange={(e) =>
          setSelectedGames({
            ...selectedGames,
            [game.id]: Number(e.target.value) || 0,
          })
                  }
                  style={{ width: '60px', textAlign: 'center' }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {(
        <CartAndPayment
          cartItems={cartItems}
          cartTotal={finalAmount ?? 0}
          payment_methods={payment_methods}
          setPaymentMethods={setPaymentMethods}
          setCartItems={setCart}
          onNext={() => console.log('Next step triggered')}
        />
      )}
      Total: ₦{finalAmount}

      {/* Save transaction button */}
      <div className="mt-4">
        <button
          onClick={saveTransaction}
          disabled={!canSaveTransaction}
          className="bg-blue-500 text-white p-2 rounded disabled:bg-gray-400"
        >
          Save Transaction
        </button>
      </div>

      {status && <p style={{ color: 'red' }}>{status}</p>}
    </div>
  );
};

export default AdminTransaction;
