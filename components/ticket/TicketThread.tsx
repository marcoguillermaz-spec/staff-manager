import type { TicketStatus } from '@/lib/types';
import { TICKET_STATUS_LABELS } from '@/lib/types';

export type MessageDisplay = {
  id: string;
  author_label: string;
  is_own: boolean;
  message: string;
  attachment_name: string | null;
  signed_attachment_url: string | null;
  created_at: string;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TicketThread({
  messages,
  ticketStato,
}: {
  messages: MessageDisplay[];
  ticketStato: TicketStatus;
}) {
  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center">
          <p className="text-sm text-gray-500">
            Nessun messaggio ancora. Aggiungi il primo messaggio qui sotto.
          </p>
        </div>
      ) : (
        messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.is_own
                ? 'bg-blue-950/40 border-blue-800/40'
                : 'bg-gray-900 border-gray-800'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold ${m.is_own ? 'text-blue-300' : 'text-gray-400'}`}>
                {m.author_label}
              </span>
              <span className="text-xs text-gray-600">{formatDateTime(m.created_at)}</span>
            </div>

            {/* Message body */}
            <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{m.message}</p>

            {/* Attachment */}
            {m.attachment_name && (
              <div className="mt-3">
                {m.signed_attachment_url ? (
                  <a
                    href={m.signed_attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    📎 {m.attachment_name}
                  </a>
                ) : (
                  <span className="text-xs text-gray-500">📎 {m.attachment_name}</span>
                )}
              </div>
            )}
          </div>
        ))
      )}

      {ticketStato === 'CHIUSO' && (
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4 text-center">
          <p className="text-sm text-gray-500">
            Questo ticket è <span className="font-medium text-gray-400">{TICKET_STATUS_LABELS.CHIUSO}</span>. Non è possibile aggiungere nuovi messaggi.
          </p>
        </div>
      )}
    </div>
  );
}
