import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';

interface ConsumedGame {
  game_title: string;
  transaction_id: string;
  operator_name: string;
  username: string;
  unit_index: number;
  consumed_at: string;
}

const OperatorConsumedGames = () => {
  const [games, setGames] = useState<ConsumedGame[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for filtering
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // State for Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const fetchConsumedGames = async () => {
      try {
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

  // 1. Filter Logic
  const filteredGames = useMemo(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1); 

    return games.filter((game) => {
      if (!game) return false;
      const consumeDate = new Date(game.consumed_at).getTime();
      const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
      const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

      if (start && consumeDate < start) return false;
      if (end && consumeDate > end) return false;

      const term = searchTerm.toLowerCase();
    
    // We use (game.field || "") to ensure we always have a string before calling toLowerCase
    const uName = (game.username || "").toLowerCase();
    const gTitle = (game.game_title || "").toLowerCase();
    const oName = (game.operator_name || "").toLowerCase();

    return (
      uName.includes(term) ||
      gTitle.includes(term) ||
      oName.includes(term)
    );
  });
}, [games, startDate, endDate, searchTerm]);

  // 2. Pagination Logic
  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
  const paginatedGames = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredGames.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredGames, currentPage]);

  // 3. Export Logic (Still exports ALL filtered items, not just the page)
  const exportToCSV = () => {
    const headers = ["Game Title", "Unit", "Customer", "Operator", "Consumed At"];
    const rows = filteredGames.map(g => [
      `"${g.game_title || 'N/A'}"`,
  `Unit #${(g.unit_index ?? 0) + 1}`,
  `"${g.username || 'N/A'}"`,
  `"${g.operator_name || 'N/A'}"`,
  g.consumed_at ? new Date(g.consumed_at).toLocaleString() : 'N/A'
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Consumed Games History</h2>
        <button onClick={exportToCSV} disabled={filteredGames.length === 0} className="btn-export">
          Export CSV ({filteredGames.length})
        </button>
      </header>

      {/* Filter Toolbar (Same as before) */}
      <div className="filter-toolbar">
         <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
         <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
         <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
         <button onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); }}>Reset</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th>Game</th>
                <th>Unit</th>
                <th>Customer</th>
                <th>Operator</th>
                <th>Consumed At</th>
              </tr>
            </thead>
            <tbody>
              {paginatedGames.map((g, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}>{g.game_title}</td>
                  <td>Unit #{g.unit_index + 1}</td>
                  <td>{g.username}</td>
                  <td>{g.operator_name}</td>
                  <td>{new Date(g.consumed_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '5px 15px' }}
            >
              Previous
            </button>
            
            <span>Page <strong>{currentPage}</strong> of {totalPages || 1}</span>
            
            <button 
              disabled={currentPage >= totalPages} 
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '5px 15px' }}
            >
              Next
            </button>
          </div>
        </>
      )}

      <style>{`
        .btn-export { background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        .btn-export:disabled { background: #ccc; cursor: not-allowed; }
        .filter-toolbar { display: flex; gap: 10px; margin-bottom: 20px; background: #f9f9f9; padding: 15px; border-radius: 8px; flex-wrap: wrap; }
        .filter-toolbar input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        th { text-align: left; padding: 10px; }
      `}</style>
    </div>
  );
};

export default OperatorConsumedGames;