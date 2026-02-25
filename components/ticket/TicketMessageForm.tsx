'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { TicketStatus, Role } from '@/lib/types';
import { TICKET_STATUS_LABELS } from '@/lib/types';

const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  APERTO:         ['IN_LAVORAZIONE', 'CHIUSO'],
  IN_LAVORAZIONE: ['APERTO', 'CHIUSO'],
  CHIUSO:         [],
};

export default function TicketMessageForm({
  ticketId,
  ticketStato,
  currentUserRole,
}: {
  ticketId: string;
  ticketStato: TicketStatus;
  currentUserRole: Role;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const canChangeStatus = ['amministrazione', 'responsabile'].includes(currentUserRole);
  const nextStati = canChangeStatus ? STATUS_TRANSITIONS[ticketStato] : [];

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      setError('Inserisci un messaggio.');
      return;
    }
    setSending(true);
    setError(null);

    const fd = new FormData();
    fd.append('message', message.trim());
    const file = fileRef.current?.files?.[0];
    if (file) fd.append('file', file);

    const res = await fetch(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: fd,
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Errore durante l\'invio del messaggio.');
      setSending(false);
      return;
    }

    setMessage('');
    setFileName(null);
    if (fileRef.current) fileRef.current.value = '';
    setSending(false);
    router.refresh();
  }

  async function handleStatusChange(newStato: TicketStatus) {
    setStatusLoading(true);
    setError(null);

    const res = await fetch(`/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stato: newStato }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Errore durante il cambio di stato.');
    }

    setStatusLoading(false);
    router.refresh();
  }

  if (ticketStato === 'CHIUSO') return null;

  return (
    <div className="space-y-4">
      {/* Status change buttons (admin/responsabile only) */}
      {canChangeStatus && nextStati.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">Cambia stato:</span>
          {nextStati.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={statusLoading}
              className="rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-gray-300 transition"
            >
              {statusLoading ? '…' : `→ ${TICKET_STATUS_LABELS[s]}`}
            </button>
          ))}
        </div>
      )}

      {/* Reply form */}
      <form onSubmit={handleSend} className="space-y-3">
        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Scrivi un messaggio…"
          rows={4}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* File attachment */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="ticket-file"
              className="cursor-pointer rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-xs text-gray-400 transition"
            >
              📎 Allega file
            </label>
            <input
              id="ticket-file"
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            {fileName && (
              <span className="text-xs text-gray-400 max-w-[160px] truncate">{fileName}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition"
          >
            {sending ? 'Invio…' : 'Invia risposta'}
          </button>
        </div>
      </form>
    </div>
  );
}
