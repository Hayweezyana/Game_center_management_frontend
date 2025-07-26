import React, { useEffect, useState } from "react";
import PcLockScreen from "./PcLockScreen";
import axios from "axios";
import { loadPcConfig } from "./utils/loadPcConfig";

const  pc_id = loadPcConfig();


const GamePCApp: React.FC = () => {
  const [locked, setLocked] = useState<boolean>(window.pcLock.get());

  const updateLock = (val: boolean) => {
    setLocked(val);
    window.pcLock.set(val);
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`/api/pc/${pc_id}`);
      updateLock(res.data.data.locked);
    } catch {
      console.warn("Offline or unreachable → maintaining local lock state");
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    window.pcLock.subscribe((val) => setLocked(val));
    return () => clearInterval(interval);
  }, []);

  return locked ? <PcLockScreen /> : <div>🎮 Game Loading</div>;
  if (locked === undefined) return <div>Loading...</div>;
};



export default GamePCApp;
