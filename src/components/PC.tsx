import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './PC.css';

interface PCStatusType {
  [pc_id: string]: string;
}

// Connect to the Socket.IO server
const socket = io('http://localhost:2024', {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('Connected to /pcs');
});

const PC: React.FC = () => {
  const [pcStatus, setPCStatus] = useState<PCStatusType>({});
  const [pcData, setPCData] = useState<any[]>([]); // To store the PC data from the API

  useEffect(() => {
    // Fetch PC data from the API
    const fetchPCData = async () => {
      try {
        const response = await axios.get<any[]>('http://localhost:2024/v1/admin/pc');
        setPCData(response.data);
      } catch (error) {
        console.error('Error fetching PC data:', error);
      }
    };

    fetchPCData();

    // Listen for PC status updates from Socket.IO
    socket.on('pcStatusUpdate', (data: { pc_id: string; status: string }) => {
      setPCStatus((prevState) => ({
        ...prevState,
        [data.pc_id]: data.status,
      }));
    });

    return () => {
      socket.off('pcStatusUpdate');
    };
  }, []);

  return (
    <div className="pc-status-container">
      <h2 className="pc-status-title">PC Status</h2>
      <ul className="pc-status-list">
        {pcData.length > 0 ? (
          pcData.map((pc) => (
            <li
              key={pc.id}
              className={`pc-status-item ${pcStatus[pc.id]}`}
            >
              PC {pc.id} is <span>{pcStatus[pc.id] || 'loading...'}</span>
            </li>
          ))
        ) : (
          <li className="pc-status-item no-status">No PC available</li>
        )}
      </ul>
    </div>
  );
};

export default PC;
