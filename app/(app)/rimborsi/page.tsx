import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function RimborsiPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');

  // Rimborsi list is now part of the unified Compensi e Rimborsi page
  redirect('/compensi');
}
