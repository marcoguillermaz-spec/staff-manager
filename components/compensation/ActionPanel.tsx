'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role, CompensationStatus } from '@/lib/types';
import type { CompensationAction } from '@/lib/compensation-transitions';
import { canTransition } from '@/lib/compensation-transitions';

interface ActionPanelProps {
  compensationId: string;
  stato: CompensationStatus;
  role: Role;
}

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

export default function ActionPanel({ compensationId, stato, role }: ActionPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  // Mark liquidated modal
  const [showLiquidatedModal, setShowLiquidatedModal] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');

  const perform = async (action: CompensationAction, extra?: Record<string, unknown>) => {
    setLoading(action);
    setError(null);

    const res = await fetch(`/api/compensations/${compensationId}/transition`, {
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
    action: CompensationAction;
    label: string;
    variant: 'primary' | 'danger' | 'secondary';
    onClick: () => void;
  }> = [];

  if (canTransition(role, stato, 'submit').ok) {
    actions.push({ action: 'submit', label: 'Invia', variant: 'primary', onClick: () => perform('submit') });
  }
  if (canTransition(role, stato, 'withdraw').ok) {
    actions.push({ action: 'withdraw', label: 'Ritira in bozza', variant: 'secondary', onClick: () => perform('withdraw') });
  }
  if (canTransition(role, stato, 'reopen').ok) {
    actions.push({ action: 'reopen', label: 'Riapri', variant: 'secondary', onClick: () => perform('reopen') });
  }
  if (canTransition(role, stato, 'approve').ok) {
    actions.push({ action: 'approve', label: 'Approva', variant: 'primary', onClick: () => perform('approve') });
  }
  if (canTransition(role, stato, 'reject').ok) {
    actions.push({ action: 'reject', label: 'Rifiuta', variant: 'danger', onClick: () => setShowRejectModal(true) });
  }
  if (canTransition(role, stato, 'mark_liquidated').ok) {
    actions.push({ action: 'mark_liquidated', label: 'Segna come liquidato', variant: 'primary', onClick: () => setShowLiquidatedModal(true) });
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

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-gray-100">Rifiuta compenso</h3>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Motivazione del rifiuto
                <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
                placeholder="Descrivi il motivo del rifiuto…"
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
                onClick={() => { setShowRejectModal(false); setRejectNote(''); setError(null); }}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition"
              >
                Annulla
              </button>
              <button
                disabled={rejectNote.trim().length === 0 || loading !== null}
                onClick={async () => {
                  await perform('reject', { note: rejectNote });
                  setShowRejectModal(false);
                  setRejectNote('');
                }}
                className="rounded-lg bg-red-700 hover:bg-red-600 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              >
                {loading === 'reject' ? 'Attendere…' : 'Conferma rifiuto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark liquidated modal */}
      {showLiquidatedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-gray-100">Segna come liquidato</h3>

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
                onClick={() => { setShowLiquidatedModal(false); setPaymentReference(''); setError(null); }}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition"
              >
                Annulla
              </button>
              <button
                disabled={loading !== null}
                onClick={async () => {
                  await perform('mark_liquidated', { payment_reference: paymentReference || undefined });
                  setShowLiquidatedModal(false);
                  setPaymentReference('');
                }}
                className="rounded-lg bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              >
                {loading === 'mark_liquidated' ? 'Attendere…' : 'Conferma liquidazione'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
