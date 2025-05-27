import React, { useState } from 'react';
import axios from 'axios';

interface LocalTransaction {
  id: string;
  merchantReference: string;
  transactionType: string;
  terminalSerial: string;
  paymentMethod: string;
  amount: number;
  provider_metadata: any;
  created_at: string;
}

interface MoniepointTransaction {
  status: string;
  amount: number;
  transactionReference: string;
  time: string;
  [key: string]: any;
}

export default function MoniepointDashboard() {
  const [merchantReference, setMerchantRef] = useState('');
  const [localData, setLocalData] = useState<LocalTransaction | null>(null);
  const [moniepointData, setMoniepointData] = useState<MoniepointTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTransaction = async () => {
    if (!merchantReference.trim()) return;
    setLoading(true);
    setError('');
    setLocalData(null);
    setMoniepointData(null);

    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/admin/moniepoint?merchantReference=${merchantReference}`);
      setLocalData(res.data.local);
      setMoniepointData(res.data.moniepoint);
    } catch (err: any) {
      console.error(err);
      setError('Transaction lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Moniepoint Transaction Dashboard</h1>
      
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Enter Merchant Reference"
          value={merchantReference}
          onChange={(e) => setMerchantRef(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <button
          onClick={fetchTransaction}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {(localData || moniepointData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {localData && (
            <div className="border rounded p-4 shadow">
              <h2 className="font-bold text-lg mb-2">Local Database</h2>
              <p><strong>Type:</strong> {localData.transactionType}</p>
              <p><strong>Terminal:</strong> {localData.terminalSerial}</p>
              <p><strong>Method:</strong> {localData.paymentMethod}</p>
              <p><strong>Amount:</strong> ₦{localData.amount}</p>
              <p><strong>Date:</strong> {new Date(localData.created_at).toLocaleString()}</p>
              <p><strong>Metadata:</strong> <pre className="text-xs">{JSON.stringify(localData.provider_metadata, null, 2)}</pre></p>
            </div>
          )}

          {moniepointData && (
            <div className="border rounded p-4 shadow">
              <h2 className="font-bold text-lg mb-2">Moniepoint API</h2>
              <p><strong>Status:</strong> {moniepointData.status}</p>
              <p><strong>Amount:</strong> ₦{moniepointData.amount}</p>
              <p><strong>Reference:</strong> {moniepointData.transactionReference}</p>
              <p><strong>Time:</strong> {new Date(moniepointData.time).toLocaleString()}</p>
              <p><strong>Raw:</strong> <pre className="text-xs">{JSON.stringify(moniepointData, null, 2)}</pre></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
