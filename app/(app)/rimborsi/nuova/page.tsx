import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ExpenseForm from '@/components/expense/ExpenseForm';

export default async function NuovoRimborsoPage() {
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
  if (profile.member_status === 'uscente_senza_compenso') redirect('/rimborsi');

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/rimborsi" className="text-sm text-gray-500 hover:text-gray-300 transition">
          ← Rimborsi
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-semibold text-gray-100">Nuovo rimborso</h1>
      </div>

      <ExpenseForm />
    </div>
  );
}
