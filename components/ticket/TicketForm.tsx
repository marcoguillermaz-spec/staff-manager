'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TICKET_CATEGORIES } from '@/lib/types';

export default function TicketForm() {
  const router = useRouter();
  const [categoria, setCategoria] = useState('');
  const [oggetto, setOggetto] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoria || !oggetto.trim()) {
      setError('Categoria e oggetto sono obbligatori.');
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoria,
        oggetto: oggetto.trim(),
        messaggio: messaggio.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Errore durante la creazione del ticket.');
      setLoading(false);
      return;
    }

    router.push(`/ticket/${data.ticket.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Categoria */}
      <div className="space-y-1.5">
        <label htmlFor="categoria" className="block text-sm font-medium text-gray-300">
          Categoria <span className="text-red-400">*</span>
        </label>
        <select
          id="categoria"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="" disabled>Seleziona una categoria</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Oggetto */}
      <div className="space-y-1.5">
        <label htmlFor="oggetto" className="block text-sm font-medium text-gray-300">
          Oggetto <span className="text-red-400">*</span>
        </label>
        <input
          id="oggetto"
          type="text"
          value={oggetto}
          onChange={(e) => setOggetto(e.target.value)}
          placeholder="Descrivi brevemente il problema o la richiesta"
          maxLength={200}
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Messaggio iniziale */}
      <div className="space-y-1.5">
        <label htmlFor="messaggio" className="block text-sm font-medium text-gray-300">
          Messaggio iniziale <span className="text-gray-500 font-normal">(opzionale)</span>
        </label>
        <textarea
          id="messaggio"
          value={messaggio}
          onChange={(e) => setMessaggio(e.target.value)}
          placeholder="Aggiungi dettagli, contesto o eventuali allegati potranno essere aggiunti dopo la creazione..."
          rows={5}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-2 text-sm font-medium text-white transition"
        >
          {loading ? 'Apertura…' : 'Apri ticket'}
        </button>
      </div>
    </form>
  );
}
