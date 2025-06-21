import React, { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

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

  const [chartData, setChartData] = useState<{
    topGames?: { name: string; value: number }[];
    salesTrend?: { date: string; value: number }[];
  }>({});

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
      console.log('AI Response:', res.data);
      setResponse(res.data.response || 'No response received.');
      setChartData(res.data.chartData || {});
    } catch (err) {
      console.error('Error fetching AI insights:', err);
      setResponse('Error fetching AI insights.');
      setChartData({});
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
        style={{ width: '100%', marginTop: '1rem', padding: '0.5rem' }}
        placeholder="Ask AI about sales trends, performance, etc..."
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
      />

      <button
        onClick={handleSend}
        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        disabled={loading}
      style={{
          marginTop: '0.5rem',
          padding: '0.5rem 1rem',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        {loading ? 'Analyzing...' : 'Ask AI'}
      </button>

      {response && (
        <div className="markdown-container">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {response}
          </ReactMarkdown>
        </div>
      )}

      {/* Sales Trend Chart */}
      {(chartData.salesTrend && chartData.salesTrend.length > 0) && (
        <div className="chart-wrapper">
          <h4>Sales Trend</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Games Chart */}
      {chartData.topGames && chartData.topGames.length > 0 && (
        <div className="chart-wrapper">
          <h4>Top Games by Revenue</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData.topGames}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default AIChatBox;
