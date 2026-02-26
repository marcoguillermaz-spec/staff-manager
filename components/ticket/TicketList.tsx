'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TicketStatus, Role } from '@/lib/types';
import { TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from '@/lib/types';
import TicketStatusBadge from './TicketStatusBadge';

type TicketRow = {
  id: string;
  categoria: string;
  oggetto: string;
  stato: TicketStatus;
  priority: string;
  created_at: string;
  creator_name?: string | null;
};

const ALL_STATI: TicketStatus[] = ['APERTO', 'IN_LAVORAZIONE', 'CHIUSO'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const PRIORITY_DOT: Record<string, string> = {
  ALTA:    'bg-red-500',
  NORMALE: 'bg-yellow-500',
  BASSA:   'bg-gray-500',
};

export default function TicketList({
  tickets,
  role,
}: {
  tickets: TicketRow[];
  role: Role;
}) {
  const [filterStato, setFilterStato] = useState<TicketStatus | 'ALL'>('ALL');

  const isManager = ['amministrazione', 'responsabile_compensi'].includes(role);

  const filtered = filterStato === 'ALL'
    ? tickets
    : tickets.filter((t) => t.stato === filterStato);

  return (
    <div className="space-y-4">
      {/* Filter + action bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            onClick={() => setFilterStato('ALL')}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
              filterStato === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Tutti
          </button>
          {ALL_STATI.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStato(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
                filterStato === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {TICKET_STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <Link
          href="/ticket/nuova"
          className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition"
        >
          Nuovo ticket
        </Link>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center">
          <p className="text-sm text-gray-500">Nessun ticket trovato.</p>
          <Link href="/ticket/nuova" className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300">
            Apri il primo ticket →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Stato</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Priorità</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Oggetto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Categoria</th>
                {isManager && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">
                    Collaboratore
                  </th>
                )}
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 hidden lg:table-cell">Aperto il</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3">
                    <TicketStatusBadge stato={t.stato} />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[t.priority] ?? 'bg-gray-500'}`} />
                      {TICKET_PRIORITY_LABELS[t.priority as keyof typeof TICKET_PRIORITY_LABELS] ?? t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-200 max-w-xs truncate">{t.oggetto}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{t.categoria}</td>
                  {isManager && (
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                      {t.creator_name ?? '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell tabular-nums">
                    {formatDate(t.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/ticket/${t.id}`}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Apri →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
