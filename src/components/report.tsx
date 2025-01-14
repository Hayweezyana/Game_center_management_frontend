import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';

interface Record {
  id: number;
  title: string;
  quantity: number;
  totalAmount: number;
  totalDuration: number;
  customerName: string;
  date: string;
}

const Report: React.FC = () => {
  const [records, setRecords] = useState<Record[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bestSellingGames, setBestSellingGames] = useState<Record[]>([]);
  const [leastSellingGames, setLeastSellingGames] = useState<Record[]>([]);
  const [highestPayingCustomers, setHighestPayingCustomers] = useState<Record[]>([]);
  const [gameDurationStats, setGameDurationStats] = useState<Record[]>([]);

  useEffect(() => {
    // Fetch reports data based on date range
    if (startDate && endDate) {
      axios
        .get(`${process.env.REACT_APP_BACKEND_URL}/v1/report/summary`, {
          params: { startDate, endDate },
        })
        .then((response) => {
          const data = response.data as {
            bestSellingGames: Record[];
            leastSellingGames: Record[];
            highestPayingCustomers: Record[];
            gameDurationStats: Record[];
          };
          setBestSellingGames(data.bestSellingGames);
          setLeastSellingGames(data.leastSellingGames);
          setHighestPayingCustomers(data.highestPayingCustomers);
          setGameDurationStats(data.gameDurationStats);
        })
        .catch((error) => console.error('Error fetching report summary:', error));

      axios
        .get(`${process.env.REACT_APP_BACKEND_URL}/v1/transaction`, {
          params: { startDate, endDate },
        })
        .then((response) => setRecords(response.data as Record[]))
        .catch((error) => console.error('Error fetching transaction records:', error));
    }
  }, [startDate, endDate]);

  const exportToExcel = () => {
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/v1/report/export`, {
        params: { startDate, endDate },
        responseType: 'blob',
      })
      .then((response) => {
        const blob = new Blob([response.data as BlobPart], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        saveAs(blob, `Report_${startDate}_to_${endDate}.xlsx`);
      })
      .catch((error) => console.error('Error exporting records:', error));
  };

  const handlePrint = () => {
    const printContent = document.getElementById('report-table')!.outerHTML;
    const newWindow = window.open('', '_blank');
    newWindow?.document.write('<html><head><title>Report</title></head><body>');
    newWindow?.document.write(printContent);
    newWindow?.document.write('</body></html>');
    newWindow?.document.close();
    newWindow?.print();
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
          {bestSellingGames.map((game) => (
            <tr key={game.id}>
              <td>{game.title}</td>
              <td>{game.quantity}</td>
            </tr>
          ))}
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
          {leastSellingGames.map((game) => (
            <tr key={game.id}>
              <td>{game.title}</td>
              <td>{game.quantity}</td>
            </tr>
          ))}
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
          {highestPayingCustomers.map((customer) => (
            <tr key={customer.id}>
              <td>{customer.customerName}</td>
              <td>{customer.totalAmount}</td>
            </tr>
          ))}
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
          {gameDurationStats.map((game) => (
            <tr key={game.id}>
              <td>{game.title}</td>
              <td>{game.totalDuration}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Transaction Records</h2>
      <table id="report-table" border={1}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Quantity</th>
            <th>Total Amount</th>
            <th>Customer</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.id}</td>
              <td>{record.title}</td>
              <td>{record.quantity}</td>
              <td>{record.totalAmount}</td>
              <td>{record.customerName}</td>
              <td>{record.date}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={exportToExcel}>Export to Excel</button>
      <button onClick={handlePrint}>Print Report</button>
    </div>
  );
};

export default Report;
