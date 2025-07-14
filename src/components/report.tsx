import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import AIChatBox from '../components/AIChatBox';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

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

interface TransactionDrinks {
  drink_id: string;
  drink_title: string;
  drink_price: number;
  drink_quantity: number;
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
  drink_price: number;
  drink_id: string;
  drink_title: string;
  drink_quantity: number;
  payment_methods: string;
  amount: number;
  reference: string;
  merchantReference: string;
  created_at: string;
}

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

const Report: React.FC = () => {
  // State for data
  const [records, setRecords] = useState<CombinedRecord[]>([]);
  const [bestSellingGames, setBestSellingGames] = useState<{ game_title: string; game_quantity: number }[]>([]);
  const [leastSellingGames, setLeastSellingGames] = useState<{ game_title: string; game_quantity: number }[]>([]);
  const [highestPayingCustomers, setHighestPayingCustomers] = useState<{ username: string; amount: number }[]>([]);
  const [gameDurationStats, setGameDurationStats] = useState<{ game_title: string; game_duration: number }[]>([]);
  const [endOfDaySummary, setEndOfDaySummary] = useState<CombinedRecord[]>([]);
  
  // State for filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  
  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // State for loading and AI
  const [loading, setLoading] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [insights, setAIInsights] = useState<InsightData | null>(null);
  const [summary, setSummary] = useState('');
  const [topGames, setTopGames] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const [totalSales, setTotalSales] = useState(0);


  // Format date for API queries
  const formatDateForQuery = (dateString: string, endOfDay = false) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
    console.error('Invalid date:', dateString);
    return '';
  }
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    return date.toISOString();
  };

  const parseDateWithoutTimezone = (dateString: string) => {
  const parts = dateString.split('-');
  return new Date(
    parseInt(parts[0]), // year
    parseInt(parts[1]) - 1, // month (0-indexed)
    parseInt(parts[2]) // day
  );
};

      const formattedStart = formatDateForQuery(startDate, false);
