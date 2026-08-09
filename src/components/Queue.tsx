import { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";

// Define types for queue data
interface QueueEntry {
  id: string;
  game_id: string;
  game_title: string;
  pc_id?: string;
  pc_title?: string;
  username: string;
  end_time: string;
  status: "waiting" | "active";
  next_users?: { username: string }[];
}

// Connect to the Socket.IO server
const socket = io(`${process.env.REACT_APP_BACKEND_URL}`, {
  transports: ["websocket", "polling"]
});

const QueuePage: React.FC = () => {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // Value is unread — the ticking state exists to re-render the countdown cells.
  const [, setTimeLeft] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchQueueData();

    socket.on("queueUpdate", (updatedQueue: QueueEntry[] | undefined) => {
      console.log("Received queue update:", updatedQueue);
      setQueue(updatedQueue || []);
    });

    const interval = setInterval(() => {
      updateTimeLeft();
    }, 1000);

    return () => {
      clearInterval(interval);
      socket.off("queueUpdate");
    };
  }, []);

  const fetchQueueData = async () => {
    try {
      const response = await axios.get<QueueEntry[]>(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/queue`);
      console.log("Fetched queue data:", response.data);
      setQueue(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching queue:", error);
      setQueue([]);
      setLoading(false);
    }
  };

  const updateTimeLeft = () => {
    const newTimeLeft: { [key: string]: string } = {};
    queue.forEach((entry) => {
      newTimeLeft[entry.id] = calculateTimeLeft(entry.end_time);
    });
    setTimeLeft(newTimeLeft);
  };

  const calculateTimeLeft = (end_time: string): string => {
    if (!end_time) return "00:00";
    const now = new Date().getTime();
    const end = new Date(end_time).getTime();
    const diff = end - now;
    if (diff <= 0) return "00:00";
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getColor = (time: string): string => {
    const [minutes, seconds] = time.split(":").map(Number);
    const totalSeconds = minutes * 60 + seconds;
    if (totalSeconds < 30) return "text-red-500";
    if (totalSeconds < 120) return "text-yellow-500";
    return "text-green-400";
  };

  // Show all active or waiting entries
  const visibleQueue = queue.filter(
    (entry) => entry.status === "active" || entry.status === "waiting"
  );

  const calculateWaitingTime = (index: number): string => {
    let totalWaitingTime = 0;
    for (let i = 0; i < index; i++) {
      const timeLeft = calculateTimeLeft(queue[i].end_time);
      if (timeLeft !== "00:00") {
        const [minutes, seconds] = timeLeft.split(":").map(Number);
        totalWaitingTime += minutes * 60 + seconds;
      }
    }
    const minutes = Math.floor(totalWaitingTime / 60);
    const seconds = totalWaitingTime % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Game Queue</h1>

      {loading ? (
        <p>Loading queue...</p>
      ) : visibleQueue.length === 0 ? (
        <p>No active games.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleQueue.map((entry, index) => {
            const time = calculateTimeLeft(entry.end_time);
            console.log("Rendering queue item:", entry);

            return (
              <div key={entry.id} className="bg-gray-800 p-4 rounded-lg shadow-lg">
                <h2 className="text-lg font-semibold">{entry.game_title}</h2>
                <p>PC: {entry.pc_title || entry.pc_id}</p>
                <p>Player: {entry.username}</p>
                <p>Status: {entry.status}</p>
                <p className={getColor(time)}>Time Left: {time}</p>
                <p className="text-yellow-400">
                  {entry.status === "waiting"
                    ? `Waiting - Est. Time: ${calculateWaitingTime(index)}`
                    : "In Progress"}
                </p>

                {Array.isArray(entry.next_users) && entry.next_users.length > 0 && (
                  <div className="mt-3">
                    <h3 className="text-sm font-bold">Next in line:</h3>
                    {entry.next_users.map((user, i) => (
                      <p key={i} className="text-gray-300">
                        {user.username}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QueuePage;
