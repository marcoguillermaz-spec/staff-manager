import type { Expense, ExpenseAttachment } from '@/lib/types';
import StatusBadge from '@/components/compensation/StatusBadge';

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

export default function ExpenseDetail({
  expense,
  attachments,
}: {
  expense: Expense;
  attachments: ExpenseAttachment[];
}) {
  const e = expense;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-medium text-gray-100">{e.descrizione}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {e.categoria} · {formatDate(e.data_spesa)}
          </p>
        </div>
        <StatusBadge stato={e.stato} />
      </div>

      {/* Info block */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 px-4">
        <Row label="Categoria" value={e.categoria} />
        <Row label="Data spesa" value={formatDate(e.data_spesa)} />
        <Row label="Importo" value={
          <span className="font-medium text-green-400">{formatCurrency(e.importo)}</span>
        } />
        <Row label="Descrizione" value={e.descrizione} />
      </div>

      {/* Integration note */}
      {e.integration_note && (
        <div className="rounded-xl bg-yellow-900/20 border border-yellow-700/40 px-4 py-3">
          <p className="text-xs font-medium text-yellow-400 mb-1">Note per integrazione</p>
          <p className="text-sm text-yellow-200">{e.integration_note}</p>
        </div>
      )}

      {/* Payment info */}
      {e.paid_at && (
        <div className="rounded-xl bg-emerald-900/20 border border-emerald-700/40 px-4 py-3">
          <p className="text-xs font-medium text-emerald-400 mb-1">Pagamento</p>
          <Row label="Data pagamento" value={formatDate(e.paid_at)} />
          {e.payment_reference && <Row label="Riferimento" value={e.payment_reference} />}
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
