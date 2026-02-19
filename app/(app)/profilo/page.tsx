import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProfileForm from '@/components/ProfileForm';

export default async function ProfiloPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: collaborator }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('role, member_status')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('collaborators')
      .select(`
        nome, cognome, email, codice_fiscale, partita_iva,
        data_nascita, data_ingresso, telefono, indirizzo, iban, tshirt_size,
        collaborator_communities ( communities ( name ) )
      `)
      .eq('user_id', user.id)
      .single(),
  ]);

  const communities =
    collaborator?.collaborator_communities?.flatMap(
      (cc: { communities: { name: string } | { name: string }[] | null }) => {
        const c = cc.communities;
        if (!c) return [];
        return Array.isArray(c) ? c : [c];
      },
    ) ?? [];

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-100 mb-6">Il mio profilo</h1>
      <ProfileForm
        collaborator={collaborator ?? null}
        role={profile?.role ?? ''}
        email={user.email ?? ''}
        communities={communities}
      />
    </div>
  );
}
