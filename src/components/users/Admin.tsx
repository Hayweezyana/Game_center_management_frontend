import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Admin.css';
import { io, Socket } from 'socket.io-client';
import { UUID } from "crypto";
import CreateAdminForm from './CreateAdminForm';

interface PC {
    id: string;
    inUse: string; // e.g., "true" or "false"
    title: string; // Optional description field
}

interface Game {
    id: string;
    title: string;
    price: number;
    url: string;
    time_slot: number;
}

const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

const Admin: React.FC = () => {
    const navigate = useNavigate();
    const [pcs, setPcs] = useState<PC[]>([]);
    const [newPC, setNewPC] = useState<Partial<PC>>({ inUse: 'false', title: '' });
    const [games, setGames] = useState<Game[]>([]);
    const [updatedGameFields, setUpdatedGameFields] = useState<{ [key: string]: Partial<Game> }>({});
    const [updatedPCFields, setUpdatedPCFields] = useState<{ [key: string]: Partial<PC> }>({});
    const [newUser, setNewUser] = useState({ name: '', description: '', hashed_password: '', permissions: [] as UUID[], slug: '' });
    const [newGame, setNewGame] = useState<Game>({ id: '', title: '', price: 0, url: '', time_slot: 0 });
    const [users, setUsers] = useState<{ id: string; name: string; password_hash: string; description: string; slug: string }[]>([]);
    const socket: Socket = io('ws://127.0.0.1:2024', { transports: ['websocket'] });

    useEffect(() => {
        // Fetch games
        axios
            .get<{ status: boolean; data: Game[] }>(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/games`)
            .then((response) => {
                if (response.data.status) {
                    setGames(response.data.data);
                } else {
                    throw new Error('Unexpected response format');
                }
            })
            .catch((error) => console.error('Error fetching games:', error));
    }, []);

    const handleFieldChange = (id: string, field: keyof Game, value: string | number) => {
        setUpdatedGameFields((prev) => ({
            ...prev,
            [id]: { ...prev[id], [field]: value },
        }));
    };

    const handleUpdateGame = (id: string) => {
        const updates = updatedGameFields[id];
        if (!updates) {
            alert('No changes to update');
            return;
        }
        axios
            .put(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/games/${id}`, updates)
            .then(() => {
                alert('Game updated successfully');
                setGames((prevGames) =>
                    prevGames.map((game) =>
                        game.id === id ? { ...game, ...updates } : game
                    )
                );
                setUpdatedGameFields((prev) => {
                    const updated = { ...prev };
                    delete updated[id];
                    return updated;
                });
            })
            .catch((error) => console.error('Error updating game:', error));
    };

    const handleAddGame = () => {
        if (!newGame.title || newGame.price <= 0 || !newGame.url || newGame.time_slot <= 0) {
            alert('Please fill in all fields with valid data');
            return;
        }

        axios
            .post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/games`, newGame)
            .then((response) => {
                alert('Game added successfully');
                setGames((prevGames) => [...prevGames, response.data as Game]);
                setNewGame({ id: '', title: '', price: 0, url: '', time_slot: 0 });
            })
            .catch((error) => console.error('Error adding game:', error));
    };

    useEffect(() => {
        axios
            .get<{ status: boolean; data: PC[] }>(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/pc`)
            .then((response) => {
                console.log('Raw response data:', response.data);
                if (response.data && Array.isArray(response.data.data)) {
                    setPcs(response.data.data); // Access the nested array
                    console.log('Fetched PCs:', response.data.data);
                } else {
                    throw new Error('Unexpected response format');
                }
            })
            .catch((error) => console.error('Error fetching PCs:', error));
    }, []);
    

    // Handle PC Updates
    const handlePCFieldChange = (id: string, field: keyof PC, value: string | number) => {
        setUpdatedPCFields((prev) => ({
            ...prev,
            [id]: { ...prev[id], [field]: value },
        }));
    };

    const handleUpdatePC = (id: string) => {
        const updates = updatedPCFields[id];
        if (!updates) {
            alert('No changes to update');
            return;
        }
        axios
            .put(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/pc/${id}`, updates)
            .then(() => {
                alert('PC updated successfully');
                setPcs((prevPcs) =>
                    prevPcs.map((pc) => (pc.id === id ? { ...pc, ...updates } : pc))
                );
                setUpdatedPCFields((prev) => {
                    const updated = { ...prev };
                    delete updated[id];
                    return updated;
                });
            })
            .catch((error) => console.error('Error updating PC:', error));
    };

    // Add New PC
    const handleAddPC = () => {
        if (!newPC.inUse) {
            alert('Please select a status for the PC.');
            return;
        }

        axios
            .post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/pc`, newPC)
            .then((response) => {
                alert('PC added successfully');
                setPcs((prevPcs) => [...prevPcs, response.data as PC]);
                setNewPC({ inUse: 'free', title: '' });
            })
            .catch((error) => console.error('Error adding PC:', error));
    };

    const handleCreateUser = () => {
        if (!newUser.name || !newUser.description || newUser.permissions.length === 0) {
            alert('Please fill in all fields.');
            return;
        }

        // Validate each permission UUID
        const invalidPermissions = newUser.permissions.filter(permission => !isValidUUID(permission));
        if (invalidPermissions.length > 0) {
            alert('Invalid UUIDs found in permissions. Please check and try again.');
            return;
        }

        console.log('New User Data:', newUser);
        console.log("Sending Data:", JSON.stringify(newUser, null, 2));
        console.log('Backend URL:', `${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles`);

        axios
            .post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/create`, newUser)
            .then(() => {
                //function to create slug
                const slug = newUser.name.toLowerCase().replace(/\s+/g, '-');
                console.log('New User Data:', newUser);
                alert('Admin created successfully');
                setNewUser({ name: '', hashed_password: '', description: '', permissions: [] as UUID[], slug: '' });
            })
            .catch((error) => {
                if (error.response) {
                    if (error.response.status === 400) {
                        console.error('Bad Request:', error.response.data);
                        alert('Invalid data. Please check the fields and try again.');
                    } else if (error.response.status === 409) {
                        console.error('Conflict:', error.response.data.message || 'Conflict error');
                        alert('An admin with this name already exists.');
                    } else {
                        console.error('Error creating role:', error.response.data);
                        alert('An error occurred while creating the admin.');
                    }
                } else {
                    console.error('Network or other error:', error.message);
                    alert('An error occurred while creating the admin.');
                }
            });
    };
    //link to the drink inventory page
    const handleDrinkInventory = () => {
        navigate('/DrinkInventory');
    }
    
    //function to fetch roles
    useEffect(() => {
        axios
            .get<{ status: boolean; data: { id: string; name: string; password_hash: string; description: string; slug: string }[] }>(
                `${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles`
            )
            .then((response) => {
                if (response.data.status) {
                    setUsers(response.data.data.map(user => ({
                        id: user.id,
                        name: user.name,
                        password_hash: user.password_hash,
                        description: user.description,
                        slug: user.slug
                    })));
                } else {
                    throw new Error('Unexpected response format');
                }
            })
            .catch((error) => console.error('Error fetching users:', error));



    }, []); // Add this line to close the useEffect hook

    // function to delete user
    const handleDeleteUser = (id: string) => {
        axios
            .delete(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/roles/${id}`)
            .then(() => {
                //to confirm deletion
                socket.emit('deleteUser', id);
                socket.on('userDeleted', (deletedUserId: string) => {
                    console.log(`User with ID ${deletedUserId} deleted`);
                });
                setUsers((prevUsers) => prevUsers.filter((user) => user.id !== id));
            })
            .catch((error) => console.error('Error deleting user:', error));
    };

    //to handle logout
    const handleLogout = () => {
        sessionStorage.removeItem('token');
        alert('Logged out successfully');
        navigate('/');
    }

    return (
    <div className="admin-container">
        <h1>Welcome Admin!</h1>
        {/* User Management */}
        {/* Report button */}
    <button onClick={() => navigate('/report')}>View Reports</button>
        <h2>Manage Admins</h2>
        <section>
            <CreateAdminForm />
        </section>
        <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>description</th>
                        <th>permissions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user.id}>
                            <td>{user.id}</td>
                            <td>{user.name}</td>
                            <td>{user.description}</td>
                            <td>{user.slug}</td>
                            <td>
                                <button onClick={() => handleDeleteUser(user.id)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        <button onClick={handleDrinkInventory}>Drink Dashboard</button>

            {/* Game Management */}
            <h2>Edit Games</h2>
            <table>
                <thead>
                    <tr>
                    <th>ID</th><th>New Duration</th>
                        <th>Current Duration (Minutes)</th>
                        <th>Title</th>
                        <th>URL</th>
                        <th>Price</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {games.map((game) => (
                        <tr key={game.id}>
                            <td>{game.id}</td>
                            <td>
                                <input
                                    type="number"
                                    value={updatedGameFields[game.id]?.time_slot || ''}
                                    onChange={(e) =>
                                        handleFieldChange(game.id, 'time_slot', parseInt(e.target.value, 10)
                                    )
                                    
                                    }
                                />
                            </td>
                                <input
                                    type="number"
                                    placeholder={game.time_slot.toString()}
                                    value={updatedGameFields[game.id]?.time_slot || ''}
                                    onChange={(e) =>
                                        handleFieldChange(game.id, 'time_slot', parseInt(e.target.value, 10)
                                    )
                                    
                                    }
                                    />
                                    <td>
                                    <input
                                        type="text"
                                        placeholder={game.title}
                                        value={updatedGameFields[game.id]?.title || ''}
                                        onChange={(e) =>
                                            handleFieldChange(game.id, 'title', e.target.value)
                                        }
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        placeholder={game.url}
                                        value={updatedGameFields[game.id]?.url || ''}
                                        onChange={(e) =>
                                            handleFieldChange(game.id, 'url', e.target.value)
                                        }
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        placeholder={game.price.toString()}
                                        value={updatedGameFields[game.id]?.price || ''}
                                        onChange={(e) =>
                                            handleFieldChange(
                                                game.id,
                                                'price',
                                                parseFloat(e.target.value)
                                            )
                                        }
                                    />
                                </td>
                            <td>
                                <button onClick={() => handleUpdateGame(game.id)}>Update</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Add New Game */}
            <div className="add-game-form">
                <h3>Add New Game</h3>
                <input
                    type="text"
                    placeholder="Game Title"
                    value={newGame.title}
                    onChange={(e) => setNewGame({ ...newGame, title: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Game URL"
                    value={newGame.url}
                    onChange={(e) => setNewGame({ ...newGame, url: e.target.value })}
                />
                <input
                    type="number"
                    placeholder="Price"
                    value={newGame.price || ''}
                    onChange={(e) => setNewGame({ ...newGame, price: parseFloat(e.target.value) })}
                />
                <input
                    type="number"
                    placeholder="Time Slot (minutes)"
                    value={newGame.time_slot || ''}
                    onChange={(e) =>
                        setNewGame({ ...newGame, time_slot: parseInt(e.target.value, 10) })
                    }
                />
                <button onClick={handleAddGame}>Add Game</button>
            </div>

            {/* PC Management Section */}
            <div className="pc-management">
                <h2>Manage PCs</h2>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>inUse</th>
                            <th>Title</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pcs.map((pc) => (
                            <tr key={pc.id}>
                                <td>{pc.id}</td>
                                <td>
                                    <select
                                        value={updatedPCFields[pc.id]?.inUse || pc.inUse}
                                        onChange={(e) =>
                                            handlePCFieldChange(pc.id, 'inUse', e.target.value)
                                        }
                                    >
                                        <option value="free">Free</option>
                                        <option value="busy">Busy</option>
                                    </select>
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        value={updatedPCFields[pc.id]?.title || pc.title}
                                        onChange={(e) =>
                                            handlePCFieldChange(pc.id, 'title', e.target.value)
                                        }
                                    />
                                </td>
                                <td>
                                    <button onClick={() => handleUpdatePC(pc.id)}>Update</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Add New PC */}
                <h3>Add New PC</h3>
                <div>
                    <select
                        value={newPC.inUse}
                        onChange={(e) => setNewPC({ ...newPC, inUse: e.target.value })}
                    >
                        <option value="false">Free</option>
                        <option value="true">Busy</option>
                    </select>
                    <input
                        type="text"
                        placeholder="title"
                        value={newPC.title || ''}
                        onChange={(e) => setNewPC({ ...newPC, title: e.target.value })}
                    />
                    <button onClick={handleAddPC}>Add PC</button>
                </div>
            </div>
    {/* View Moniepoint Transaction button */}
    <button onClick={() => navigate('/moniepointdashboard')}>View Moniepoint Transactions</button>
    {/* View Users button */}
    {/* Logout button */}
    <button onClick={handleLogout}>Logout</button>
</div>
        
    );

    
};

export default Admin;

