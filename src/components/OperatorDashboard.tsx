// OperatorDashboard.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Game {
  id: string;
  title: string;
  customer: string;
}

const OperatorDashboard = () => {
  const [assignedGames, setAssignedGames] = useState<Game[]>([]);
  const token = localStorage.getItem('operatorToken');

  useEffect(() => {
    const fetchAssignedGames = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactions/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAssignedGames(res.data);
      } catch (err) {
        console.error('Error fetching games:', err);
      }
    };

    fetchAssignedGames();
  }, []);

  const handleConsume = async (gameItemId: string) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/consumed-game/consume`,
        { gameItemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssignedGames(prev => prev.filter(g => g.id !== gameItemId));
    } catch (err) {
      console.error('Error consuming game:', err);
    }
  };

  return (
    <div>
      <h2>Operator Dashboard</h2>
      <ul>
        {assignedGames.map(game => (
          <li key={game.id}>
            {game.title} - {game.customer}
            <button onClick={() => handleConsume(game.id)}>Mark as Attended</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OperatorDashboard;
