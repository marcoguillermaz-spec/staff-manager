import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CompensationList from '@/components/compensation/CompensationList';
import type { Role } from '@/lib/types';

export default async function CompensiPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');
  if (profile.role !== 'collaboratore') redirect('/');

  const { data } = await supabase
    .from('compensations')
    .select('*, communities(name)')
    .order('created_at', { ascending: false });

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">I miei compensi</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gestisci le tue richieste di compenso.
        </p>
      </div>

      <CompensationList
        compensations={data ?? []}
        role={profile.role as Role}
      />
    </div>
  );
}
