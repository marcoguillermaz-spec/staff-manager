import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CompensationList from '@/components/compensation/CompensationList';
import PaymentOverview from '@/components/compensation/PaymentOverview';
import ExpenseList from '@/components/expense/ExpenseList';
import TicketQuickModal from '@/components/ticket/TicketQuickModal';
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
  if (profile.member_status === 'uscente_senza_compenso') redirect('/profilo?tab=documenti');

  const currentYear = new Date().getFullYear();

  const [
    { data: compensations },
    { data: allCompens },
    { data: allExpenses },
    { data: expenses },
    { data: collabRecord },
  ] = await Promise.all([
    supabase
      .from('compensations')
      .select('*, communities(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('compensations')
      .select('tipo, stato, importo_lordo, importo_netto, totale_fattura, paid_at'),
    supabase
      .from('expense_reimbursements')
      .select('importo, stato, paid_at'),
    supabase
      .from('expense_reimbursements')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('collaborators')
      .select('importo_lordo_massimale')
      .eq('user_id', user.id)
      .single(),
  ]);

  const { paidByYear: compensPaidByYear, pending: compensPending } =
    groupByYear(allCompens ?? [], ACTIVE_STATES);
  const { paidByYear: expensePaidByYear, pending: expensePending } =
    groupByYear(allExpenses ?? [], ACTIVE_STATES);

  const massimale = collabRecord?.importo_lordo_massimale ?? null;
  // Sum gross amount of OCCASIONALE compensations paid in the current year
  const paidCurrentYear = massimale != null
    ? (allCompens ?? [])
        .filter((c) => c.tipo === 'OCCASIONALE' && c.stato === 'PAGATO' && c.paid_at &&
          new Date(c.paid_at).getFullYear() === currentYear)
        .reduce((sum, c) => sum + (c.importo_lordo ?? 0), 0)
    : 0;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Compensi e Rimborsi</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Visualizza i tuoi compensi e rimborsi, e gestisci le richieste di supporto.
          </p>
        </div>
        <TicketQuickModal />
      </div>

      <PaymentOverview
        compensPaidByYear={compensPaidByYear}
        compensPending={compensPending}
        expensePaidByYear={expensePaidByYear}
        expensePending={expensePending}
        massimale={massimale}
        paidCurrentYear={paidCurrentYear}
        currentYear={currentYear}
      />

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Compensi
        </h2>
        <CompensationList
          compensations={compensations ?? []}
          role={profile.role as Role}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Rimborsi
        </h2>
        <ExpenseList
          expenses={expenses ?? []}
          role={profile.role as Role}
        />
      </div>
    </div>
  );
}
