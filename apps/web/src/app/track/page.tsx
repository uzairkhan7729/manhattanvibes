'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TrackEntryPage(): JSX.Element {
  const [id, setId] = useState('');
  const router = useRouter();
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Track order</h1>
      <p className="text-sm text-slate-500 mb-4">Enter the order id you received at checkout.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (id) router.push(`/track/${id}`); }} className="flex gap-2">
        <input className="input" value={id} onChange={(e) => setId(e.target.value.trim())} placeholder="Order id" />
        <button className="btn-primary" type="submit">Track</button>
      </form>
    </div>
  );
}
