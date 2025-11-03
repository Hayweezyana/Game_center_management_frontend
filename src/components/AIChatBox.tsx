import React, { useRef, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

  // Ref to the whole card we want to export
  const exportRef = useRef<HTMLDivElement>(null);

  if (!isAdmin) return null;

  const handleSend = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/ai-insights/prompt`,
        {
          prompt,
          period: 'custom',
          startDate,
          endDate,
          gameTitle,
          paymentMethod,
        }
      );
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

  const exportToPDF = async () => {
    const node = exportRef.current;
    if (!node) return;

    // Make charts/markdown fully visible before snapshot
    // (Recharts inside ResponsiveContainer is OK with html2canvas)
    const scale = 2; // higher = sharper
    const canvas = await html2canvas(node, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      // You can add ignoreElements if there are controls you don’t want captured
      ignoreElements: (el) => el.classList?.contains('no-print'),

    });

    const imgData = canvas.toDataURL('image/png');

    // A4 dimensions in pt (jsPDF default is pts): 595.28 x 841.89
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Rendered canvas dimensions
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // Extra pages if content is taller than one page
    while (heightLeft > 0) {
      pdf.addPage();
      position = - (imgHeight - heightLeft);
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    const fileName = `AI_Insights_${startDate || 'start'}_${endDate || 'end'}.pdf`;
    pdf.save(fileName);
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-lg">AI Assistant (Admin Only)</h2>
      </div>

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

        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSend}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Analyzing...' : 'Ask AI'}
          </button>
          {/* Add a class like 'no-print' if you want this hidden in exports */}
          <button
            onClick={() => {
              setPrompt('');
              setResponse('');
              setChartData({});
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded no-print"
          >
            Clear
          </button>
          <button
          onClick={exportToPDF}
          className="px-3 py-1.5 rounded bg-black text-white"
          title="Export card to PDF"
        >
          Export PDF
        </button>
        </div>

        {/* Wrap exportable content in this card */}
      <div ref={exportRef} className="p-4 border rounded-lg bg-white shadow">
        {response && (
          <div className="markdown-container mt-4 prose max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {response}
            </ReactMarkdown>
          </div>
        )}

        {/* Sales Trend Chart */}
        {(chartData.salesTrend && chartData.salesTrend.length > 0) && (
          <div className="chart-wrapper mt-6">
            <h4 className="font-medium mb-2">Sales Trend</h4>
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
          <div className="chart-wrapper mt-6">
            <h4 className="font-medium mb-2">Top Games by Revenue</h4>
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
    </div>
  );
};

export default AIChatBox;
