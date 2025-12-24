import React, { useEffect, useMemo, useRef, useState } from "react";
import axios, { AxiosError } from "axios";
import "./OperatorDashboard.css";

interface GameItem {
  id: string; // transaction_item ID
  game_title: string;
  game_duration?: number; // minutes (optional)
  username: string;
  game_quantity: number;
  transaction_created_at: string;
  transaction_time: string; // ISO
  transaction: { game_duration?: number | null };
  unit_index: number;
}

type PcRow = {
  id: string;
  title: string;
  isLocked?: boolean;      // server may return this
  isOnline?: boolean;      // server may return this
  currentGame?: string | null;
  lastUnlockedAt?: string | null;
};

const OperatorDashboard: React.FC = () => {
  const [unconsumedGames, setUnconsumedGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<GameItem | null>(null);

  const [availablePCs, setAvailablePCs] = useState<PcRow[]>([]);
  const [selectedPCId, setSelectedPCId] = useState<string>("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const BACKEND = process.env.REACT_APP_BACKEND_URL?.replace(/\/+$/, "") || "http://127.0.0.1:2024";
  const token = useMemo(() => localStorage.getItem("operatorToken") || "", []);

  // --- Helpers -------------------------------------------------------------

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // --- Grouping & Sorting Logic ---
  const groupedGames = useMemo(() => {
    // 1. Sort all games by time (Latest first)
    const sortedGames = [...unconsumedGames].sort((a, b) => 
      new Date(b.transaction_time).getTime() - new Date(a.transaction_time).getTime()
    );

    // 2. Group by Username
    const groups = sortedGames.reduce((acc, item) => {
      if (!acc[item.username]) acc[item.username] = [];
      acc[item.username].push(item);
      return acc;
    }, {} as Record<string, GameItem[]>);

    // 3. Convert to array of groups, ensuring the latest customer is first
    return Object.entries(groups).sort(([, gamesA], [, gamesB]) => {
      return new Date(gamesB[0].transaction_time).getTime() - new Date(gamesA[0].transaction_time).getTime();
    });
  }, [unconsumedGames]);

  const getJson = async <T,>(url: string, params?: Record<string, any>) => {
    const res = await axios.get<T>(url, { params, headers: authHeaders });
    return res.data;
  };

  const postJson = async <T,>(url: string, body?: any) => {
    const res = await axios.post<T>(url, body ?? {}, { headers: authHeaders });
    return res.data;
  };

  const normalizePcList = (data: any): PcRow[] => {
  const arr = Array.isArray(data) ? data : Array.isArray(data?.pcs) ? data.pcs : [];
  return arr.map((pc: any) => ({
    id: String(pc.id),
    title: String(pc.title ?? pc.pc_name ?? pc.id),
    isLocked: pc.isLocked ?? pc.locked ?? undefined,
    isOnline: pc.isOnline ?? false,
    currentGame: pc.gameTitle ?? pc.currentGame ?? null,
    lastUnlockedAt: pc.lastUnlockedAt ?? pc.last_unlocked_at ?? null,
  }));
};

  const fetchAvailablePCs = async (gameTitle?: string) => {
    setErrorMsg(null);
    // Try new route first: /admin/available-pcs (no /v1)
    try {
      const data = await getJson<any>(`${BACKEND}/v1/admin/available-pcs`, gameTitle ? { game_title: gameTitle } : undefined);
      setAvailablePCs(normalizePcList(data));
      return;
    } catch (err) {
      // Fallback to legacy: /v1/admin/available-pcs
      try {
        const data = await getJson<any>(`${BACKEND}/v1/admin/available-pcs`, gameTitle ? { game_title: gameTitle } : undefined);
        setAvailablePCs(normalizePcList(data));
        return;
      } catch (err2) {
        console.error("Failed to fetch available PCs:", err2);
        setAvailablePCs([]);
        const e = err2 as AxiosError;
        setErrorMsg(e.response?.data ? JSON.stringify(e.response.data) : e.message);
      }
    }
  };

  // --- Load unconsumed games ----------------------------------------------

  useEffect(() => {
    const fetchUnconsumedGames = async () => {
      try {
        if (!token) {
          console.warn("No token found for operator.");
          setLoading(false);
          return;
        }

        const res = await axios.get(`${BACKEND}/v1/admin/consumed-game`, { headers: authHeaders });
        const now = new Date();
        const filtered = (res.data as GameItem[]).filter((item) => {
          const createdAt = new Date(item.transaction_time);
          const hours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 7);
          return hours <= 168; // within 7 days
        });
        setUnconsumedGames(filtered);
      } catch (err) {
        console.error("Error fetching unconsumed games:", err);
        setErrorMsg("Could not load games. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchUnconsumedGames();
  }, [BACKEND, authHeaders, token]);

  // --- Consume action -> then show PC modal -------------------------------

  const handleConsume = async (item: GameItem) => {
    if (item.unit_index >= item.game_quantity) {
      console.warn("All units already consumed. Skipping.");
      return;
    }
    try {
      if (!token) {
        console.warn("No token found for operator.");
        return;
      }

      await postJson(`${BACKEND}/v1/admin/consumed-game/consume`, {
        transactionItemId: item.id,
        unit_index: item.unit_index,
        game_title: item.game_title,
      });

      // Remove that specific unit from the table immediately
      setUnconsumedGames((prev) => prev.filter((g) => !(g.id === item.id && g.unit_index === item.unit_index)));

      // Open modal + load PCs
      setSelectedItem(item);
      await fetchAvailablePCs(item.game_title);
      setSelectedPCId("");
    } catch (err) {
      console.error("Error consuming game:", err);
      setErrorMsg("Failed to mark as attended.");
    }
  };

  // --- Unlock selected PC --------------------------------------------------

  const handleOpenPc = async () => {
    if (!selectedItem || !selectedPCId) return;
    const gameDuration = selectedItem.transaction?.game_duration ?? selectedItem.game_duration ?? 6;
    const totalDuration = gameDuration + 3;

    // Prefer new route: /admin/pcs/:id/unlock
    try {
      console.log("Sending unlock with duration:", totalDuration);
      await postJson(`${BACKEND}/v1/admin/pcs/${encodeURIComponent(selectedPCId)}/unlock`, {
        transactionItemId: selectedItem.id,
        unit_index: selectedItem.unit_index,
        duration_minutes: totalDuration,
      });

      // Success → Close modal, clear selection
      setSelectedItem(null);
      setSelectedPCId("");
      return;
    } catch (err1) {
      // Fallback to legacy: /v1/admin/unlock
      try {
        console.log("Sending unlock with duration:", totalDuration);
        await postJson(`${BACKEND}/v1/admin/pcs/${selectedPCId}/unlock`, {
          pc_id: selectedPCId,
          pc_name: (availablePCs.find((p) => p.id === selectedPCId)?.title) || selectedPCId,
          duration_minutes: totalDuration,
          transactionItemId: selectedItem.id,
          unit_index: selectedItem.unit_index,
        });

        setSelectedItem(null);
        setSelectedPCId("");
      } catch (err2) {
        console.error("Failed to unlock PC:", err2);
        const e = err2 as AxiosError;
        setErrorMsg(e.response?.data ? JSON.stringify(e.response.data) : e.message);
      }
    }
  };

  // --- WebSocket (native) for live PC updates -----------------------------

  // --- WebSocket (native) for live PC updates -----------------------------
// --- WebSocket (native) for live PC updates -----------------------------
useEffect(() => {
  if (!BACKEND) return;

  let wsUrl: string;
  try {
    const u = new URL(BACKEND);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    wsUrl = u.origin;
  } catch {
    wsUrl = "ws://127.0.0.1:2024";
  }

  const ws = new WebSocket(wsUrl);
  wsRef.current = ws;

  ws.onopen = () => {
    console.log("📡 Dashboard connected to wsHub");
    ws.send(JSON.stringify({ type: "register_dashboard" }));
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);

      // 📥 Full state snapshot
      if (msg?.type === "init_state" && Array.isArray(msg.pcs)) {
        console.log("📥 Init PC state:", msg.pcs);
        setAvailablePCs(
          msg.pcs.map((pc: any) => ({
            id: String(pc.id),
            title: String(pc.title),
            isLocked: pc.status === "locked",
            isOnline: true, // assume online if sending status
            lastUnlockedAt: pc.busyUntil ? new Date(pc.busyUntil).toISOString() : null,
          }))
        );
      }

      // 🔄 Live updates
      if (msg?.type === "pc_update" && msg.pc) {
        console.log("🔄 PC update:", msg.pc);
        setAvailablePCs((prev) => {
          const exists = prev.find((p) => p.id === msg.pc.id);
          if (!exists) {
            // New PC registered after init
            return [...prev, {
              id: msg.pc.id,
              title: msg.pc.title,
              isLocked: msg.pc.status === "locked",
              isOnline: true,
              lastUnlockedAt: msg.pc.busyUntil ? new Date(msg.pc.busyUntil).toISOString() : null,
            }];
          }
          // Merge into existing PC row
          return prev.map((p) =>
            p.id === msg.pc.id
              ? {
                  ...p,
                  title: msg.pc.title,
                  isLocked: msg.pc.status === "locked",
                  lastUnlockedAt: msg.pc.busyUntil ? new Date(msg.pc.busyUntil).toISOString() : null,
                }
              : p
          );
        });
      }
    } catch (err) {
      console.warn("⚠️ Non-JSON WS message:", ev.data);
    }
  };

  ws.onclose = () => console.log("❌ Dashboard WS closed");

  return () => {
    ws.close();
    wsRef.current = null;
  };
}, [BACKEND]);
  // --- Row color ----------------------------------------------------------

  const getRowColor = (item: GameItem) => {
    const isPartial = item.unit_index < item.game_quantity - 1;
    return isPartial ? "#d4edda" : "#cce5ff"; // green for partial, blue for untouched
  };

  // --- Render -------------------------------------------------------------

  return (
    <div className="dashboard-container" style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Operator Dashboard</h2>
        <span className="status-badge">Live Updates Active</span>
      </header>

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      {loading ? (
        <div className="spinner">Loading Queue...</div>
      ) : groupedGames.length === 0 ? (
        <p className="no-data">No active games in the last 24 hours.</p>
      ) : (
        <div className="customer-list">
          {groupedGames.map(([username, games]) => (
            <div key={username} className="customer-card" style={{
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              marginBottom: "20px",
              overflow: "hidden",
              border: "1px solid #eee"
            }}>
              <div className="card-header" style={{
                background: "#f8f9fa",
                padding: "12px 20px",
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <strong style={{ fontSize: "1.1rem", color: "#333" }}>👤 {username}</strong>
                <span style={{ fontSize: "0.85rem", color: "#666" }}>
                  Last Order: {new Date(games[0].transaction_time).toLocaleTimeString()}
                </span>
              </div>
              
              <div className="card-body" style={{ padding: "0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody className="game-rows">
                    {games.map((item) => (
                      <tr key={`${item.id}-${item.unit_index}`} style={{ borderBottom: "1px solid #f1f1f1" }}>
                        <td style={{ padding: "12px 20px" }}>
                          <strong>{item.game_title}</strong>
                          <div style={{ fontSize: "0.8rem", color: "#888" }}>Unit #{item.unit_index + 1}</div>
                        </td>
                        <td style={{ padding: "12px 20px", textAlign: "right" }}>
                          <button 
                            className="btn-consume"
                            onClick={() => handleConsume(item)}
                            style={{
                              background: item.unit_index < item.game_quantity - 1 ? "#28a745" : "#007bff",
                              color: "white",
                              border: "none",
                              padding: "8px 16px",
                              borderRadius: "6px",
                              cursor: "pointer"
                            }}
                          >
                            Assign PC
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

        {selectedItem && (
          <div className="pc-select-modal">
            <h3>Select PC for {selectedItem.game_title}</h3>

            <select
              value={selectedPCId}
              onChange={(e) => setSelectedPCId(e.target.value)}
              style={{ minWidth: 320, padding: 8, marginBottom: 8 }}
            >
              <option value="">-- Select PC --</option>
              {availablePCs.map((pc) => (
                <option key={pc.id} value={pc.id}>
                  {pc.title}
                  {pc.isOnline === false ? " (Offline)" : ""}
                </option>
              ))}
            </select>

            {/* Simple badges */}
            {selectedPCId && (
              <div style={{ marginBottom: 8 }}>
                {(() => {
                  const pc = availablePCs.find((p) => p.id === selectedPCId);
                  if (!pc) return null;
                  return (
                    <div style={{ display: "flex", gap: 8 }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: pc.isOnline ? "#d1fae5" : "#fee2e2",
                          color: pc.isOnline ? "#065f46" : "#991b1b",
                          fontSize: 12,
                        }}
                      >
                        {pc.isOnline ? "Online" : "Offline"}
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: pc.isLocked ? "#e0e7ff" : "#fde68a",
                          color: pc.isLocked ? "#3730a3" : "#92400e",
                          fontSize: 12,
                        }}
                      >
                        {pc.isLocked ? "Locked" : "Unlocked"}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={!selectedPCId || availablePCs.find((p) => p.id === selectedPCId)?.isOnline === false}
                onClick={handleOpenPc}
              >
                Open PC
              </button>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setSelectedPCId("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
  );
};

export default OperatorDashboard;
