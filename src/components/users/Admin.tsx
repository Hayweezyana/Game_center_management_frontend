import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import { useNavigate } from 'react-router-dom';
import './Admin.css';
import { io, Socket } from 'socket.io-client';

interface Record {
    id: number;
    title: string;
    quantity: number;
    totalAmount: number;
    totalDuration: number;
    customerName: string;
    date: string;
}

interface Game {
    id: number;
    title: string;
    price: number;
    url: string;
    time_slot: number;
}

const Admin: React.FC = () => {
    const navigate = useNavigate();
    const [games, setGames] = useState<Game[]>([]); // Ensure the initial state is an array
    const [updatedDurations, setUpdatedDurations] = useState<{ [key: number]: string }>({});
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [records, setRecords] = useState<Record[]>([]);
    const [bestSellingGames, setBestSellingGames] = useState<Record[]>([]);
    const [leastSellingGames, setLeastSellingGames] = useState<Record[]>([]);
    const [highestPayingCustomers, setHighestPayingCustomers] = useState<Record[]>([]);
    const [gameDurationStats, setGameDurationStats] = useState<Record[]>([]);
    const [newUser, setNewUser] = useState({email: '', phone: '', role: '' });
    const [userRoles, setUserRoles] = useState<string[]>(['admin', 'customer']); // Predefined roles
    const socket: Socket = io("ws://127.0.0.1:2024", {
        transports: ["websocket"],
    });

    useEffect(() => {
        // Fetch games from the backend
        axios
        .get<{ status: boolean; data: Game[] }>('http://localhost:2024/v1/admin/games')
        .then((response) => {
          if (response.data.status) {
            setGames(response.data.data);
          } else {
            throw new Error(`Unexpected response format: ${JSON.stringify(response.data)}`);
          }
        })
        .catch((error) => {
            console.error('Error fetching games:', error);
            setGames([]); // Default to an empty array on error
        });

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
                    setBestSellingGames(data.bestSellingGames || []);
                    setLeastSellingGames(data.leastSellingGames || []);
                    setHighestPayingCustomers(data.highestPayingCustomers || []);
                    setGameDurationStats(data.gameDurationStats || []);
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

    const handleDurationChange = (id: number, duration: string) => {
        setUpdatedDurations((prev) => ({ ...prev, [id]: duration }));
    };

    const handleUpdate = (id: number) => {
        const newDuration = updatedDurations[id];
        axios
            .put(`http://localhost:2024/v1/admin/games/${id}`, { time_slot: newDuration })
            .then(() => {
                alert('Game duration updated successfully');
                setGames((prevGames) =>
                    prevGames.map((game) =>
                        game.id === id ? { ...game, time_slot: Number(newDuration) } : game
                    )
                );
            })
            .catch((error) => console.error('Error updating game duration:', error));
    };

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

    const handleCreateUser = () => {
        const phoneRegex = /^[0-9]{11}$/;
        if (!phoneRegex.test(newUser.phone)) {
            alert('Please enter a valid 11-digit phone number.');
            return;
        }
        axios
            .post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/users`, newUser)
            .then(() => {
                alert('User created successfully');
                setNewUser({ email: '', phone: '', role: '' });
            })
            .catch((error) => console.error('Error creating user:', error));
    };

    return (
        <div className="admin-container">
            <h1>Admin Panel</h1>
            {/* Create User Form */}
            <div className="create-user-form">
                <h2>Create New User</h2>
                <input
                    type="text"
                    placeholder="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
                <input
                    type="tel"
                    placeholder="Phone Number"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                />
                <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                    <option value="">Select Role</option>
                    {userRoles.map((role) => (
                        <option key={role} value={role}>
                            {role}
                        </option>
                    ))}
                </select>
                <button onClick={handleCreateUser}>Create User</button>
            </div>

            {/* Game Duration Management */}
            <h2>Edit Games</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>URL</th>
                        <th>Price</th>
                        <th>Current Duration (Minutes)</th>
                        <th>New Duration</th>

                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {games.map((game) => (
                        <tr key={game.id}>
                            <td>{game.title}</td>
                            <td>{game.url}</td>
                            <td>{game.price}</td>
                            <td>{game.time_slot}</td>
                            <td>
                                <input
                                    type="number"
                                    value={updatedDurations[game.id] || game.time_slot}
                                    onChange={(e) =>
                                        handleDurationChange(game.id, e.target.value)
                                    }
                                />
                                <input
                                    type = "string"
                                    value = {game.url}
                                    onChange={(e) => setGames((prevGames) => prevGames.map((g) => g.id === game.id ? { ...g, url: e.target.value } : g))}
                                    />
                                    <input
                                    type = "string"
                                    value = {game.title}
                                    onChange = {(e) => setGames((prevGames) => prevGames.map((g) => g.id === game.id ? { ...g, title: e.target.value } : g))}
                                    />
                                    <input
                                    type = "number"
                                    value = {game.price}
                                    onChange = {(e) => setGames((prevGames) => prevGames.map((g) => g.id === game.id ? { ...g, title: e.target.value } : g))}
                                    />
                            </td>
                            <td>
                                <button onClick={() => handleUpdate(game.id)}>Update</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Reports */}
            <div className="reports-section">
                <h2>Reports</h2>
                <div>
                    <label>
                        Start Date:
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </label>
                    <label>
                        End Date:
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </label>
                </div>

                <h3>Best Selling Games</h3>
                <table>
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

                <h3>Transaction Records</h3>
                <table id="report-table">
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
        </div>
    );
};

export default Admin;
