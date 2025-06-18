// src/components/AIChatBox.tsx
import React, { useState } from 'react';
import axios from 'axios';

interface Props {
  isAdmin: boolean;
}

const AIChatBox: React.FC<Props> = ({ isAdmin }) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isAdmin) return null;

  const handleSend = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/ai/prompt', { prompt });
      setResponse(res.data.response);
    } catch (err) {
      setResponse('Error fetching AI insights.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 p-4 border rounded-lg bg-white shadow">
      <h2 className="font-bold text-lg mb-2">AI Assistant (Admin Only)</h2>
      <textarea
        rows={4}
        className="w-full p-2 border rounded"
        placeholder="Ask AI about sales trends, performance, etc..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button
        onClick={handleSend}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
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
