import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CompensationList from '@/components/compensation/CompensationList';
import PaymentOverview from '@/components/compensation/PaymentOverview';
import type { Role } from '@/lib/types';

type YearBreakdown = { year: number; total: number };

function groupByYear(
  rows: { stato: string; paid_at: string | null; importo_netto?: number | null; totale_fattura?: number | null; tipo?: string; importo?: number }[],
  activeStates: string[],
): { paidByYear: YearBreakdown[]; pending: number } {
  const map: Record<number, number> = {};
  let pending = 0;

  for (const row of rows) {
    const amount =
      'importo' in row
        ? (row.importo ?? 0)
        : row.tipo === 'PIVA'
          ? (row.totale_fattura ?? 0)
          : (row.importo_netto ?? 0);

    if (row.stato === 'PAGATO' && row.paid_at) {
      const year = new Date(row.paid_at).getFullYear();
      map[year] = (map[year] ?? 0) + amount;
    } else if (activeStates.includes(row.stato)) {
      pending += amount;
    }
  }

  const paidByYear = Object.entries(map)
    .map(([year, total]) => ({ year: Number(year), total }))
    .sort((a, b) => b.year - a.year);

  return { paidByYear, pending };
}

const ACTIVE_STATES = ['INVIATO', 'INTEGRAZIONI_RICHIESTE', 'PRE_APPROVATO_RESP', 'APPROVATO_ADMIN'];

export default async function CompensiPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active, member_status')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');
  if (profile.role !== 'collaboratore') redirect('/');
  if (profile.member_status === 'uscente_senza_compenso') redirect('/documenti');

  const [{ data: compensations }, { data: allCompens }, { data: allExpenses }] = await Promise.all([
    supabase
      .from('compensations')
      .select('*, communities(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('compensations')
      .select('tipo, stato, importo_netto, totale_fattura, paid_at'),
    supabase
      .from('expense_reimbursements')
      .select('importo, stato, paid_at'),
  ]);

  const { paidByYear: compensPaidByYear, pending: compensPending } =
    groupByYear(allCompens ?? [], ACTIVE_STATES);
  const { paidByYear: expensePaidByYear, pending: expensePending } =
    groupByYear(allExpenses ?? [], ACTIVE_STATES);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">I miei compensi</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gestisci le tue richieste di compenso.
        </p>
      </div>

      <PaymentOverview
        compensPaidByYear={compensPaidByYear}
        compensPending={compensPending}
        expensePaidByYear={expensePaidByYear}
        expensePending={expensePending}
      />

      <CompensationList
        compensations={compensations ?? []}
        role={profile.role as Role}
      />
    </div>
  );
}
