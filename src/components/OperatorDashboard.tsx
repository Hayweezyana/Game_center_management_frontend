import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface GameItem {
  id: string; // transaction_item ID
  game_title: string;
  customer: string;
  transaction_id: string;
  game_id: string;
  transaction_time: string;
}

const OperatorDashboard = () => {
  const [unconsumedGames, setUnconsumedGames] = useState<GameItem[]>([]);
  const token = localStorage.getItem('operatorToken');

  useEffect(() => {
    const fetchUnconsumedGames = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/consumed-game`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUnconsumedGames(res.data);
      } catch (err) {
        console.error('Error fetching unconsumed games:', err);
      }
    };

    fetchUnconsumedGames();
  }, []);

  const handleConsume = async (item: GameItem) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/consumed-game/consume`,
        {
          gameItemId: item.id,
          operator_name: localStorage.getItem('name') || 'Unknown Operator',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setUnconsumedGames(prev => prev.filter(g => g.id !== item.id));
    } catch (err) {
      console.error('Error consuming game:', err);
    }
  };

  const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};


  return (
    <div>
      <h2>Operator Dashboard</h2>
      {unconsumedGames.length === 0 ? (
        <p>No games to consume at the moment.</p>
      ) : (
        <ul>
          {unconsumedGames.map((item) => (
            <li key={item.id} style={{ marginBottom: '1rem' }}>
              <strong>{item.game_title}</strong> - {item.customer}
              <br />
              {item.transaction_time && (
                <small>
                  Date & Time: {formatDate(item.transaction_time).toLocaleString()}
                </small>
              )}
              <button onClick={() => handleConsume(item)}>Mark as Attended</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default OperatorDashboard;
