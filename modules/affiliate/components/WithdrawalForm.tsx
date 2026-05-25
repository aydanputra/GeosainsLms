"use client";

import { useState } from 'react';

export default function WithdrawalForm({ balance, onSuccess }: { balance: number, onSuccess?: () => void }) {
  const [amount, setAmount] = useState<number>(50000);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/affiliate/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note }),
      });

      if (res.ok) {
        alert('Withdrawal requested successfully');
        onSuccess?.();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to request withdrawal');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border mt-6">
      <h3 className="text-lg font-bold mb-4">Request Withdrawal</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Amount (IDR)</label>
          <input
            type="number"
            min="50000"
            max={balance}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <p className="text-xs text-gray-500 mt-1">Minimum: IDR 50,000 | Available: IDR {balance.toLocaleString()}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Bank Details / Note</label>
          <textarea
            required
            placeholder="Bank Name, Account Number, Account Holder Name"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={loading || balance < 50000}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Request Withdrawal'}
        </button>
      </form>
    </div>
  );
}
