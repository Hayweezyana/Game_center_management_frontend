import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './OperatorDashboard.css'

interface GameItem {
  id: string; // transaction_item ID
  game_title: string;
  game_duration?: number; // in minutes, optional
  username: string;
  game_quantity: number;
  transaction_created_at: string;
  transaction_time: string; // ISO date string
  transaction: {
    game_duration?: number | null;
  };
  unit_index: number;

}

const OperatorDashboard = () => {
  const [unconsumedGames, setUnconsumedGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<GameItem | null>(null);
const [availablePCs, setAvailablePCs] = useState<any[]>([]);
const [selectedPC, setSelectedPC] = useState('');



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
      const now = new Date();
      const filtered = res.data.filter((item: GameItem) => {
        const createdAt = new Date(item.transaction_time);
        const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        return hoursElapsed <= 24;
      });
      setUnconsumedGames(filtered);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching unconsumed games:', err);
    }
  };

  fetchUnconsumedGames();
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
          transactionItemId: item.id,
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
  setSelectedItem(item);
  try {
    const res = await axios.get<{ pcs: any[] }>(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/available-pcs`, {
      params: { game_title: item.game_title },
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = res.data;
    console.log("API raw data:", data);
    setAvailablePCs(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('Failed to fetch available PCs:', err);
  }
  } catch (err) {
    console.error('Error consuming game:', err);
  }
}



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
        <button onClick={() => handleConsume(item)}disabled={loading}>Mark as Attended</button>
      </td>
    </tr>
  );
})}
</tbody>

      </table>
    )}
  {selectedItem && (
    <div className="pc-select-modal">
      <h3>Select PC for {selectedItem.game_title}</h3>
      <select value={selectedPC} onChange={(e) => setSelectedPC(e.target.value)}>
        <option value="">-- Select PC --</option>
        {availablePCs && Array.isArray(availablePCs) && availablePCs.map(pc => (
  <option key={pc.id} value={pc.title}>
    {pc.title}
  </option>
))}
      </select>
      <br />
      <button
        disabled={!selectedPC}
        onClick={async () => {
          const token = localStorage.getItem('operatorToken');
          const gameDuration = selectedItem.transaction?.game_duration ?? selectedItem.game_duration ?? 6;
          const totalDuration = gameDuration + 3;
          try {
            await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/unlock`, {
              pc_id: availablePCs.find(pc => pc.title === selectedPC)?.id,
              pc_name: selectedPC,
              duration_minutes: totalDuration,
              transactionItemId: selectedItem.id,
              unit_index: selectedItem.unit_index
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });

            setUnconsumedGames(prev =>
              prev.filter(g => !(g.id === selectedItem.id && g.unit_index === selectedItem.unit_index))
            );
            setSelectedItem(null);
            setSelectedPC('');
          } catch (err) {
            console.error('Failed to unlock PC:', err);
          }
        }}>
        Open PC
      </button>
      <button onClick={() => { setSelectedItem(null); setSelectedPC(''); }}>Cancel</button>
    </div>
  )}
  
  </div>
</div>
    );
};

export default OperatorDashboard;
