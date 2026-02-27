import type { Compensation } from '@/lib/types';
import StatusBadge from './StatusBadge';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-800 last:border-0">
      <span className="w-40 shrink-0 text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-200">{value ?? '—'}</span>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('it-IT');
}

function formatCurrency(n: number | null) {
  if (n === null) return null;
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function CompensationDetail({
  compensation,
}: {
  compensation: Compensation & { communities?: { name: string } | null };
}) {
  const c = compensation;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-medium text-gray-100">{c.descrizione}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {c.communities?.name ?? '—'} · {c.periodo_riferimento ?? '—'}
          </p>
        </div>
        <StatusBadge stato={c.stato} />
      </div>

      {/* General fields */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 px-4">
        <Row label="Community" value={c.communities?.name} />
        <Row label="Periodo" value={c.periodo_riferimento} />
        <Row label="Data competenza" value={formatDate(c.data_competenza)} />
        <Row label="Descrizione" value={c.descrizione} />
      </div>

      {/* Financial fields */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 px-4">
        <Row label="Importo lordo" value={formatCurrency(c.importo_lordo)} />
        <Row label="Ritenuta acconto (20%)" value={formatCurrency(c.ritenuta_acconto)} />
        <Row label="Importo netto" value={
          <span className="font-medium text-green-400">{formatCurrency(c.importo_netto)}</span>
        } />
      </div>

      {/* Rejection note */}
      {c.rejection_note && (
        <div className="rounded-xl bg-red-900/20 border border-red-700/40 px-4 py-3">
          <p className="text-xs font-medium text-red-400 mb-1">Motivo rifiuto</p>
          <p className="text-sm text-red-200">{c.rejection_note}</p>
        </div>
      )}

      {/* Payment info */}
      {c.liquidated_at && (
        <div className="rounded-xl bg-emerald-900/20 border border-emerald-700/40 px-4 py-3">
          <p className="text-xs font-medium text-emerald-400 mb-1">Pagamento</p>
          <Row label="Data liquidazione" value={formatDate(c.liquidated_at)} />
          {c.payment_reference && <Row label="Riferimento" value={c.payment_reference} />}
        </div>
      )}

    </div>
  );
}
