import React, { useEffect, useState } from "react";

type PCStatus = "locked" | "playing";

interface PC {
    pc_name: string;
  pc_id: string;
  status: PCStatus;
  minutes_left: number;
}

const PCLockDashboard: React.FC = () => {
  const [pcs, setPcs] = useState<PC[]>([]);

  const fetchPCs = async () => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/v1/admin/pc-control`
      );
      if (!res.ok) throw new Error("Failed to fetch PCs");
      const data = await res.json();
      setPcs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching PCs:", err);
      setPcs([]);
    }
  };

  const lockPC = async (pc_id: string) => {
    const password = prompt("Enter admin password:");
    if (!password) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pc_id, password }),
      });
      fetchPCs();
    } catch (err) {
      console.error("Error locking PC:", err);
    }
  };

  const unlockPC = async (pc_id: string) => {
    const password = prompt("Enter admin password:");
    const minutes = prompt("Minutes to unlock:");
    if (!password || !minutes) return;
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pc_id,
          password,
          minutes: parseInt(minutes, 10),
        }),
      });
      fetchPCs();
    } catch (err) {
      console.error("Error unlocking PC:", err);
    }
  };

  useEffect(() => {
    fetchPCs();
    const interval = setInterval(fetchPCs, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>PC Lock Dashboard</h1>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={thStyle}>PC ID</th>
            <th style={thStyle}>PC Name</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Minutes Left</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pcs.length > 0 ? (
            pcs.map((pc) => (
              <tr
                key={pc.pc_id}
                style={{
                  backgroundColor:
                    pc.status === "locked" ? "#f8d7da" : "#d4edda",
                }}
              >
                <td style={tdStyle}>{pc.pc_id}</td>
                <td style={tdStyle}>{pc.pc_name}</td>
                <td style={tdStyle}>{pc.status}</td>
                <td style={tdStyle}>{pc.minutes_left}</td>
                <td style={tdStyle}>
                  <button onClick={() => lockPC(pc.pc_id)}>Lock</button>{" "}
                  <button onClick={() => unlockPC(pc.pc_id)}>Unlock</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td style={tdStyle} colSpan={4}>
                No PCs connected
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "8px",
  textAlign: "center",
  background: "#eee",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "8px",
  textAlign: "center",
};

export default PCLockDashboard;
