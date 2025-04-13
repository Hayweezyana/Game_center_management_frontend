import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface Record {
  id: string;
  amount: string;
  username: string; // Ensure this is included
  game_id: string;
  game_quantity: number;
  game_title: string;
  game_duration: number;
  userId: string;
  payment_method: string;
  createdAt: string;
}

interface GameDurationStat {
  game_title: string;
  game_duration: number;
}

interface HighestPayingCustomers {
  username: string;
  amount: string;
}

interface LeastSellingGames {
  game_title: string;
  game_quantity: number;
}

interface BestSellingGames {
  game_title: string;
  game_quantity: number;
}

const Report: React.FC = () => {
  const [records, setRecords] = useState<Record[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bestSellingGames, setBestSellingGames] = useState<BestSellingGames[]>([]);
  const [leastSellingGames, setLeastSellingGames] = useState<LeastSellingGames[]>([]);
  const [highestPayingCustomers, setHighestPayingCustomers] = useState<HighestPayingCustomers[]>([]);
  const [gameDurationStats, setGameDurationStats] = useState<GameDurationStat[]>([]);

  useEffect(() => {
    if (startDate && endDate) {
      axios
        .get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/transactions`, {
          params: { startDate, endDate },
        })
        .then((response) => {
          console.log("API Response:", response.data);

          interface ResponseData {
            status: boolean;
            data: Record[];
          }

          const responseData = response.data as ResponseData;

          if (responseData.status && Array.isArray(responseData.data)) {
            console.log("Fetched Records:", responseData.data); // Debug fetched records
            setRecords(responseData.data);

            // Calculate metrics from the fetched records
            calculateMetrics(responseData.data);
          } else {
            setRecords([]);
            resetMetrics();
          }
        })
        .catch((error) => {
          console.error('Error fetching report summary:', error);
          setRecords([]);
          resetMetrics();
        });
    }
  }, [startDate, endDate]);

  const calculateMetrics = (records: Record[]) => {
    // Calculate Best Selling Games
    const gameSales = records.reduce((acc, record) => {
      if (!acc[record.game_title]) {
        acc[record.game_title] = 0;
      }
      acc[record.game_title] += record.game_quantity;
      return acc;
    }, {} as { [key: string]: number });

    const sortedBestSellingGames = Object.entries(gameSales)
      .sort((a, b) => b[1] - a[1])
      .map(([game_title, game_quantity]) => ({
        game_title,
        game_quantity,
      }));

    setBestSellingGames(sortedBestSellingGames);

    // Calculate Least Selling Games
    const sortedLeastSellingGames = Object.entries(gameSales)
      .sort((a, b) => a[1] - b[1])
      .map(([game_title, game_quantity]) => ({
        game_title,
        game_quantity,
      }));

    setLeastSellingGames(sortedLeastSellingGames);

    // Calculate Highest Paying Customers
    const customerPayments = records.reduce((acc, record) => {
      if (!acc[record.userId]) {
        acc[record.userId] = { username: record.username || "Unknown", amount: 0 }; // Provide a default value for username
      }
      acc[record.userId].amount += parseFloat(record.amount) * record.game_quantity;
      return acc;
    }, {} as { [key: string]: { username: string; amount: number } });

    const sortedHighestPayingCustomers = Object.entries(customerPayments)
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([userId, { username, amount }]) => ({
        username,
        amount: amount.toFixed(2),
      }));

    setHighestPayingCustomers(sortedHighestPayingCustomers);

    // Calculate Total Duration of Games Played
    const gameDurations = records.reduce((acc, record) => {
      if (!acc[record.game_title]) {
        acc[record.game_title] = 0;
      }
      acc[record.game_title] += record.game_duration * record.game_quantity;
      return acc;
    }, {} as { [key: string]: number });

    const sortedGameDurationStats: GameDurationStat[] = Object.entries(gameDurations).map(([game_title, game_duration]) => ({
      game_title,
      game_duration,
    }));

    setGameDurationStats(sortedGameDurationStats);
  };

  const resetMetrics = () => {
    setBestSellingGames([]);
    setLeastSellingGames([]);
    setHighestPayingCustomers([]);
    setGameDurationStats([]);
  };

  const exportToExcel = () => {
    // Prepare the data for the Excel file
    const worksheetData = records.map((record) => ({
      'Game Title': record.game_title,
      'Quantity Sold': record.game_quantity,
      'Amount': record.amount,
      'Payment Method': record.payment_method,
      'Date': record.createdAt,
    }));

    // Create a worksheet
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);

    // Create a workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Save the file
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
                <td>{(parseFloat(record.amount) * record.game_quantity).toFixed(2)}</td>
                <td>{record.payment_method}</td>
                <td>{record.createdAt}</td>
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