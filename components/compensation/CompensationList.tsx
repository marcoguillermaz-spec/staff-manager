'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Compensation, CompensationStatus, Role } from '@/lib/types';
import { COMPENSATION_STATUS_LABELS } from '@/lib/types';
import StatusBadge from './StatusBadge';

type CompensationRow = Compensation & { communities?: { name: string } | null };

const ALL_STATI: CompensationStatus[] = [
  'IN_ATTESA',
  'APPROVATO',
  'RIFIUTATO',
  'LIQUIDATO',
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(c: CompensationRow) {
  const amount = c.importo_netto ?? c.importo_lordo;
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}

export default function CompensationList({
  compensations,
  role,
}: {
  compensations: CompensationRow[];
  role: Role;
}) {
  const [filterStato, setFilterStato] = useState<CompensationStatus | 'ALL'>('ALL');

  const filtered = filterStato === 'ALL'
    ? compensations
    : compensations.filter((c) => c.stato === filterStato);

  return (
    <div className="space-y-4">
      {/* Header */}
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
              {COMPENSATION_STATUS_LABELS[s]}
            </button>
          ))}
        </div>

      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center">
          <p className="text-sm text-gray-500">Nessun compenso trovato.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Stato</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Community</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Periodo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Importo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 hidden lg:table-cell">Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3">
                    <StatusBadge stato={c.stato} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {c.communities?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">
                    {c.periodo_riferimento ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200 font-medium tabular-nums">
                    {formatCurrency(c)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell tabular-nums">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/compensi/${c.id}`}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Dettaglio →
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
