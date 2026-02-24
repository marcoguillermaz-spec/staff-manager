import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ExpenseList from '@/components/expense/ExpenseList';
import type { Role } from '@/lib/types';

export default async function RimborsiPage() {
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

  const { data } = await supabase
    .from('expense_reimbursements')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">I miei rimborsi</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gestisci le tue richieste di rimborso spese.
        </p>
      </div>

      <ExpenseList
        expenses={data ?? []}
        role={profile.role as Role}
      />
    </div>
  );
}
