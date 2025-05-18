// OperatorRegister.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { UUID } from "crypto";

const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

const OperatorRegister = () => {
    const navigate = useNavigate();
    const [message, setMessage] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', hashed_password: '', permissions: [] as UUID[]});
  const [users, setUsers] = useState<{ id: string; name: string; password_hash: string; email: string; slug: string }[]>([]);
  const socket: Socket = io('ws://127.0.0.1:2024', { transports: ['websocket'] });

  const handleOperatorRegister = () => {
        if (!newUser.name || !newUser.email || !newUser.hashed_password) {
            alert('Please fill in all fields.');
            return;
        }

        // Validate each permission UUID
        const invalidPermissions = newUser.permissions.filter(permission => !isValidUUID(permission));
        if (invalidPermissions.length > 0) {
            alert('Invalid UUIDs found in permissions. Please check and try again.');
            return;
        }
        axios
            .post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators/register`, newUser)
            .then(() => {
                //function to create slug
                alert('Admin created successfully');
                setNewUser({ name: '', hashed_password: '', email: '', permissions: [] as UUID[] });
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

   

        console.log('New User Data:', newUser);
        console.log("Sending Data:", JSON.stringify(newUser, null, 2));
        console.log('Backend URL:', `${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators`);

        
    
    //function to fetch roles
    useEffect(() => {
        axios
            .get<{ status: boolean; data: { id: string; name: string; password_hash: string; email: string; slug: string }[] }>(
                `${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators`
            )
            .then((response) => {
                if (response.data.status) {
                    setUsers(response.data.data.map(user => ({
                        id: user.id,
                        name: user.name,
                        password_hash: user.password_hash,
                        email: user.email,
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
            .delete(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators/${id}`)
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
        localStorage.removeItem('token');
        alert('Logged out successfully');
        navigate('/');
    }

    const setName = (value: string): void => {
        setNewUser(prevState => ({
            ...prevState,
            name: value
        }));
    }

    const setEmail = (value: string): void => {
        setNewUser(prevState => ({
            ...prevState, 
            email: value
        }));
    }

    const setSlug = (value: string): void => {
        setNewUser(prevState => ({
            ...prevState,
            slug: value
        }));
    }

    const setPassword = (value: string): void => {
        setNewUser(prevState => ({
            ...prevState,
            hashed_password: value
        }));
    }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleOperatorRegister(); }}>
      <h2>Operator Registration</h2>

      <input value={newUser.name} onChange={(e) => setName(e.target.value)} placeholder="First Name" required />
      <input value={newUser.email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />

      <input type="password" value={newUser.hashed_password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
      <button type="submit">Register</button>
    </form>
  );
};

export default OperatorRegister;
