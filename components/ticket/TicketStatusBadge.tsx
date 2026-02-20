import type { TicketStatus } from '@/lib/types';
import { TICKET_STATUS_LABELS } from '@/lib/types';

const COLOR: Record<TicketStatus, string> = {
  APERTO:         'text-green-300 bg-green-900/30',
  IN_LAVORAZIONE: 'text-yellow-300 bg-yellow-900/30',
  CHIUSO:         'text-gray-400 bg-gray-800',
};

export default function TicketStatusBadge({ stato }: { stato: TicketStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR[stato]}`}>
      {TICKET_STATUS_LABELS[stato]}
    </span>
  );
}
