import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CompensationList from '@/components/compensation/CompensationList';
import ExpenseList from '@/components/expense/ExpenseList';
import type { Role } from '@/lib/types';

export default async function CodaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
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
  if (!['amministrazione', 'super_admin'].includes(profile.role)) redirect('/');

  const { tab } = await searchParams;
  const activeTab = tab === 'rimborsi' ? 'rimborsi' : 'compensi';

  // Fetch data only for the active tab
  const compensations = activeTab === 'compensi'
    ? await supabase
        .from('compensations')
        .select('*, communities(name)')
        .in('stato', ['PRE_APPROVATO_RESP', 'APPROVATO_ADMIN'])
        .order('created_at', { ascending: true })
        .then((r) => r.data ?? [])
    : [];

  const expenses = activeTab === 'rimborsi'
    ? await supabase
        .from('expense_reimbursements')
        .select('*')
        .in('stato', ['PRE_APPROVATO_RESP', 'APPROVATO_ADMIN'])
        .order('created_at', { ascending: true })
        .then((r) => r.data ?? [])
    : [];

  const role = profile.role as Role;

  const tabCls = (t: string) =>
    `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
      activeTab === t
        ? 'bg-blue-600 text-white'
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Coda lavoro</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Richieste pre-approvate in attesa di approvazione definitiva o pagamento.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        <Link href="?tab=compensi" className={tabCls('compensi')}>Compensi</Link>
        <Link href="?tab=rimborsi" className={tabCls('rimborsi')}>Rimborsi</Link>
      </div>

      {activeTab === 'compensi' && (
        <CompensationList compensations={compensations} role={role} />
      )}
      {activeTab === 'rimborsi' && (
        <ExpenseList expenses={expenses} role={role} />
      )}
    </div>
  );
}
