'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  documentId: string;
}

export default function DocumentDeleteButton({ documentId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm('Eliminare definitivamente questo contratto? L\'azione è irreversibile.')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore eliminazione');
      router.push('/documenti');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto');
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <p className="mb-2 text-xs text-red-400">{error}</p>
      )}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="rounded-lg bg-red-900/40 hover:bg-red-800/60 border border-red-800/60 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-red-300 transition"
      >
        {loading ? 'Eliminazione…' : 'Elimina contratto'}
      </button>
    </div>
  );
}
