import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CompensationWizard from '@/components/compensation/CompensationWizard';

export default async function NuovaCompensoPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active, member_status')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');
  // Compensation creation is no longer available from the collaboratore UI
  if (profile.role === 'collaboratore') redirect('/compensi');
  if (profile.role !== 'collaboratore') redirect('/');

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/compensi" className="text-sm text-gray-500 hover:text-gray-300 transition">
          ← Compensi
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-semibold text-gray-100">Nuova richiesta</h1>
      </div>

      <CompensationWizard />
    </div>
  );
}
