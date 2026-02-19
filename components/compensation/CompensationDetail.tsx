import type { Compensation, CompensationAttachment } from '@/lib/types';
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
  attachments,
}: {
  compensation: Compensation & { communities?: { name: string } | null };
  attachments: CompensationAttachment[];
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
        <Row label="Tipo" value={c.tipo} />
        <Row label="Community" value={c.communities?.name} />
        <Row label="Periodo" value={c.periodo_riferimento} />
        <Row label="Data competenza" value={formatDate(c.data_competenza)} />
        <Row label="Descrizione" value={c.descrizione} />
      </div>

      {/* Financial fields */}
      {c.tipo === 'OCCASIONALE' ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 px-4">
          <Row label="Importo lordo" value={formatCurrency(c.importo_lordo)} />
          <Row label="Ritenuta acconto (20%)" value={formatCurrency(c.ritenuta_acconto)} />
          <Row label="Importo netto" value={
            <span className="font-medium text-green-400">{formatCurrency(c.importo_netto)}</span>
          } />
        </div>
      ) : (
        <div className="rounded-xl bg-gray-900 border border-gray-800 px-4">
          <Row label="N. Fattura" value={c.numero_fattura} />
          <Row label="Data fattura" value={formatDate(c.data_fattura)} />
          <Row label="Imponibile" value={formatCurrency(c.imponibile)} />
          <Row label="IVA" value={c.iva_percentuale != null ? `${c.iva_percentuale}%` : null} />
          <Row label="Totale fattura" value={
            <span className="font-medium text-green-400">{formatCurrency(c.totale_fattura)}</span>
          } />
        </div>
      )}

      {/* Integration note (if present) */}
      {c.integration_note && (
        <div className="rounded-xl bg-yellow-900/20 border border-yellow-700/40 px-4 py-3">
          <p className="text-xs font-medium text-yellow-400 mb-1">Note per integrazione</p>
          <p className="text-sm text-yellow-200">{c.integration_note}</p>
          {c.integration_reasons && c.integration_reasons.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {c.integration_reasons.map((r) => (
                <li key={r} className="text-xs text-yellow-300">· {r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Payment info */}
      {c.paid_at && (
        <div className="rounded-xl bg-emerald-900/20 border border-emerald-700/40 px-4 py-3">
          <p className="text-xs font-medium text-emerald-400 mb-1">Pagamento</p>
          <Row label="Data pagamento" value={formatDate(c.paid_at)} />
          {c.payment_reference && <Row label="Riferimento" value={c.payment_reference} />}
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 px-4 py-3">
          <p className="text-xs font-medium text-gray-400 mb-2">Allegati</p>
          <ul className="space-y-1.5">
            {attachments.map((att) => (
              <li key={att.id}>
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {att.file_name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
