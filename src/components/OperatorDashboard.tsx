import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './OperatorDashboard.css'

interface GameItem {
  id: string; // transaction_item ID
  game_title: string;
  username: string;
  game_quantity: number;
  transaction_created_at: string;
  transaction_time: string; // ISO date string
  transaction: {
  };
  unit_index: number;

}

const OperatorDashboard = () => {
  const [unconsumedGames, setUnconsumedGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchUnconsumedGames = async () => {
      try {
        const token = localStorage.getItem('operatorToken');
        if (!token) {
          console.warn('No token found for operator.');
          return;
        }

        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/consumed-game`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUnconsumedGames(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching unconsumed games:', err);
      }
    };

    fetchUnconsumedGames();
    const interval = setInterval(fetchUnconsumedGames, 5000); // auto-refresh

    return () => clearInterval(interval); // cleanup
  }, []);

  const handleConsume = async (item: GameItem) => {
    if (item.unit_index >= item.game_quantity) {
    console.warn("All units already consumed. Skipping.");
    return;
  }
    try {
      const token = localStorage.getItem('operatorToken');
      if (!token) {
        console.warn('No token found for operator.');
        return;
      }

      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/consumed-game/consume`,
        {
          gameItemId: item.id,
          operator_name: localStorage.getItem('name') || 'Unknown Operator',
          unit_index: item.unit_index,
          game_title: item.game_title,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setUnconsumedGames(prev =>
  prev.filter(g => !(g.id === item.id && g.unit_index === item.unit_index))
);
    } catch (err) {
      console.error('Error consuming game:', err);
    }
  };



const getRowColor = (item: GameItem) => {
  const isConsumed = false; // will be false since this is unconsumed list
  const isPartial = item.unit_index < item.game_quantity - 1;
  return isPartial ? '#d4edda' : '#cce5ff'; // green for partial, blue for untouched
};

return (
<div>
  <div style={{ padding: '1rem' }}>
    <h2>Operator Dashboard</h2>
    {loading ? (
      <div className="spinner">Loading...</div>
    ) : unconsumedGames.length === 0 ? (
      <p>No games to consume at the moment.</p>
    ) : (
      <table border={1} cellPadding={10} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Game</th>
            <th>Transaction Time</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
{unconsumedGames.map((item) => {
  return (
    <tr key={`${item.id}-${item.unit_index}`} style={{ backgroundColor: getRowColor(item) }}>
      <td>{item.username}</td>
      <td>{item.game_title} (Unit #{item.unit_index + 1})</td>
      <td>{new Date(item.transaction_time).toLocaleString()}</td>
      <td>
        <button onClick={() => handleConsume(item)}>Mark as Attended</button>
      </td>
    </tr>
  );
})}
</tbody>

      </table>
    )}
</div>
    </div>
  );
};

export default OperatorDashboard;
