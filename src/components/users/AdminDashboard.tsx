import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface PCStatus {
  id: string;
  title: string;
  isLocked: boolean;
  isOnline: boolean;
  currentGame?: string;
  lastUnlockedAt?: string;
}

const AdminDashboard: React.FC = () => {
  const [pcs, setPcs] = useState<PCStatus[]>([]);

  const fetchPCStatus = async () => {
  try {
    const { data } = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/pc`);
    console.log('API Response:', data); // Debug the response
    if (data && Array.isArray(data.data)) {
                    setPcs(data.data);
    } else {
      console.error('Expected an array, but received:', data);
      setPcs([]); // Fallback to empty array
    }
  } catch (err) {
    console.error('Error fetching PC status:', err);
    setPcs([]); // Fallback to empty array on error
  }
};

  const toggleLock = async (pcId: string, lock: boolean) => {
    await axios.patch(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/pcs/${pcId}/${lock ? 'lock' : 'unlock'}`);
    fetchPCStatus(); // Refresh status
  };

  useEffect(() => {
    fetchPCStatus();
  }, []);

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      {pcs.map((pc) => (
        <Card key={pc.id} className={`shadow-md ${pc.isLocked ? 'bg-red-50' : 'bg-green-50'}`}>
          <CardContent>
            <h2 className="text-xl font-bold">{pc.title}</h2>
            <p>Status: {pc.isLocked ? 'Locked' : 'Unlocked'}</p>
            <p>Online: {pc.isOnline ? 'Yes' : 'No'}</p>
            {pc.currentGame && <p>Game: {pc.currentGame}</p>}
            {pc.lastUnlockedAt && <p>Last Used: {new Date(pc.lastUnlockedAt).toLocaleString()}</p>}

            <div className="mt-4 flex justify-between">
              <Button
                onClick={() => toggleLock(pc.id, false)}
                disabled={!pc.isLocked}
                className="bg-green-600 text-white"
              >
                Unlock
              </Button>
              <Button
                onClick={() => toggleLock(pc.id, true)}
                disabled={pc.isLocked}
                className="bg-red-600 text-white"
              >
                Lock
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminDashboard;
