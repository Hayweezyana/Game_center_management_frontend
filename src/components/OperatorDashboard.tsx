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

  const getJson = async <T,>(url: string, params?: Record<string, any>) => {
    const res = await axios.get<T>(url, { params, headers: authHeaders });
    return res.data;
  };

  const postJson = async <T,>(url: string, body?: any) => {
    const res = await axios.post<T>(url, body ?? {}, { headers: authHeaders });
    return res.data;
  };

  const normalizePcList = (data: any): PcRow[] => {
    // Accept both [] and { pcs: [] }
    const arr = Array.isArray(data) ? data : Array.isArray(data?.pcs) ? data.pcs : [];
    return (arr as any[]).map((pc) => ({
      id: String(pc.id),
      title: String(pc.title ?? pc.name ?? pc.pc_name ?? pc.id),
      isLocked: typeof pc.isLocked === "boolean" ? pc.isLocked : typeof pc.locked === "boolean" ? pc.locked : undefined,
      isOnline: typeof pc.isOnline === "boolean" ? pc.isOnline : undefined,
      currentGame: pc.currentGame ?? null,
      lastUnlockedAt: pc.last_unlocked_at ?? pc.lastUnlockedAt ?? null,
    }));
  };

  const fetchAvailablePCs = async (gameTitle?: string) => {
    setErrorMsg(null);
    // Try new route first: /admin/available-pcs (no /v1)
    try {
      const data = await getJson<any>(`${BACKEND}/admin/available-pcs`, gameTitle ? { game_title: gameTitle } : undefined);
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
          const hours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          return hours <= 24;
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
      await postJson(`${BACKEND}v1/admin/pcs/${encodeURIComponent(selectedPCId)}/unlock`, {
        // optional body, your server ignores it currently
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

  useEffect(() => {
  if (!BACKEND) return;

  // Derive ws(s) URL
  let wsUrl: string;
  try {
    const u = new URL(BACKEND);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    wsUrl = u.origin; // only domain, no /path
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
      if (msg?.type === "pc_update") {
        // Merge updated PC status into state
        setAvailablePCs((prev) => {
          const exists = prev.find((p) => p.id === msg.pc.id);
          if (!exists) return prev;
          return prev.map((p) => (p.id === msg.pc.id ? { ...p, ...msg.pc } : p));
        });
      }
    } catch {
      /* ignore non-JSON */
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
    <div>
      <div style={{ padding: "1rem" }}>
        <h2>Operator Dashboard</h2>

        {errorMsg && (
          <div className="error-banner" style={{ marginBottom: 12, color: "#b00020" }}>
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className="spinner">Loading...</div>
        ) : unconsumedGames.length === 0 ? (
          <p>No games to consume at the moment.</p>
        ) : (
          <table border={1} cellPadding={10} style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Game</th>
                <th>Transaction Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {unconsumedGames.map((item) => (
                <tr key={`${item.id}-${item.unit_index}`} style={{ backgroundColor: getRowColor(item) }}>
                  <td>{item.username}</td>
                  <td>
                    {item.game_title} (Unit #{item.unit_index + 1})
                  </td>
                  <td>{new Date(item.transaction_time).toLocaleString()}</td>
                  <td>
                    <button onClick={() => handleConsume(item)} disabled={loading}>
                      Mark as Attended
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  );
};

export default OperatorDashboard;
