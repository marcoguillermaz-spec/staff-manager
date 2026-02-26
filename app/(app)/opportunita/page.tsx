import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BenefitList from '@/components/contenuti/BenefitList';
import type { Benefit } from '@/lib/types';

export default async function OpportunitaPage() {
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

  const { data } = await supabase
    .from('benefits')
    .select('*')
    .order('created_at', { ascending: false });

  const benefits: Benefit[] = (data ?? []) as Benefit[];

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Opportunità e Sconti</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Benefit, agevolazioni e sconti dedicati ai collaboratori.
        </p>
      </div>

      <BenefitList benefits={benefits} canWrite={false} communities={[]} />
    </div>
  );
}
