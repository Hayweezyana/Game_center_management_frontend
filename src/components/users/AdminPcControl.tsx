import React, { useEffect, useState } from "react";
import axios from "axios";

interface Pc {
  id: string;
  title: string;
  inUse: boolean;
  isLocked: boolean;
  isOnline?: boolean;
  busyUntil: number | null;
  lastSeenAt: number;
}

const BACKEND = process.env.REACT_APP_BACKEND_URL?.replace(/\/+$/, "") || "http://127.0.0.1:2024";

const AdminPcControl: React.FC = () => {
  const [pcs, setPcs] = useState<Pc[]>([]);

  useEffect(() => {
    fetchPcs();

    // connect to WS
    const wsUrl = BACKEND.replace(/^http/, "ws"); // http:// → ws://
    const ws = new WebSocket(`${wsUrl}/ws/admin`); // adjust endpoint if needed

    ws.onopen = () => console.log("Admin WS connected ✅");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Example message: { type: "pc-status", pc: {...} }
        if (msg.type === "pc-status") {
          setPcs((prev) =>
            prev.map((pc) =>
              pc.id === msg.pc.id
                ? {
                    ...pc,
                    isLocked: msg.pc.isLocked,
                    inUse: msg.pc.busyUntil ? msg.pc.busyUntil > Date.now() : false,
                    isOnline: msg.pc.isOnline,
                    busyUntil: msg.pc.busyUntil ?? null,
                    lastSeenAt: msg.pc.lastSeenAt ?? pc.lastSeenAt,
                  }
                : pc
            )
          );
        }

        // Or if backend emits a full list:
        if (msg.type === "pcs-sync") {
          const mapped = msg.pcs.map((pc: any) => ({
            id: pc.id,
            title: pc.title,
            isLocked: pc.isLocked,
            inUse: pc.busyUntil ? pc.busyUntil > Date.now() : false,
            isOnline: pc.isOnline,
            busyUntil: pc.busyUntil ?? null,
            lastSeenAt: pc.lastSeenAt ?? Date.now(),
          } as Pc));
          setPcs(mapped);
        }
      } catch (e) {
        console.warn("WS message parse error", e);
      }
    };

    ws.onclose = () => console.warn("Admin WS disconnected ❌");

    return () => {
      ws.close();
    };
  }, []);

  const fetchPcs = async () => {
    try {
      const { data } = await axios.get<Pc[]>(`${BACKEND}/v1/admin/available-pcs`);
      setPcs(data);
      // const mapped = raw.map((pc: any) => ({
      //   id: pc.id,
      //   title: pc.title,
      //   isLocked: pc.isLocked,
      //   inUse: pc.busyUntil ? pc.busyUntil > Date.now() : false,
      //   isOnline: pc.isOnline,
      // }));
      // setPcs(mapped);
    } catch (err) {
      console.error("Failed to fetch PCs:", err);
    }
  };

  const toggleLock = async (pcId: string, currentlyLocked: boolean) => {
    try {
      if (currentlyLocked) {
        await axios.post(`${BACKEND}/v1/admin/pcs/${pcId}/unlock`);
      } else {
        await axios.post(`${BACKEND}/v1/admin/pcs/${pcId}/lock`);
      }
      // no need to refetch — WS will update state
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
            <p className={pc.isLocked ? "text-red-500" : "text-green-500"}>
              {pc.isLocked ? "Locked 🔒" : "Unlocked 🔓"}
            </p>
            <p>Online: {pc.isOnline ? "✅" : "❌"}</p>
            <button
              onClick={() => toggleLock(pc.id, pc.isLocked)}
              className={`mt-2 px-3 py-1 rounded ${
                pc.isLocked ? "bg-green-600" : "bg-red-600"
              } text-white`}
            >
              {pc.isLocked ? "Unlock PC" : "Lock PC"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPcControl;