const formattedEnd = formatDateForQuery(endDate, true);

      const fetchAllData = async () => {
  if (!startDate || !endDate) return;

  setIsFetching(true);
  try {
    const formattedStart = formatDateForQuery(startDate, false);
    const formattedEnd = formatDateForQuery(endDate, true);

    console.log('Fetching with dates:', {
      startDate,
      endDate,
      formattedStart,
      formattedEnd,
      payment_method: selectedMethod,
    });

    console.log("Selected Method (Frontend):", selectedMethod);


    const requests = [
      axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactions`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
          page: currentPage,
          limit: itemsPerPage,
          ...(selectedMethod !== 'all' && { payment_method: selectedMethod }),
        },
        timeout: 30000,
      }),
      axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactionItems`, {
        params: { startDate: formattedStart, endDate: formattedEnd },
        timeout: 30000,
      }),
      axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactionPayments`, {
        params: { startDate: formattedStart, endDate: formattedEnd },
        timeout: 30000,
      }),
      axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactionDrinks`, {
        params: { startDate: formattedStart, endDate: formattedEnd },
        timeout: 30000,
      }),
      axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/games`),
    ];

    const responses = await Promise.allSettled(requests);

      const [transactionsRes, itemsRes, paymentsRes, drinksRes, gamesRes] = responses.map(res => {
      if (res.status === 'rejected') {
        console.error('API request failed:', res.reason);
        return { data: { data: [] } }; // Return empty data structure
      }
      return res.value;
    });

      setTotalRecords(transactionsRes.data.pagination?.total || 0);

      const transactions: Transaction[] = transactionsRes.data.data?.data || [];
      const transactionItems: TransactionItem[] = itemsRes.data.data?.data || [];
      const transactionPayments: TransactionPayment[] = paymentsRes.data.data?.data || [];
      console.log("All payments:", transactionPayments);

      const transactionDrinks: TransactionDrinks[] = drinksRes.data.data?.data || [];
      const games: { id: string; price: number }[] = gamesRes.data.data || [];

      const gamePriceMap = new Map<string, number>();
      games.forEach(game => {
        gamePriceMap.set(game.id, game.price);
      });

      // Combine the data
      const combined: CombinedRecord[] = [];
      transactions.forEach((txn) => {
        const drinksItems = transactionDrinks.filter(drink => (drink as any).drinks_id === txn.id);
        const gameItems = transactionItems.filter((item) => item.transaction_id === txn.id);
        const payments = transactionPayments.filter((p) => p.transaction_id === txn.id);

        const paymentMethods = payments.map((p) => p.payment_method).join(', ');
        const rawTotalPayment = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalPayment = Math.max(0, rawTotalPayment - (txn.discount || 0));
        const totalSalesFromCombined = combined.reduce((sum, record) => sum + record.amount, 0);setTotalSales(totalSalesFromCombined);




        console.log("Game Price Map:", gamePriceMap);

        let totalGameCost = 0;
        const itemCosts: { item: TransactionItem; cost: number }[] = [];

        gameItems.forEach((item) => {
          console.log("Current item ID:", item.game_id);
          console.log('Transaction:', txn.username, txn.id);
          console.log('Payments:', payments);
          console.log('Items:', gameItems);
          console.log('Total Payment:', totalPayment);

          const price = gamePriceMap.get(item.game_id) || 0;
          let cost: number;
          if (item.game_title === '360 Video Booth') {
            const regularPrice = price;
            const extraQty = Math.max(0, item.game_quantity - 1);
            cost = regularPrice + extraQty * 1000;
          } else {
            cost = price * item.game_quantity;
          }
          totalGameCost += cost;
          itemCosts.push({ item, cost });
        });

        itemCosts.forEach(({ item, cost }) => {
    const shareRatio = cost / totalGameCost;
  const amount = totalPayment * shareRatio;

          combined.push({
            id: txn.id,
            username: txn.username,
            phone: txn.phone,
            email: txn.email,
            discount: txn.discount,
            discount_description: txn.discount_description,
            game_id: item.game_id,
            game_title: item.game_title,
            game_quantity: item.game_quantity,
            game_duration: item.game_duration,
            drink_id: '',
            drink_price: 0,
            drink_quantity: 0,
            drink_title: '',
            payment_methods: paymentMethods,
            amount: parseFloat(amount.toFixed(2)),
            reference: txn.reference,
            merchantReference: txn.merchantReference,
            created_at: txn.created_at,
          });
        });

      drinksItems.forEach(drink => {
         console.log('Transaction:', txn.username, txn.id);
          console.log('Payments:', payments);
          console.log('Items:', drinksItems);
          console.log('Total Payment:', totalPayment);
    combined.push({
      id: txn.id,
      username: txn.username,
      phone: txn.phone,
      email: txn.email,
      discount: txn.discount,
      discount_description: txn.discount_description,
      game_id: '',
      game_title: '',
      game_quantity: 0,
      game_duration: 0,
      drink_id: drink.drink_id,
      drink_price: drink.drink_price,
      drink_quantity: drink.drink_quantity,
      drink_title: drink.drink_title,
      payment_methods: paymentMethods,
      amount: parseFloat((drink.drink_price * drink.drink_quantity).toFixed(2)),
      reference: txn.reference,
      merchantReference: txn.merchantReference,
      created_at: txn.created_at,
    });
  });
});

      setRecords(combined);
      setEndOfDaySummary(combined);
      calculateMetrics(combined);

    } catch (err) {
      console.error('Error fetching data:', err);
      setRecords([]);
      resetMetrics();
    } finally {
      setIsFetching(false);
    }
  };

  // Calculate metrics from records
  const calculateMetrics = (records: CombinedRecord[]) => {
    // Best/Least Selling Games
    const gameSales = records.reduce((acc, record) => {
      acc[record.game_title] = (acc[record.game_title] || 0) + record.game_quantity;
      return acc;
    }, {} as { [key: string]: number });

    const chartData = Object.entries(gameSales).map(([title, quantity]) => ({
  name: title,
  quantity,
}));

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

  // Reset metrics when filters change
  const resetMetrics = () => {
    setBestSellingGames([]);
    setLeastSellingGames([]);
    setHighestPayingCustomers([]);
    setGameDurationStats([]);
    setEndOfDaySummary([]);
  }

  // Fetch AI insights
  const fetchAIInsights = async (range: string, startDate?: string, endDate?: string) => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/ai-insights`, {
        range, startDate, endDate
      });
      setAIInsights({
        immersia: res.data.immersia,
        funstation: res.data.funstation,
        online: res.data.online
      });
      setTotalRevenue(res.data.totalRevenue || 0);
      setSummary(res.data.summary);
      setTopGames(res.data.charts?.topGames || []);
      setSalesTrend(res.data.charts?.salesTrend || []);
    } catch (error) {
      console.error('Error fetching AI insights:', error);
    }
  };

  // Export to Excel
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

  // Handle print
  const handlePrint = () => {
    const printContent = document.getElementById('report-table')?.outerHTML;
    if (printContent) {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write('<html><head><title>Report</title></head><body>');
        newWindow.document.write(printContent);
        newWindow.document.write('</body></html>');
        newWindow.document.close();
        newWindow.print();
      }
    }
  };

  // Handle AI prompt submission
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

  // Pagination controls component
  const PaginationControls = () => {
    const totalPages = Math.ceil(totalRecords / itemsPerPage);

    return (
      <div className="flex items-center justify-between mt-4">
        <div>
          <span className="text-sm text-gray-700">
            Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
            <span className="font-medium">
              {Math.min(currentPage * itemsPerPage, totalRecords)}
            </span>{' '}
            of <span className="font-medium">{totalRecords}</span> results
          </span>
        </div>
        
        <div className="flex space-x-2">
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border rounded px-2 py-1 text-sm"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                Show {size}
              </option>
            ))}
          </select>

          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>

          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`px-3 py-1 border rounded ${
                  currentPage === pageNum ? 'bg-blue-500 text-white' : ''
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          {totalPages > 5 && currentPage < totalPages - 2 && (
            <span className="px-2 py-1">...</span>
          )}

          {totalPages > 5 && currentPage < totalPages - 2 && (
            <button
              onClick={() => setCurrentPage(totalPages)}
              className="px-3 py-1 border rounded"
            >
              {totalPages}
            </button>
          )}

          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  // Insight card component
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

  // Fetch data when filters or pagination changes
  useEffect(() => {
    const fetchData = setTimeout(() => {
      if (startDate && endDate) {
        fetchAllData();
      }
    }, 300);
    
    return () => clearTimeout(fetchData);
  }, [startDate, endDate, currentPage, itemsPerPage]);

useEffect(() => {
  if (selectedMethod !== null) {
    fetchAllData();
  }
}, [selectedMethod]);

  const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);

const [salesPerMethod, setSalesPerMethod] = useState<Record<string, number>>({});

useEffect(() => {
  const salesByMethod = new Map<string, number>();
  records.forEach((record) => {
    const methods = record.payment_methods?.split(',') || ['Unknown'];
    methods.forEach((method) => {
      const key = method.trim() || 'Unknown';
      const current = salesByMethod.get(key) || 0;
      salesByMethod.set(key, current + record.amount);
    });
  });
  setSalesPerMethod(Object.fromEntries(salesByMethod));
}, [records]);
useEffect(() => {
  const totalSales = Object.values(salesPerMethod).reduce((sum, value) => sum + value, 0);
  setTotalSales(totalSales);
}, [salesPerMethod]);

const GameSalesChart = ({ data }: { data: { name: string; totalSales: number }[] }) => (
  <div style={{ width: '100%', height: 300 }}>
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" interval={0} angle={-45} textAnchor="end" height={100} />
        <YAxis />
        <Tooltip formatter={(value: number) => `₦${value.toLocaleString()}`} />
        <Bar dataKey="totalSales" fill="#82ca9d" />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

  return (
    <div className="p-4">
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

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Sales Reports</h1>
        
        {/* Date Range Selector */}
        <div className="bg-white p-4 rounded shadow mb-6">
          <h2 className="text-xl font-semibold mb-3">Select Date Range</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
<input
  type="date"
  value={endDate}
  onChange={(e) => {
    setEndDate(e.target.value);
    setCurrentPage(1);
  }}
  className="w-full p-2 border rounded"
/>
<select
  value={selectedMethod}
  onChange={(e) => setSelectedMethod(e.target.value)}
  className="w-full p-2 border rounded mt-2"
>
  <option value="all">All</option>
  <option value="Funstation_Moniepoint">Funstation_Moniepoint</option>
  <option value="Paystack">Paystack</option>
  <option value="Immersia_Moniepoint">Immersia_Moniepoint</option>
</select>
            </div>
          </div>
        </div>

        {/* AI Assistant Section */}
        <div className="p-6 mb-6 bg-white shadow rounded">
          <h2 className="text-xl font-bold mb-2">AI Assistant</h2>
          <AIChatBox isAdmin={true} />
        </div>

        {/* AI Insights Section */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Fetch AI Insights</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <button 
              onClick={() => fetchAIInsights('daily')}
              className="px-4 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
            >
              Get Daily Insights
            </button>
            <button 
              onClick={() => fetchAIInsights('weekly')}
              className="px-4 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
            >
              Get Weekly Insights
            </button>
            <button 
              onClick={() => fetchAIInsights('monthly')}
              className="px-4 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
            >
              Get Monthly Insights
            </button>
            <button 
              onClick={() => fetchAIInsights('yearly')}
              className="px-4 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
            >
              Get Yearly Insights
            </button>
            <button 
              onClick={() => fetchAIInsights('custom', startDate, endDate)}
              disabled={!startDate || !endDate}
              className="px-4 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50"
            >
              Get Custom Insights
            </button>
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

        {/* Loading Indicator */}
        {isFetching && (
          <div className="flex justify-center my-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Reports Section */}
        <div id="print-area" className="space-y-6">
          {/* End of Day Summary */}
          <div className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">End of Day Sales Summary</h2>
              <div className="flex gap-2">
                <button 
                  onClick={exportToExcel}
                  className="px-3 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
                >
                  Export to Excel
                </button>
                <button 
                  onClick={handlePrint}
                  className="px-3 py-1 bg-purple-100 text-purple-800 rounded hover:bg-purple-200"
                >
                  Print Report
                </button>
              </div>
            </div>

            <p>Total Sales: {formatCurrency(totalSales)}</p>

            <h4>Total Sales by Payment Method</h4>
            <ul>
              {Object.entries(salesPerMethod).map(([method, amount]) => (
                <li key={method}>
                  {method}: {formatCurrency(amount)}
                  </li>
                ))}
                </ul>


            
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {endOfDaySummary.length > 0 ? (
                    endOfDaySummary.map((record, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 whitespace-nowrap">{record.username}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{record.phone}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{record.email || 'N/A'}</td>
                        <td className="px-4 py-2 whitespace-nowrap">₦{record.amount.toFixed(2)}</td>
                        <td className="px-4 py-2 whitespace-nowrap">₦{record.discount.toFixed(2)}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{record.game_title}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{record.game_quantity}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{new Date(record.created_at).toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                        {startDate && endDate ? 'No records found for selected date range' : 'Please select a date range'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metrics Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Best Selling Games */}
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-xl font-semibold mb-3">Best Selling Games</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game Title</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity Sold</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                      {bestSellingGames.length > 0 ? (
                        bestSellingGames.map((game, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 whitespace-nowrap">{game.game_title}</td>
                            <td className="px-4 py-2 whitespace-nowrap">{game.game_quantity}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="px-4 py-4 text-center text-gray-500">
                            No data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {/* Chart for Best Selling Games */}
                  <GameSalesChart
                    data={bestSellingGames.map(game => ({
                      name: game.game_title,
                      totalSales: game.game_quantity,
                    }))}
                  />
                </div>
            </div>

            {/* Least Selling Games */}
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-xl font-semibold mb-3">Least Selling Games</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game Title</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity Sold</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leastSellingGames.length > 0 ? (
                      leastSellingGames.map((game, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 whitespace-nowrap">{game.game_title}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{game.game_quantity}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-4 py-4 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Highest Paying Customers */}
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-xl font-semibold mb-3">Highest Paying Customers</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {highestPayingCustomers.length > 0 ? (
                      highestPayingCustomers.map((customer, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 whitespace-nowrap">{customer.username}</td>
                          <td className="px-4 py-2 whitespace-nowrap">₦{customer.amount.toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-4 py-4 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Game Duration Stats */}
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-xl font-semibold mb-3">Game Duration Stats</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game Title</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Minutes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {gameDurationStats.length > 0 ? (
                      gameDurationStats.map((record, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 whitespace-nowrap">{record.game_title}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{record.game_duration}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-4 py-4 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detailed Transaction Records */}
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-semibold mb-3">Detailed Transaction Records</h2>
            <div className="overflow-x-auto">
              <table id="report-table" className="min-w-full border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {records.length > 0 ? (
                    records.map((record) => (
                      <tr key={`${record.id}-${record.game_id ?? ''}-${record.drink_id ?? ''}`}>
                        <td className="px-4 py-2 whitespace-nowrap">{record.username}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{record.game_title}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{(record.game_duration * record.game_quantity).toFixed(0)} mins</td>
                        <td className="px-4 py-2 whitespace-nowrap">{record.game_quantity}</td>
                        <td className="px-4 py-2 whitespace-nowrap">₦{record.amount.toFixed(2)}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{record.payment_methods}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{new Date(record.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-center text-gray-500">
                        {startDate && endDate ? 'No records found for selected date range' : 'Please select a date range'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {records.length > 0 && <PaginationControls />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Report;