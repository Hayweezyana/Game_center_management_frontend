import React, { useState } from 'react';
import axios from 'axios';

interface Props {
  isAdmin: boolean;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

const AIChatBox: React.FC<Props> = ({ isAdmin, defaultStartDate = '', defaultEndDate = '' }) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [gameTitle, setGameTitle] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  if (!isAdmin) return null;

  const handleSend = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/ai-insights/prompt`, {
        prompt,
        period: 'custom',
        startDate,
        endDate,
        gameTitle,
        paymentMethod,
      });
      setResponse(res.data.response || 'No response received.');
    } catch (err) {
      console.error('Error fetching AI insights:', err);
      setResponse('Error fetching AI insights.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 p-4 border rounded-lg bg-white shadow">
      <h2 className="font-bold text-lg mb-2">AI Assistant (Admin Only)</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Game Title</label>
          <input
            type="text"
            placeholder="e.g. 360 Video Booth"
            value={gameTitle}
            onChange={(e) => setGameTitle(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Payment Method</label>
          <input
            type="text"
            placeholder="e.g. immersia"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
          />
        </div>
      </div>

      <textarea
        rows={4}
        className="w-full p-2 border rounded"
        placeholder="Ask AI about sales trends, performance, etc..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <button
        onClick={handleSend}
        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        disabled={loading}
      >
        {loading ? 'Analyzing...' : 'Ask AI'}
      </button>

      {response && (
        <div className="mt-4 p-3 bg-gray-100 border rounded">
          <h3 className="font-semibold mb-1">AI Response:</h3>
          <p className="whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </div>
  );
};

export default AIChatBox;
