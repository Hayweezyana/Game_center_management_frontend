import React, { useEffect, useState, useMemo } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { useCartContext } from './hooks/useCart';
import './PC.css';
import { UUID } from 'crypto';

/** A machine on the floor. Named apart from the `PC` component below, which
 *  would otherwise shadow it. */
interface PcStatus {
  id: UUID;
  title: string;
  game_id: string;
  inUse: boolean;
}

interface CartItem {
  id: string; // Unique identifier for the item
  title: string;
  price: number;
  quantity: number;
  gameDuration: number; // Game duration in minutes
  type: 'game' | 'drink'; // Type of item, can be 'game' or 'drink'
}

interface PCProps {
  cart: any[];
}

const socket = io(`${process.env.REACT_APP_BACKEND_URL}`, {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('[Socket.IO] Connected to /pcs');
});

const PC: React.FC<PCProps> = ({ cart }) => {
  const { cartItems }: { cartItems: CartItem[] } = useCartContext();
  
  // Debug logs for initial rendering
  console.log('[PC Component] Rendered with cartItems:', cartItems);

  const [pcData, setPCData] = useState<PcStatus[]>([]);
  const [waitingTimes, setWaitingTimes] = useState<{ [game_id: string]: number }>({});

  useEffect(() => {
    console.log('[Effect] Current cartItems:', cartItems);
  }, [cartItems]);

  useEffect(() => {
    console.log('[Effect] Current pcData:', pcData);
  }, [pcData]);

  useEffect(() => {
    const fetchPCs = async () => {
      try {
        console.log('[API Call] Fetching PC data...');
        const response = await axios.get<{ status: boolean; data: PcStatus[] }>(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/pc`);
        if (response.data && Array.isArray(response.data.data)) {
          console.log('[API Response] PC Data:', response.data.data);
          setPCData(response.data.data);
        } else {
          console.error('[Error] Unexpected response format:', response.data);
        }
      } catch (error) {
        console.error('[Error] Fetching PCs failed:', error);
      }
    };

    fetchPCs();

    // Listening for Socket.IO events
    socket.on('pcStatusUpdate', (data: { pc_id: string; status: boolean }) => {
      console.log('[Socket.IO Event] PC Status Update:', data);
      setPCData((prevData) =>
        prevData.map((pc) => (pc.id === data.pc_id ? { ...pc, inUse: data.status } : pc))
      );
    });

    return () => {
      console.log('[Cleanup] Removing pcStatusUpdate listener');
      socket.off('pcStatusUpdate');
    };
  }, []);

  const assignedPCData = useMemo(() => {
    console.log('[Memo] Calculating assignedPCData...');
    const updatedPCs = [...pcData];
    const newWaitingTimes: { [game_id: string]: number } = {};

    cartItems.forEach((item) => {
      console.log(`[Memo] Processing cart item:`, item);
      const availablePCs = updatedPCs.filter((pc) => pc.game_id === item.id && !pc.inUse);
      console.log(`[Memo] Available PCs for game ${item.id}:`, availablePCs);

      const neededQuantity = item.quantity;
      if (availablePCs.length >= neededQuantity) {
        availablePCs.slice(0, neededQuantity).forEach((pc) => (pc.inUse = true));
      } else {
        newWaitingTimes[item.id] = Math.max(0, neededQuantity - availablePCs.length) * (item.gameDuration + 4); // Adding 4 minutes for setup
      }
    });

    setWaitingTimes(newWaitingTimes);
    console.log('[Memo] Updated Waiting Times:', newWaitingTimes);
    console.log('[Memo] Updated PC Data:', updatedPCs);

    return updatedPCs;
  }, [cartItems, pcData]);

  return (
    <div className="pc-status-container">
      <h2 className="pc-status-title">PC Status</h2>
      {cartItems && cartItems.length === 0 ? (
        <p className="no-cart-message">No games in the cart. Please add games to check PC availability.</p>
      ) : (
        <ul className="pc-status-list">
          {cartItems.map((item) => {
            const gamePCs = assignedPCData.filter((pc) => pc.game_id === item.id);
            const busyPCs = gamePCs.filter((pc) => pc.inUse);

            console.log(`[Rendering] Cart Item: ${item.title}`);
            console.log(`[Rendering] Game PCs for ${item.id}:`, gamePCs);
            console.log(`[Rendering] Busy PCs for ${item.id}:`, busyPCs);

            return (
              <li key={item.id} className="pc-status-item">
                <strong>Game ID:</strong> {item.title} <br />
                <strong>Quantity:</strong> {item.quantity} <br />
                {gamePCs.length === 0 ? (
                  <span>No PCs available for this game.</span>
                ) : busyPCs.length === gamePCs.length ? (
                  <span>
                    Status: Waiting for PC <br />
                    Estimated Wait Time: {waitingTimes[item.id]} minutes
                  </span>
                ) : (
                  <span>Status: PCs available</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default PC;
