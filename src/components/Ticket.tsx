import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import logo from './logo/immersia.png';
import { trackPurchase } from '../utils/metaPixel';
import { recordStep } from '../utils/visitTracking';
import  {useCartContext}  from './hooks/useCart'; // Adjust the import based on your project structure

declare global {
  interface Window {
    fbq?: any;
  }
}


interface CartItem {
  id: string;
  pc_id: string;
  gameDuration: number;
  quantity: number;
  title: string;
  pc_title: string;
  price: number;
}

interface UserDetails {
  id: string;
  username: string;
  /** Optional — when present it is hashed server-side to improve Meta match quality. */
  phone?: string;
}

interface LocationState {
  merchantReference?: string;
  reference?: string;
  cartItems?: CartItem[];
  finalAmount?: number;
  dateTime?: string;
  adminName?: string;
  discount?: number;
  userDetails?: UserDetails;
}

const Ticket: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();


  const [reference, setReference] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [finalAmount, setTotalAmount] = useState<number>(0);
  const [dateTime, setDateTime] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { setCart } = useCartContext(); // Adjust based on your hook/contexts

  // ── Meta Purchase tracking ────────────────────────────────────────────────
  // Fires exactly once per reference. Without the guard, a re-render that
  // changes finalAmount (or a revisit to this ticket) reports the same sale to
  // Meta twice and inflates reported conversions.
  const purchaseTrackedRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!finalAmount || finalAmount <= 0 || !cartItems.length) return;

    const key = reference || `${finalAmount}:${cartItems.length}`;
    if (purchaseTrackedRef.current === key) return;
    purchaseTrackedRef.current = key;

    trackPurchase(finalAmount, cartItems, reference || undefined, {
      phone: userDetails?.phone,
      externalId: userDetails?.id,
    });

    // Close the funnel. This page only renders once a sale has gone through,
    // so this marks a confirmed payment rather than an intent to pay.
    recordStep('paid', reference || undefined);
  }, [finalAmount, cartItems, reference, userDetails]);

  useEffect(() => {
    const state = location.state as LocationState | null;

    if (state && (state.merchantReference || state.reference) && state.cartItems) {
      const ref = state.merchantReference || state.reference || null;

      setReference(ref);
      setCartItems(state.cartItems || []);
      setTotalAmount(state.finalAmount || 0);
      setDateTime(state.dateTime || new Date().toISOString());
      setAdminName(state.adminName || '');
      setDiscount(state.discount || 0);
      setUserDetails(state.userDetails || null);
    } else {
      setErrorMessage('No ticket data available. Please complete a transaction first.');
    }
  }, [location.state]);

  const handleProceedToQueue = async () => {
    if (!cartItems.length || !userDetails) {
      alert('Missing cart items or user details.');
      return;
    }

    try {
      await Promise.all(
        cartItems.map((item) =>
          axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/queue/add`, {
            game_id: item.id,
            user_id: userDetails.id,
            username: userDetails.username,
            game_duration: item.gameDuration,
            quantity: item.quantity,
            game_title: item.title,
          })
        )
      );
      alert('Successfully added to queue!');
      navigate('/Queue');
    } catch (error) {
      console.error('Error posting to queue:', error);
      alert('Failed to add to queue.');
    }
  };

  const printTicket = () => {
    const content = document.getElementById('printable-area')?.innerHTML;
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow && content) {
      printWindow.document.write('<html><head><title>Ticket</title></head><body>');
      printWindow.document.write(content);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (errorMessage) {
    return (
      <div style={styles.ticketContainer}>
        <p style={{ color: 'red' }}>{errorMessage}</p>
        <button style={styles.queueButton} onClick={() => navigate('/gameselection')}>
          Go to Home
        </button>
      </div>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  


  //add return to home button


  return (
    <div style={styles.ticketContainer}>
      <div id="printable-area">
        <div style={styles.header}>
          <img src={logo} alt="Immersia Logo" style={styles.logo} />
          <p style={styles.subtitle}>IG: @immersiang | www.immersiavr.com</p>
        </div>

        <div style={styles.details}>
          <h2 style={styles.sectionTitle}>Ticket Details</h2>
          <p>
            <strong>Reference:</strong> {reference || 'N/A'}
          </p>
          <p>
            <strong>Username:</strong> {userDetails?.username || 'N/A'}
          </p>
          <p>
            <strong>Date & Time:</strong> {formatDate(dateTime)}
          </p>
        </div>

        <div style={styles.games}>
          <h2 style={styles.sectionTitle}>Cart Items</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Game</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Price</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item, index) => (
                <tr key={index}>
                  <td style={styles.td}>{item.title}</td>
                  <td style={styles.td}>{item.quantity}</td>
                  <td style={styles.td}>₦{item.price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {discount > 0 && (
          <p>
            <strong>Discount:</strong> ₦{discount.toFixed(2)}
          </p>
        )}

        <div style={styles.total}>
          <p>
            <strong>Total Amount Paid:</strong> ₦{finalAmount.toFixed(2)}
          </p>
        </div>

        {adminName && (
          <p>
            <strong>Processed by:</strong> {adminName}
          </p>
        )}

        <div style={styles.footer}>
          <p style={styles.thankYou}>Thank you for choosing Immersia VR!</p>
        </div>
      </div>

      <button style={styles.printButton} onClick={printTicket}>
        Print Ticket
      </button>
      <button
  style={styles.homeButton}
  onClick={() => {
    setCart([]); // Clear the cart
    navigate('/gameselection'); // Navigate
  }}
>
  Let's play again
</button>

      <button style={styles.queueButton} onClick={handleProceedToQueue}>
        To Queue
      </button>
    </div>
  );
};

export default Ticket;

const styles = {
  ticketContainer: {
    maxWidth: '800px',
    margin: '20px auto',
    padding: '20px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 0 10px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '18px',
    marginBottom: '15px',
    color: '#333'
  },
  games: {
    marginBottom: '20px',
    padding: '10px'
  },
  total: {
    marginTop: '20px',
    padding: '10px',
    borderTop: '1px solid #ddd'
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '20px'
  },
  details: {
    marginBottom: '20px',
    padding: '10px'
  },
  queueButton: {
    padding: '10px 20px',
    margin: '10px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  printButton: {
    padding: '10px 20px',
    margin: '10px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  logo: {
    maxWidth: '200px',
    height: 'auto'
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginTop: '10px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: '20px'
  },
  th: {
    border: '1px solid #ddd',
    padding: '8px',
    textAlign: 'left' as const,
    backgroundColor: '#f4f4f4'
  },
  td: {
    border: '1px solid #ddd',
    padding: '8px'
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '20px',
    borderTop: '1px solid #ddd',
    paddingTop: '10px'
  },
  thankYou: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333'
  },
  homeButton: {
    padding: '10px 20px',
    margin: '10px',
    backgroundColor: '#f0ad4e',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};
