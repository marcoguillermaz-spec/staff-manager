'use client';

import type { ExportItem, ExportTab } from '@/lib/export-utils';

function formatImporto(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

interface Props {
  tab: ExportTab;
  items: ExportItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}

export default function ExportTable({ tab, items, selected, onToggle, onSelectAll }: Props) {
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center">
        <p className="text-sm text-gray-500">Nessun record in attesa di liquidazione.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="px-4 py-3 text-left">
              <input
                type="checkbox"
                aria-label="Seleziona tutti"
                checked={allSelected}
                onChange={onSelectAll}
                className="rounded border-gray-600 bg-gray-800 accent-blue-500"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Nome</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Cod. Fiscale</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">IBAN</th>
            {tab === 'occasionali' && (
              <>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">Community</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">Periodo</th>
              </>
            )}
            {tab === 'rimborsi' && (
              <>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">Categoria</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">Data spesa</th>
              </>
            )}
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Importo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {items.map((item) => (
            <tr
              key={item.id}
              className={`transition hover:bg-gray-800/50 cursor-pointer ${selected.has(item.id) ? 'bg-blue-900/20' : ''}`}
              onClick={() => onToggle(item.id)}
            >
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  aria-label={`Seleziona ${item.nome} ${item.cognome}`}
                  checked={selected.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  className="rounded border-gray-600 bg-gray-800 accent-blue-500"
                />
              </td>
              <td className="px-4 py-3 text-gray-200 font-medium">
                {item.nome} {item.cognome}
              </td>
              <td className="px-4 py-3 text-gray-400 hidden sm:table-cell font-mono text-xs">
                {item.codice_fiscale ?? '—'}
              </td>
              <td className="px-4 py-3 text-gray-400 hidden md:table-cell font-mono text-xs">
                {item.iban ?? '—'}
              </td>
              {tab === 'occasionali' && (
                <>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                    {item.community_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                    {item.periodo_riferimento ?? '—'}
                  </td>
                </>
              )}
              {tab === 'rimborsi' && (
                <>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                    {item.categoria ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell tabular-nums">
                    {item.data_spesa
                      ? new Date(item.data_spesa).toLocaleDateString('it-IT')
                      : '—'}
                  </td>
                </>
              )}
              <td className="px-4 py-3 text-right text-gray-200 font-medium tabular-nums">
                {formatImporto(item.importo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
