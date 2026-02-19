import type { CompensationStatus, ExpenseStatus } from '@/lib/types';
import { COMPENSATION_STATUS_LABELS, EXPENSE_STATUS_LABELS } from '@/lib/types';

const STATUS_COLORS: Record<CompensationStatus, string> = {
  BOZZA:                  'bg-gray-700 text-gray-300',
  INVIATO:                'bg-blue-900/50 text-blue-300',
  INTEGRAZIONI_RICHIESTE: 'bg-yellow-900/50 text-yellow-300',
  PRE_APPROVATO_RESP:     'bg-indigo-900/50 text-indigo-300',
  APPROVATO_ADMIN:        'bg-green-900/50 text-green-300',
  RIFIUTATO:              'bg-red-900/50 text-red-300',
  PAGATO:                 'bg-emerald-900/50 text-emerald-300',
};

const STATUS_LABELS: Record<CompensationStatus | ExpenseStatus, string> = {
  ...COMPENSATION_STATUS_LABELS,
  ...EXPENSE_STATUS_LABELS,
};

export default function StatusBadge({ stato }: { stato: CompensationStatus | ExpenseStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[stato as CompensationStatus]}`}>
      {STATUS_LABELS[stato]}
    </span>
  );
}
