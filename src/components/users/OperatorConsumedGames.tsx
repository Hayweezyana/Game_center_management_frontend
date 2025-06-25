import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface ConsumedGame {
  game_title: string;
  transaction_id: string;
  unit_index: number;
  consumed_at: string;
}

const OperatorConsumedGames = () => {
  const [games, setGames] = useState<ConsumedGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConsumedGames = async () => {
      try {
        const token = localStorage.getItem('operatorToken');
        const operatorName = localStorage.getItem('name');

        const res = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/v1/admin/consume-game`,
        );
        setGames(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch consumed games:', err);
      }
    };

    fetchConsumedGames();
  }, []);

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Consumed Games History</h2>
      {loading ? (
        <p>Loading...</p>
      ) : games.length === 0 ? (
        <p>No consumed games yet.</p>
      ) : (
        <table border={1} cellPadding={10} style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Game</th>
              <th>Unit</th>
              <th>Transaction ID</th>
              <th>Consumed At</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g, idx) => (
              <tr key={idx}>
                <td>{g.game_title}</td>
                <td>Unit #{g.unit_index + 1}</td>
                <td>{g.transaction_id}</td>
                <td>{new Date(g.consumed_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default OperatorConsumedGames;
