'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import type { ExportItem, ExportTab } from '@/lib/export-utils';
import { buildCSV, buildXLSXWorkbook } from '@/lib/export-utils';
import ExportTable from './ExportTable';

interface Props {
  tab: ExportTab;
  items: ExportItem[];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExportSection({ tab, items }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const allIds = new Set(items.map((i) => i.id));
      const allSelected = items.every((i) => prev.has(i.id));
      return allSelected ? new Set() : allIds;
    });
  }, [items]);

  const handleExportCSV = () => {
    const csv = buildCSV(items, tab);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-${tab}-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportXLSX = () => {
    const wb = buildXLSXWorkbook(items, tab);
    XLSX.writeFile(wb, `export-${tab}-${todayISO()}.xlsx`);
  };

  const handleMarkPaid = async () => {
    if (!paymentRef.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const tableParam = tab === 'rimborsi' ? 'expenses' : 'compensations';
      const res = await fetch('/api/export/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selected),
          payment_reference: paymentRef.trim(),
          table: tableParam,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Errore durante il salvataggio');
        return;
      }
      setShowModal(false);
      setPaymentRef('');
      setSelected(new Set());
      router.refresh();
    } catch {
      setError('Errore di rete. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const tabCls = (t: ExportTab) =>
    `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
      tab === t
        ? 'bg-blue-600 text-white'
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link href="?tab=occasionali" className={tabCls('occasionali')}>Occasionali</Link>
        <Link href="?tab=piva" className={tabCls('piva')}>P.IVA</Link>
        <Link href="?tab=rimborsi" className={tabCls('rimborsi')}>Rimborsi</Link>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleExportCSV}
          disabled={items.length === 0}
          className="rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-gray-100 transition"
        >
          Esporta CSV
        </button>
        <button
          onClick={handleExportXLSX}
          disabled={items.length === 0}
          className="rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-gray-100 transition"
        >
          Esporta XLSX
        </button>
        <button
          onClick={() => {
            setError(null);
            setShowModal(true);
          }}
          disabled={selected.size === 0}
          className="rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition"
        >
          Segna pagati ({selected.size})
        </button>

        {selected.size > 0 && (
          <span className="text-xs text-gray-500">
            {selected.size} su {items.length} selezionati
          </span>
        )}
      </div>

      {/* Table */}
      <ExportTable
        tab={tab}
        items={items}
        selected={selected}
        onToggle={handleToggle}
        onSelectAll={handleSelectAll}
      />

      {/* Mark-paid modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-gray-900 border border-gray-700 p-6 shadow-xl">
            <h2 className="text-base font-semibold text-gray-100 mb-1">
              Segna come pagati
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Stai per segnare <span className="font-medium text-gray-200">{selected.size}</span> record come pagati.
              Inserisci un riferimento di pagamento (es. numero bonifico, batch ID).
            </p>

            <label className="block text-xs text-gray-400 mb-1">
              Riferimento pagamento <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="es. BON-2026-001"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {error && (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setPaymentRef('');
                  setError(null);
                }}
                disabled={loading}
                className="rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 px-4 py-2 text-sm font-medium text-gray-200 transition"
              >
                Annulla
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={!paymentRef.trim() || loading}
                className="rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition"
              >
                {loading ? 'Salvataggio…' : 'Conferma pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
