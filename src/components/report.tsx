import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AIChatBox from '../components/AIChatBox';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { set } from 'lodash';

interface Transaction {
  id: string;
  username: string;
  phone: string;
  email: string | null;
  discount: number;
  discount_description: string | null;
  reference: string;
  merchantReference: string;
  created_at: string;
}

interface TransactionItem {
  id: string;
  transaction_id: string;
  game_id: string;
  game_title: string;
  game_quantity: number;
  game_duration: number;
}

interface TransactionPayment {
  id: string;
  transaction_id: string;
  payment_method: string;
  amount: number;
}

interface Props {
  isAdmin: boolean;
}

interface CombinedRecord {
  id: string;
  username: string;
  phone: string;
  email: string | null;
  discount: number;
  discount_description: string | null;
  game_id: string;
  game_title: string;
  game_quantity: number;
  game_duration: number;
  payment_methods: string;
  amount: number;
  reference: string;
  merchantReference: string;
  created_at: string;
}

const Report: React.FC = () => {
  const [records, setRecords] = useState<CombinedRecord[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<string>('');
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  // const formattedStart = new Date(startDate).toISOString();
  // const formattedEnd = new Date(endDate + 'T23:59:59').toISOString();

interface InsightData {
  immersia?: {
    summary: string;
    chartData: {
      topGames: any[];
      salesTrend: any[];
    };
  };
  funstation?: {
    summary: string;
    chartData: {
      topGames: any[];
      salesTrend: any[];
    };
  };
  online?: {
    summary: string;
    chartData: {
      topGames: any[];
      salesTrend: any[];
    };
  };
}

interface InsightCardProps {
  title: string;
  data: {
    summary: string;
    totalRevenue: number;
    chartData: { topGames: any[]; salesTrend: any[] };
  };
}

// Add state for insights
const [insights, setAIInsights] = useState<InsightData | null>(null);
const [summary, setSummary] = useState('');
const [topGames, setTopGames] = useState([]);
const [salesTrend, setSalesTrend] = useState([]);
const [totalRevenue, setTotalRevenue] = useState(0);

const InsightCard: React.FC<InsightCardProps> = ({ title, data }) => {
  if (!data) return null;
  const { summary, totalRevenue, chartData } = data;
  const { topGames, salesTrend } = chartData;

  return (
    <div className="p-4 mb-6 bg-white shadow rounded">
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      <p className="mb-2">
        <strong>Total Revenue:</strong> ₦{totalRevenue.toLocaleString()}
      </p>
      {summary && (
        <div className="prose mb-4">
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      )}

      {topGames?.length > 0 && (
        <>
          <h4 className="font-semibold">Top Games</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topGames}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {salesTrend?.length > 0 && (
        <>
          <h4 className="font-semibold mt-4">Sales Trend</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
};


  const [bestSellingGames, setBestSellingGames] = useState<{ game_title: string; game_quantity: number }[]>([]);
  const [leastSellingGames, setLeastSellingGames] = useState<{ game_title: string; game_quantity: number }[]>([]);
  const [highestPayingCustomers, setHighestPayingCustomers] = useState<{ username: string; amount: number }[]>([]);
  const [gameDurationStats, setGameDurationStats] = useState<{ game_title: string; game_duration: number }[]>([]);
  const [endOfDaySummary, setEndOfDaySummary] = useState<CombinedRecord[]>([]);


  useEffect(() => {
    if (startDate && endDate) {
      fetchAllData();
    }
  }, [startDate, endDate]);

  const fetchAllData = async () => {
    try {

      const formattedStart = startDate ? new Date(startDate).toISOString() : '';
      const formattedEnd = endDate ? new Date(endDate + 'T23:59:59').toISOString() : '';
      
      if (!formattedStart || !formattedEnd) return;
      const [transactionsRes, itemsRes, paymentsRes, gamesRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactions`, { params: { startDate: formattedStart, endDate: formattedEnd } }),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactionItems`, { params: { startDate: formattedStart, endDate: formattedEnd } }),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactionPayments`, { params: { startDate: formattedStart, endDate: formattedEnd } }),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/games`),
      ]);

      console.log('itemsRes.data:', itemsRes.data);
      console.log('paymentsRes.data:', paymentsRes.data);
      console.log('transactionsRes.data:', transactionsRes.data);

      const transactions: Transaction[] = transactionsRes.data.data.data || [];
      const transactionItems: TransactionItem[] = itemsRes.data.data.data || [];
      const transactionPayments: TransactionPayment[] = paymentsRes.data.data.data || [];
      const games: { id: string; price: number }[] = gamesRes.data.data || [];

      const gamePriceMap = new Map<string, number>();
    games.forEach(game => {
      gamePriceMap.set(game.id, game.price);
    });

      // Combine the data
      const combined: CombinedRecord[] = [];
      transactions.forEach((txn) => {
        const items = transactionItems.filter((item) => item.transaction_id === txn.id);
        const payments = transactionPayments.filter((p) => p.transaction_id === txn.id);
        const paymentMethods = payments.map((p) => p.payment_method).join(', ');
        const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);

        let totalCost = 0;
      const itemCosts: { item: TransactionItem; cost: number }[] = [];

        items.forEach((item) => {
          const price = gamePriceMap.get(item.game_id) || 0;
        let cost: number;
        if (item.game_title === '360 Video Booth') {
          const regularPrice = price;
          const extraQty = Math.max(0, item.game_quantity - 1);
          cost = regularPrice + extraQty * 1000;
        } else {
          cost = price * item.game_quantity;
        }
        totalCost += cost;
        itemCosts.push({ item, cost });
        
      });

      // Distribute amounts proportionally
      let allocatedAmount = 0;
      itemCosts.forEach((itemCost, index) => {
        let amount = 0;
        if (index === itemCosts.length - 1) {
          // Last item gets the remaining amount after discount
          amount = totalPayment - allocatedAmount - txn.discount;
        } else {
          amount = (itemCost.cost / totalCost) * totalPayment;
          allocatedAmount += amount;
        }

          combined.push({
            id: txn.id,
            username: txn.username,
            phone: txn.phone,
            email: txn.email,
            discount: txn.discount,
            discount_description: txn.discount_description,
            game_id: itemCost.item.game_id,
            game_title: itemCost.item.game_title,
            game_quantity: itemCost.item.game_quantity,
            game_duration: itemCost.item.game_duration,
            payment_methods: paymentMethods,
            amount: parseFloat(amount.toFixed(2)),
            reference: txn.reference,
            merchantReference: txn.merchantReference,
            created_at: txn.created_at,
          });
        });
      });

      setRecords(combined);
      calculateMetrics(combined);
      setEndOfDaySummary(combined);

    } catch (err) {
      console.error('Error fetching data:', err);
      setRecords([]);
      resetMetrics();
    }
  };

  const calculateMetrics = (records: CombinedRecord[]) => {
    // Best/Least Selling Games
    const gameSales = records.reduce((acc, record) => {
      acc[record.game_title] = (acc[record.game_title] || 0) + record.game_quantity;
      return acc;
    }, {} as { [key: string]: number });

    const sortedGames = Object.entries(gameSales).sort((a, b) => b[1] - a[1]);
    setBestSellingGames(sortedGames.map(([title, qty]) => ({ game_title: title, game_quantity: qty })));
    setLeastSellingGames([...sortedGames].reverse().map(([title, qty]) => ({ game_title: title, game_quantity: qty })));

    // Highest Paying Customers
    const customerPayments = records.reduce((acc, record) => {
      const total = Number(record.amount)
      acc[record.username] = (acc[record.username] || 0) + total;
      return acc;
    }, {} as { [key: string]: number });

    const sortedCustomers = Object.entries(customerPayments)
      .sort((a, b) => b[1] - a[1])
      .map(([username, amount]) => ({ username, amount: Number(amount.toFixed(2)) }));
    setHighestPayingCustomers(sortedCustomers);

    // Game Duration Stats
    const gameDurations = records.reduce((acc, record) => {
      acc[record.game_title] = (acc[record.game_title] || 0) + record.game_duration * record.game_quantity;
      return acc;
    }, {} as { [key: string]: number });

    setGameDurationStats(Object.entries(gameDurations).map(([game_title, game_duration]) => ({ game_title, game_duration })));
  };

  const fetchAIInsights = async (range: string, startDate?: string, endDate?: string) => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/ai-insights`, {
    range, startDate, endDate
    });
    console.log('INSIGHTS:', res.data.insights);
    console.log('FULL AI RESPONSE:', res.data)
    setAIInsights({
  immersia: res.data.immersia,
  funstation: res.data.funstation,
  online:   res.data.online
});  // ✅ Store in state
setTotalRevenue(res.data.totalRevenue || 0);
    setSummary(res.data.summary);
    setTopGames(res.data.charts?.topGames || []);
    setSalesTrend(res.data.charts?.salesTrend || []);
  } catch (error) {
    console.error('Error fetching AI insights:', error);

    
  }
};

  const resetMetrics = () => {
    setBestSellingGames([]);
    setLeastSellingGames([]);
    setHighestPayingCustomers([]);
    setGameDurationStats([]);
    setEndOfDaySummary([]);
  }
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, setDate: React.Dispatch<React.SetStateAction<string>>) => {
    const value = e.target.value;
    if (value) {
      setDate(value);
    } else {
      setDate('');
      resetMetrics();
    }
  };

  const exportToExcel = () => {
    const worksheetData = records.map((r) => ({
      'Username': r.username,
      'Phone': r.phone,
      'Email': r.email || 'N/A',
      'Total Amount': r.amount.toFixed(2),
      'Discount': r.discount.toFixed(2),
      'Discount Description': r.discount_description || 'N/A',
      'Reference': r.reference,
      'Merchant Reference': r.merchantReference,
      'Game Title': r.game_title,
      'Quantity': r.game_quantity,
      'Amount': r.amount,
      'Payment Method': r.payment_methods,
      'Date': r.created_at,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Report_${startDate}_to_${endDate}.xlsx`);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('report-table')?.outerHTML;
    if (printContent) {
      const newWindow = window.open('', '_blank');
      newWindow?.document.write('<html><head><title>Report</title></head><body>');
      newWindow?.document.write(printContent);
      newWindow?.document.write('</body></html>');
      newWindow?.document.close();
      newWindow?.print();
    }
  };

  const handleSend = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/ai-insights/prompt`, {
        prompt,
        period: 'custom',
      startDate,
      endDate,
       gameTitle: selectedGame,
       paymentMethod: selectedMethod,
      });
      setResponse(response.data.response || 'No response from AI');
    } catch (error) {
      console.error('Error getting AI response:', error);
      setResponse('Sorry, there was an error processing your request.');
    } finally {
      setLoading(false);
      setPrompt('');
    }
  };

  return (
<div>
  <div>
    <style>
      {`@media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
          }
        }`}
    </style>

    <div className="p-6 mb-6 bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-2">AI Assistant</h2>
      <AIChatBox isAdmin={true} />
      </div>
      <h2>Fetch AI Insights</h2>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => fetchAIInsights('daily')}>Get Daily Insights</button>
        <button onClick={() => fetchAIInsights('weekly')}>Get Weekly Insights</button>
        <button onClick={() => fetchAIInsights('yearly')}>Get Yearly Insights</button>
        <button onClick={() => fetchAIInsights('custom', startDate, endDate)}>Get Custom Insights</button>
      </div>

      {insights && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.immersia && (
                <InsightCard
                  title="Immersia"
                  data={{
                    summary: insights.immersia.summary,
                    totalRevenue: (insights.immersia as any).totalRevenue ?? 0,
                    chartData: insights.immersia.chartData,
                  }}
                />
              )}
              {insights.funstation && (
                <InsightCard
                  title="Funstation"
                  data={{
                    summary: insights.funstation.summary,
                    totalRevenue: (insights.funstation as any).totalRevenue ?? 0,
                    chartData: insights.funstation.chartData,
                  }}
                />
              )}
              {insights.online && (
                <InsightCard
                  title="Online"
                  data={{
                    summary: insights.online.summary,
                    totalRevenue: (insights.online as any).totalRevenue ?? 0,
                    chartData: insights.online.chartData,
                  }}
                />
              )}
            </div>
          )}
            </div>
    <div id="print-area">
        <h1>Reports</h1>
        <h2>End of Day Sales Summary</h2>
        {insights && (
    <div>
    </div>
  )}
  <table border={1}>
    <thead>
      <tr>
        <th>Username</th>
        <th>Phone</th>
        <th>Email</th>
        <th>Total Amount</th>
        <th>Discount</th>
        <th>Discount Description</th>
        <th>Game Title</th>
        <th>Game Quantity</th>
        <th>Reference</th>
        <th>Merchant Reference</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      {endOfDaySummary.length > 0 ? (
        endOfDaySummary.map((record, index) => (
          <tr key={index}>
            <td>{record.username}</td>
            <td>{record.phone}</td>
            <td>{record.email}</td>
            <td>{record.amount}</td>
            <td>{record.discount}</td>
            <td>{record.discount_description}</td>
            <td>{record.game_title}</td>
            <td>{record.game_quantity}</td>
            <td>{record.reference}</td>
            <td>{record.merchantReference}</td>
            <td>{new Date(record.created_at).toLocaleString()}</td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={11}>No records found</td>
        </tr>
      )}
    </tbody>
  </table>
        <h2>Select Date Range</h2>
        <div>
          <label>
            Start Date:
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            End Date:
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>

        <h2>Best Selling Games</h2>
        <table border={1}>
          <thead>
            <tr>
              <th>Game Title</th>
              <th>Total Quantity Sold</th>
            </tr>
          </thead>
          <tbody>
            {bestSellingGames.length > 0 ? (
              bestSellingGames.map((game, index) => (
                <tr key={index}>
                  <td>{game.game_title}</td>
                  <td>{game.game_quantity}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2}>No records found</td>
              </tr>
            )}
          </tbody>
        </table>

        <h2>Least Selling Games</h2>
        <table border={1}>
          <thead>
            <tr>
              <th>Game Title</th>
              <th>Total Quantity Sold</th>
            </tr>
          </thead>
          <tbody>
            {leastSellingGames.length > 0 ? (
              leastSellingGames.map((game, index) => (
                <tr key={index}>
                  <td>{game.game_title}</td>
                  <td>{game.game_quantity}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2}>No records found</td>
              </tr>
            )}
          </tbody>
        </table>

        <h2>Highest Paying Customers</h2>
        <table border={1}>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Total Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            {highestPayingCustomers.length > 0 ? (
              highestPayingCustomers.map((customer, index) => (
                <tr key={index}>
                  <td>{customer.username}</td>
                  <td>{customer.amount}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2}>No records found</td>
              </tr>
            )}
          </tbody>
        </table>

        <h2>Total Duration of Games Played</h2>
        <table border={1}>
          <thead>
            <tr>
              <th>Game Title</th>
              <th>Total Duration Played (Minutes)</th>
            </tr>
          </thead>
          <tbody>
            {gameDurationStats.length > 0 ? (
              gameDurationStats.map((record, index) => (
                <tr key={index}>
                  <td>{record.game_title}</td>
                  <td>{record.game_duration}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2}>No records found</td>
              </tr>
            )}
          </tbody>
        </table>

        <h2>Transaction Records</h2>
        <table id="report-table" border={1}>
          <thead>
            <tr>
              <th>Game Duration (Minutes)</th>
              <th>Title</th>
              <th>Quantity</th>
              <th>Total Amount</th>
              <th>Payment Method</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {records.length > 0 ? (
              records.map((record) => (
                <tr key={record.id}>
                  <td>{(parseFloat(record.game_duration.toString()) * record.game_quantity).toFixed(2)}</td>
                  <td>{record.game_title}</td>
                  <td>{record.game_quantity}</td>
                  <td>{((Number(record.amount) || 0) || 0).toFixed(2)}</td>
                  <td>{record.payment_methods}</td>
                  <td>{new Date(record.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No records found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div>
        {/* <textarea
          className="w-full border p-2 rounded"
          rows={4}
          placeholder="Ask AI a question about the reports..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
        >
          {loading ? 'Loading...' : 'Ask AI'}
        </button>
        {response && (
          <div className="mt-4 p-3 border bg-gray-100 rounded">
            <strong>Response:</strong>
            <p className="whitespace-pre-wrap">{response}</p>
            <ReactMarkdown>{response}</ReactMarkdown>
          </div> */}
        {/* )} */}
      <button onClick={exportToExcel}>Export to Excel</button>
      <button onClick={handlePrint}>Print Report</button>
    </div>
  </div>
  );
};

export default Report;
