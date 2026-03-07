import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./CustomerPortal.css";

type CustomerUser = {
  id?: string;
  username?: string;
  phone?: string;
  email?: string;
};

type InsightsData = {
  customer: CustomerUser;
  summary: {
    totalSpent: number;
    loyaltyPoints: number;
    tier: string;
    totalTransactions: number;
  };
  monthlySpend: Array<{ month: string; amount: number }>;
  recentTransactions: Array<{
    id: string;
    merchantReference?: string;
    amount: number;
    date: string;
  }>;
};

const CUSTOMER_TOKEN_KEY = "customerToken";
const MILESTONE_STEP = 1000;

const formatMonth = (value: string) => {
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString(undefined, { month: "short", year: "2-digit" });
};

const CustomerPortal: React.FC = () => {
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [insightsError, setInsightsError] = useState("");
  const [insights, setInsights] = useState<InsightsData | null>(null);

  const apiBase = process.env.REACT_APP_BACKEND_URL;

  const loadInsights = useCallback(
    async (token: string) => {
      setLoading(true);
      setInsightsError("");
      try {
        const response = await axios.get(`${apiBase}/v1/customer/insights`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.data?.success) {
          throw new Error(response.data?.message || "Unable to load customer insights");
        }

        setInsights(response.data.data);
      } catch (error: any) {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        setInsights(null);
        setInsightsError(error.response?.data?.message || error.message || "Unable to load customer insights");
      } finally {
        setLoading(false);
      }
    },
    [apiBase]
  );

  useEffect(() => {
    const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    if (token) {
      loadInsights(token);
    }
  }, [loadInsights]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError("");
    setInsightsError("");
    setLoading(true);

    try {
      const response = await axios.post(`${apiBase}/v1/customer/login`, {
        phone,
        username: username || undefined,
      });

      if (!response.data?.success || !response.data?.data?.token) {
        throw new Error(response.data?.message || "Login failed");
      }

      const token = response.data.data.token;
      localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
      await loadInsights(token);
    } catch (error: any) {
      setAuthError(error.response?.data?.message || error.message || "Unable to login");
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    setInsights(null);
    setPhone("");
    setUsername("");
    setAuthError("");
    setInsightsError("");
  };

  const chartData = useMemo(() => {
    return (insights?.monthlySpend || []).map((entry) => ({
      ...entry,
      label: formatMonth(entry.month),
    }));
  }, [insights]);

  const points = Number(insights?.summary.loyaltyPoints || 0);
  const currentBandStart = Math.floor(points / MILESTONE_STEP) * MILESTONE_STEP;
  const nextMilestone = currentBandStart + MILESTONE_STEP;
  const progressPercent = Math.min(100, Math.round(((points - currentBandStart) / MILESTONE_STEP) * 100));

  if (!insights) {
    return (
      <div className="xp-portal">
        <div className="xp-backdrop" />
        <div className="xp-login-card">
          <div className="xp-login-header">
            <p className="xp-kicker">Immersia Reward Grid</p>
            <h1>Player Command Center</h1>
            <p className="xp-subtitle">
              Track your spending timeline, loyalty points, and reward milestones.
            </p>
          </div>

          <form onSubmit={handleLogin} className="xp-form">
            <label htmlFor="phone">Registered Phone Number</label>
            <input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="08000000000"
              required
            />

            <label htmlFor="username">Username (optional)</label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Player nickname"
            />

            <button type="submit" disabled={loading}>
              {loading ? "Authenticating..." : "Enter Portal"}
            </button>
          </form>
          {authError && <p className="xp-error">{authError}</p>}
          {insightsError && <p className="xp-error">{insightsError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="xp-portal">
      <div className="xp-backdrop" />
      <div className="xp-dashboard">
        <div className="xp-topbar">
          <div>
            <p className="xp-kicker">Player Profile</p>
            <h1>{insights.customer?.username || "Player"} Mission Board</h1>
            <p className="xp-subtitle">{insights.customer?.phone}</p>
          </div>
          <button className="xp-logout" onClick={handleLogout}>
            Exit
          </button>
        </div>

        <div className="xp-stats-grid">
          <article className="xp-stat-card">
            <span>Total Spend</span>
            <strong>N{Number(insights.summary.totalSpent || 0).toLocaleString()}</strong>
          </article>
          <article className="xp-stat-card">
            <span>Loyalty Points</span>
            <strong>{points.toLocaleString()}</strong>
          </article>
          <article className="xp-stat-card">
            <span>Loyalty Tier</span>
            <strong>{insights.summary.tier}</strong>
          </article>
          <article className="xp-stat-card">
            <span>Sessions</span>
            <strong>{insights.summary.totalTransactions}</strong>
          </article>
        </div>

        <section className="xp-mission-card">
          <div className="xp-mission-copy">
            <h2>Milestone Progress</h2>
            <p>
              Next reward unlock at <strong>{nextMilestone}</strong> points.
            </p>
            <p>
              Keep playing to earn more points and unlock free-game milestones every 1000 points.
            </p>
          </div>
          <div className="xp-progress-wrap">
            <p>{progressPercent}% complete</p>
            <div className="xp-progress-track">
              <div className="xp-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </section>

        <section className="xp-chart-card">
          <h2>Spend Timeline</h2>
          <div className="xp-chart-wrap">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <defs>
                  <linearGradient id="xpLineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00D0FF" />
                    <stop offset="100%" stopColor="#5B8BFF" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#1d2b52" />
                <XAxis dataKey="label" stroke="#9bb0dd" tickLine={false} axisLine={false} />
                <YAxis stroke="#9bb0dd" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0a1430", border: "1px solid #2f4a85", color: "#dbeafe" }}
                  labelStyle={{ color: "#9bdfff" }}
                  formatter={(value) => [`N${Number(value).toLocaleString()}`, "Spend"]}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="url(#xpLineGradient)"
                  strokeWidth={3}
                  dot={{ r: 3, stroke: "#09142c", strokeWidth: 2, fill: "#00D0FF" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="xp-table-card">
          <h2>Recent Sessions</h2>
          <div className="xp-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {insights.recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No sessions yet.</td>
                  </tr>
                ) : (
                  insights.recentTransactions.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.date).toLocaleString()}</td>
                      <td>N{Number(row.amount || 0).toLocaleString()}</td>
                      <td>{row.merchantReference || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CustomerPortal;
