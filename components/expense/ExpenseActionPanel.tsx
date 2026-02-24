'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role, ExpenseStatus } from '@/lib/types';
import type { ExpenseAction } from '@/lib/expense-transitions';
import { canExpenseTransition } from '@/lib/expense-transitions';

interface ExpenseActionPanelProps {
  expenseId: string;
  stato: ExpenseStatus;
  role: Role;
}

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

export default function ExpenseActionPanel({ expenseId, stato, role }: ExpenseActionPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Integration modal state
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [integrationNote, setIntegrationNote] = useState('');

  // Mark paid modal
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');

  const perform = async (action: ExpenseAction, extra?: Record<string, unknown>) => {
    setLoading(action);
    setError(null);

    const res = await fetch(`/api/expenses/${expenseId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });

    const data = await res.json();
    setLoading(null);

    if (!res.ok) {
      setError(data.error ?? 'Errore durante la transizione');
      return;
    }

    router.refresh();
  };

  const actions: Array<{
    action: ExpenseAction;
    label: string;
    variant: 'primary' | 'danger' | 'secondary';
    onClick: () => void;
  }> = [];

  if (canExpenseTransition(role, stato, 'resubmit').ok) {
    actions.push({ action: 'resubmit', label: 'Ri-invia', variant: 'primary', onClick: () => perform('resubmit') });
  }
  if (canExpenseTransition(role, stato, 'approve_manager').ok) {
    actions.push({ action: 'approve_manager', label: 'Pre-approva', variant: 'primary', onClick: () => perform('approve_manager') });
  }
  if (canExpenseTransition(role, stato, 'request_integration').ok) {
    actions.push({ action: 'request_integration', label: 'Richiedi integrazioni', variant: 'secondary', onClick: () => setShowIntegrationModal(true) });
  }
  if (canExpenseTransition(role, stato, 'reject_manager').ok) {
    actions.push({ action: 'reject_manager', label: 'Rifiuta', variant: 'danger', onClick: () => perform('reject_manager') });
  }
  if (canExpenseTransition(role, stato, 'approve_admin').ok) {
    actions.push({ action: 'approve_admin', label: 'Approva', variant: 'primary', onClick: () => perform('approve_admin') });
  }
  if (canExpenseTransition(role, stato, 'reject').ok) {
    actions.push({ action: 'reject', label: 'Rifiuta', variant: 'danger', onClick: () => perform('reject') });
  }
  if (canExpenseTransition(role, stato, 'mark_paid').ok) {
    actions.push({ action: 'mark_paid', label: 'Segna come pagato', variant: 'primary', onClick: () => setShowPaidModal(true) });
  }

  if (actions.length === 0) return null;

  const btnClass = (v: 'primary' | 'danger' | 'secondary') => {
    if (v === 'primary') return 'rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50';
    if (v === 'danger') return 'rounded-lg bg-red-700 hover:bg-red-600 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50';
    return 'rounded-lg border border-gray-700 hover:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition disabled:opacity-50';
  };

  return (
    <>
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Azioni</p>

        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.action}
              onClick={a.onClick}
              disabled={loading !== null}
              className={btnClass(a.variant)}
            >
              {loading === a.action ? 'Attendere…' : a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Integration modal */}
      {showIntegrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-gray-100">Richiedi integrazioni</h3>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Nota dettagliata
                <span className="text-gray-600 ml-1">(min 20 caratteri)</span>
              </label>
              <textarea
                value={integrationNote}
                onChange={(e) => setIntegrationNote(e.target.value)}
                rows={4}
                placeholder="Descrivi nel dettaglio cosa manca o cosa va corretto…"
                className={inputCls}
              />
              <p className={`text-xs mt-1 ${integrationNote.trim().length >= 20 ? 'text-gray-600' : 'text-yellow-600'}`}>
                {integrationNote.trim().length}/20 caratteri minimi
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowIntegrationModal(false); setIntegrationNote(''); setError(null); }}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition"
              >
                Annulla
              </button>
              <button
                disabled={integrationNote.trim().length < 20 || loading !== null}
                onClick={async () => {
                  await perform('request_integration', { note: integrationNote });
                  setShowIntegrationModal(false);
                  setIntegrationNote('');
                }}
                className="rounded-lg bg-yellow-700 hover:bg-yellow-600 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              >
                {loading === 'request_integration' ? 'Attendere…' : 'Invia richiesta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark paid modal */}
      {showPaidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-gray-100">Segna come pagato</h3>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Riferimento pagamento
                <span className="text-gray-600 ml-1">(opzionale)</span>
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Es. CRO, numero bonifico…"
                className={inputCls}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowPaidModal(false); setPaymentReference(''); setError(null); }}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition"
              >
                Annulla
              </button>
              <button
                disabled={loading !== null}
                onClick={async () => {
                  await perform('mark_paid', { payment_reference: paymentReference || undefined });
                  setShowPaidModal(false);
                  setPaymentReference('');
                }}
                className="rounded-lg bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              >
                {loading === 'mark_paid' ? 'Attendere…' : 'Conferma pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
