'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Expense, ExpenseStatus, Role } from '@/lib/types';
import { EXPENSE_STATUS_LABELS } from '@/lib/types';
import StatusBadge from '@/components/compensation/StatusBadge';

const ALL_STATI: ExpenseStatus[] = [
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function ExpenseList({
  expenses,
  role,
}: {
  expenses: Expense[];
  role: Role;
}) {
  const [filterStato, setFilterStato] = useState<ExpenseStatus | 'ALL'>('ALL');

  const filtered = filterStato === 'ALL'
    ? expenses
    : expenses.filter((e) => e.stato === filterStato);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
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
              {EXPENSE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {role === 'collaboratore' && (
          <Link
            href="/rimborsi/nuova"
            className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition"
          >
            Nuovo rimborso
          </Link>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center">
          <p className="text-sm text-gray-500">Nessun rimborso trovato.</p>
          {role === 'collaboratore' && (
            <Link href="/rimborsi/nuova" className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300">
              Crea la prima richiesta →
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Stato</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Categoria</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Data spesa</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Importo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 hidden lg:table-cell">Inviato il</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3">
                    <StatusBadge stato={e.stato} />
                  </td>
                  <td className="px-4 py-3 text-gray-300">{e.categoria}</td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">
                    {formatDate(e.data_spesa)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200 font-medium tabular-nums">
                    {formatCurrency(e.importo)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell tabular-nums">
                    {formatDate(e.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/rimborsi/${e.id}`}
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
