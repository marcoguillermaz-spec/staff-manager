import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ExpenseDetail from '@/components/expense/ExpenseDetail';
import ExpenseActionPanel from '@/components/expense/ExpenseActionPanel';
import Timeline from '@/components/compensation/Timeline';
import type { Role, ExpenseStatus } from '@/lib/types';

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');

  const { id } = await params;

  const { data: expense, error } = await supabase
    .from('expense_reimbursements')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !expense) notFound();

  const { data: attachments } = await supabase
    .from('expense_attachments')
    .select('*')
    .eq('reimbursement_id', id)
    .order('created_at', { ascending: true });

  const { data: history } = await supabase
    .from('expense_history')
    .select('*')
    .eq('reimbursement_id', id)
    .order('created_at', { ascending: true });

  const role = profile.role as Role;
  const backHref =
    role === 'collaboratore'
      ? '/rimborsi'
      : role === 'responsabile'
      ? '/approvazioni?tab=rimborsi'
      : '/coda?tab=rimborsi';

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-300 transition">
          ← Indietro
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-semibold text-gray-100">Dettaglio rimborso</h1>
      </div>

      <div className="space-y-6">
        <ExpenseDetail
          expense={expense}
          attachments={attachments ?? []}
        />

        <ExpenseActionPanel
          expenseId={id}
          stato={expense.stato as ExpenseStatus}
          role={role}
        />

        {(history ?? []).length > 0 && (
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
              Cronologia
            </p>
            <Timeline events={history ?? []} />
          </div>
        )}
      </div>
    </div>
  );
}
