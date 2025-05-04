import { useLocation, useNavigate } from 'react-router-dom';
import logo from './logo/immersia.png';
import axios from 'axios';
import React, { useState, useEffect } from 'react';

interface CartItem {
  id: string;
  pc_id: string;
  gameDuration: number;
  quantity: number;
  gameTitle: string;
  pc_title: string;
  price: number;
}

interface ResponseData {
  status: boolean;
  data: {
    transaction_id: string;
    [key: string]: any;
  };
}



const handleProceedToQueue = async (cartItems: CartItem[], username: string, 
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>
) => {
  const errors: Record<string, string> = {};

  for (const item of cartItems) {
    if (!item.gameTitle || !item.quantity || !item.gameDuration) {
      errors[item.id] = 'Missing required fields (title, quantity, or duration)';
    }
  }

  if (Object.keys(errors).length > 0) {
    setValidationErrors(errors);
    return false;
  }


  try {
    const queueData = cartItems.map((item) => ({
      game_id: item.id,
      username,
      game_duration: item.gameDuration,
      quantity: item.quantity,
      game_title: item.gameTitle,
    }));
    console.log('Sending queueData:', queueData);
    
    await Promise.all(
      cartItems.map((item) =>
        axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/queue/add`, {
          game_id: item.id,
          username,
          game_duration: item.gameDuration,
          quantity: item.quantity,
          game_title: item.gameTitle,
        })
      )
    );
    alert('Successfully added to queue!');
    setValidationErrors({});
    return true;
  } catch (error) {
    console.error('Error posting to queue:', error);
    alert('Failed to add to queue.');
    return false;
  }
};

const Ticket: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  

  const { id, games, totalAmount, dateTime, userDetails, cartItems, adminName, discount } = location.state as {
    id: string;
    games: { name: string; quantity: number; price: number }[];
    totalAmount: number;
    dateTime: string;
    adminName?: string;
    discount?: number;
    userDetails: { username: string };
    cartItems: CartItem[];
  };

  //to get transactionId from the backend
  const [fetchedTransactionId, setFetchedTransactionId] = useState<string | null>(id);

  // Fetch transaction ID only if not available in state
  useEffect(() => {
    if (!id) {
      console.warn("No transaction ID provided in location state.");
      setFetchedTransactionId("Missing");
      return;
    }
  
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactions/${id}`)
      .then((response) => {
        console.log("Fetched Transaction:", response.data);
        const data = response.data?.data;
  
        if (data) {
          const txId = data.transaction_id || data.id || 'Unknown';
          setFetchedTransactionId(txId);
        } else {
          setFetchedTransactionId('Not Found');
        }
      })
      .catch((error) => {
        console.error("Error fetching transaction:", error);
        setFetchedTransactionId("Error");
      });
  }, [id]);
  
  



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

  return (
    <div style={styles.ticketContainer}>
      <div id="printable-area"> {/* Add this wrapper */}
      <div style={styles.header}>
      <pre style={{ background: '#eee', padding: '10px', fontSize: '12px' }}>
        Raw transactionId: {id}
        {"\n"}Fetched transactionId: {fetchedTransactionId}</pre>

        <img src={logo} alt="Immersia Logo" style={styles.logo} />
        <p style={styles.subtitle}>IG: @immersiang | www.immersiavr.com</p>
      </div>

      <div style={styles.details}>
        <h2 style={styles.sectionTitle}>Transaction Details</h2>
        <p><strong>Transaction ID:</strong> {fetchedTransactionId || id || 'Loading...'}</p>
        <p><strong>Username:</strong> {userDetails.username}</p>

        <p><strong>Date & Time:</strong> {dateTime}</p>
      </div>

      <div style={styles.games}>
        <h2 style={styles.sectionTitle}>Games</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Game</th>
              <th style={styles.th}>Quantity</th>
              <th style={styles.th}>Price</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game, index) => {
              const error = validationErrors[cartItems[index]?.id];
              return (
                <React.Fragment key={index}>
                  <tr
                    style={
                      error
                        ? { backgroundColor: '#ffe6e6', border: '1px solid red' }
                        : undefined
                    }
                  >
                <td style={styles.td}>{game.name}</td>
                <td style={styles.td}>{game.quantity}</td>
                <td style={styles.td}>₦{game.price.toFixed(2)}</td>
              </tr>
              {error && (
          <tr>
            <td colSpan={3} style={{ color: 'red', padding: '6px', fontSize: '14px' }}>
              ⚠️ {error}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  })}
          </tbody>
        </table>
      </div>
      {discount && (
        <p><strong>discount:</strong> {discount}</p>
        )}

      <div style={styles.total}>
        <p><strong>Total Amount Paid:</strong> ₦{totalAmount.toFixed(2)}</p>
      </div>
      {adminName && (
        <p><strong>Processed by:</strong> {adminName}</p>
        )}

      <div style={styles.footer}>
        <p style={styles.thankYou}>Thank you for choosing Immersia VR!</p>
      </div>
      </div> {/* End of printable-area */}

      <button style={styles.printButton} onClick={printTicket}>Print Ticket</button>
      <button
        style={styles.queueButton}
        onClick={async () => {
          const success = await handleProceedToQueue(cartItems, userDetails.username, setValidationErrors);
          if (success) {
            navigate('/Queue');
          }
        }}
      >
        To Queue
      </button>
    </div>
  );
};

export default Ticket;

// Add this to the existing React import at the top of the file

const styles = {
  sectionTitle: {
    fontSize: '1.5em',
    marginBottom: '15px',
    color: '#333',
  },
  ticketContainer: {
    maxWidth: '600px',
    margin: '20px auto',
    padding: '20px',
    border: '1px solid #ccc',
    borderRadius: '8px',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '20px'
  },
  logo: {
    width: '200px',
    height: 'auto',
    marginBottom: '10px'
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '20px'
  },
  details: {
    marginBottom: '20px',
    padding: '10px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: '20px'
  },
  th: {
    border: '1px solid #ddd',
    padding: '8px',
    backgroundColor: '#333'
  },
  td: {
    border: '1px solid #ddd',
    padding: '8px'
  },
  total: {
    marginTop: '20px',
    padding: '10px',
    fontWeight: 'bold'
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '20px',
    padding: '10px'
  },
  games: {
    marginBottom: '20px',
    padding: '10px'
  },
  thankYou: {
    fontSize: '16px',
    color: '#333',
    fontWeight: 'bold'
  },
  printButton: {
    padding: '10px 20px',
    margin: '10px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  queueButton: {
    padding: '10px 20px',
    margin: '10px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};


