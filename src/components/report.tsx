import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface Transaction {
  id: string;
  username: string;
  phone: string;
  discount: number;
  discount_description: string | null;
  created_at: string;
}

interface TransactionItem {
  id: string;
  transaction_id: string;
  game_id: string;
  game_title: string;
  game_quantity: number;
  game_duration: number;
  amount: number;
}

interface TransactionPayment {
  id: string;
  transaction_id: string;
  payment_method: string;
  amount: number;
}

interface CombinedRecord {
  id: string;
  username: string;
  phone: string;
  discount: number;
  discount_description: string | null;
  game_id: string;
  game_title: string;
  game_quantity: number;
  game_duration: number;
  amount: number;
  payment_methods: string;
  created_at: string;
}

const Report: React.FC = () => {
  const [records, setRecords] = useState<CombinedRecord[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Metrics state (same as your existing metrics)
  const [bestSellingGames, setBestSellingGames] = useState<{ game_title: string; game_quantity: number }[]>([]);
  const [leastSellingGames, setLeastSellingGames] = useState<{ game_title: string; game_quantity: number }[]>([]);
  const [highestPayingCustomers, setHighestPayingCustomers] = useState<{ username: string; amount: number }[]>([]);
  const [gameDurationStats, setGameDurationStats] = useState<{ game_title: string; game_duration: number }[]>([]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchAllData();
    }
  }, [startDate, endDate]);

  const fetchAllData = async () => {
    try {
      const [transactionsRes, itemsRes, paymentsRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactions`, { params: { startDate, endDate } }),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactionItems`, { params: { startDate, endDate } }),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactionPayments`, { params: { startDate, endDate } }),
      ]);

      console.log('itemsRes.data:', itemsRes.data);
      console.log('paymentsRes.data:', paymentsRes.data);
      console.log('transactionsRes.data:', transactionsRes.data);

      const transactions: Transaction[] = transactionsRes.data.data.data || [];
      const transactionItems: TransactionItem[] = itemsRes.data.data.data || [];
      const transactionPayments: TransactionPayment[] = paymentsRes.data.data.data || [];

      // Combine the data
      const combined: CombinedRecord[] = [];
      transactions.forEach((txn) => {
        const items = transactionItems.filter((item) => item.transaction_id === txn.id);
        const payments = transactionPayments.filter((p) => p.transaction_id === txn.id);
        const paymentMethods = payments.map((p) => p.payment_method).join(', ');

        items.forEach((item) => {
          combined.push({
            id: txn.id,
            username: txn.username,
            phone: txn.phone,
            discount: txn.discount,
            discount_description: txn.discount_description,
            game_id: item.game_id,
            game_title: item.game_title,
            game_quantity: item.game_quantity,
            game_duration: item.game_duration,
            amount: item.amount,
            payment_methods: paymentMethods,
            created_at: txn.created_at,
          });
        });
      });

      setRecords(combined);
      calculateMetrics(combined);
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
      const total = Number(record.amount) * record.game_quantity;
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

  const resetMetrics = () => {
    setBestSellingGames([]);
    setLeastSellingGames([]);
    setHighestPayingCustomers([]);
    setGameDurationStats([]);
  };

  const exportToExcel = () => {
    const worksheetData = records.map((r) => ({
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

  return (
    <div>
      <h1>Reports</h1>
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
                <td>{(Number(record.amount) * record.game_quantity).toFixed(2)}</td>
                <td>{record.payment_methods}</td>
                <td>{record.created_at}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6}>No records found</td>
            </tr>
          )}
        </tbody>
      </table>

      <button onClick={exportToExcel}>Export to Excel</button>
      <button onClick={handlePrint}>Print Report</button>
    </div>
  );
};

export default Report;