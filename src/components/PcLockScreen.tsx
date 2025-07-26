import React from "react";

const PcLockScreen: React.FC = () => {
  return (
    <div className="h-screen w-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">🔒 PC Locked</h1>
        <p>Please make payment at the front desk to unlock this PC.</p>
      </div>
    </div>
  );
};

export default PcLockScreen;
