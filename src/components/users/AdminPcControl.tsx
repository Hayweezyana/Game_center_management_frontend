import React, { useEffect, useState } from "react";
import axios from "axios";

interface Pc {
  id: string;
  title: string;
  inUse: boolean;
  locked: boolean;
}

const BACKEND = process.env.REACT_APP_BACKEND_URL?.replace(/\/+$/, "") || "http://127.0.0.1:2024";

const AdminPcControl: React.FC = () => {
  const [pcs, setPcs] = useState<Pc[]>([]);

  useEffect(() => {
    fetchPcs();
  }, []);

  const fetchPcs = async () => {
    try {
      // Your legacy route for listing all PCs
      const res = await axios.get(`${BACKEND}/v1/admin/available-pcs`);
      setPcs(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch PCs:", err);
    }
  };

  const toggleLock = async (pcId: string, currentlyLocked: boolean) => {
    try {
      if (currentlyLocked) {
        // unlock
        await axios.post(`${BACKEND}/v1/admin/pcs/${pcId}/unlock`);
      } else {
        // lock
        await axios.post(`${BACKEND}/v1/admin/pcs/${pcId}/lock`);
      }
      await fetchPcs();
    } catch (err) {
      console.error("Failed to toggle lock:", err);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">PC Control Panel</h2>
      <div className="grid grid-cols-2 gap-4">
        {pcs.map((pc) => (
          <div key={pc.id} className="border rounded p-4 shadow-md">
            <h3 className="text-lg font-semibold">{pc.title}</h3>
            <p>Status: {pc.inUse ? "In Use" : "Available"}</p>
            <p className={pc.locked ? "text-red-500" : "text-green-500"}>
              {pc.locked ? "Locked 🔒" : "Unlocked 🔓"}
            </p>
            <button
              onClick={() => toggleLock(pc.id, pc.locked)}
              className={`mt-2 px-3 py-1 rounded ${
                pc.locked ? "bg-green-600" : "bg-red-600"
              } text-white`}
            >
              {pc.locked ? "Unlock PC" : "Lock PC"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPcControl;
