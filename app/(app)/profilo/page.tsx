import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ProfileForm from '@/components/ProfileForm';
import DocumentList from '@/components/documents/DocumentList';

export default async function ProfiloPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: profile },
    { data: collaborator },
    { data: guidaFigliRow },
    { data: guidaPivaRow },
  ] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('role, member_status')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('collaborators')
      .select(`
        nome, cognome, email, codice_fiscale, partita_iva,
        data_nascita, luogo_nascita, provincia_nascita,
        comune, provincia_residenza, data_ingresso,
        telefono, indirizzo, civico_residenza, iban, tshirt_size,
        foto_profilo_url, ha_figli_a_carico,
        collaborator_communities ( communities ( name ) )
      `)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('resources')
      .select('titolo, descrizione')
      .contains('tag', ['detrazioni-figli'])
      .limit(1)
      .maybeSingle(),
    supabase
      .from('resources')
      .select('titolo, descrizione')
      .contains('tag', ['procedura-piva'])
      .limit(1)
      .maybeSingle(),
  ]);

  const communities =
    collaborator?.collaborator_communities?.flatMap(
      (cc: { communities: { name: string } | { name: string }[] | null }) => {
        const c = cc.communities;
        if (!c) return [];
        return Array.isArray(c) ? c : [c];
      },
    ) ?? [];

  const role = profile?.role ?? '';
  const isCollaboratore = role === 'collaboratore';

  const { tab } = await searchParams;
  const activeTab = isCollaboratore
    ? (tab === 'documenti' ? 'documenti' : 'profilo')
    : 'profilo';

  const documents = activeTab === 'documenti'
    ? ((await supabase
        .from('documents')
        .select('*, collaborators(nome, cognome)')
        .order('created_at', { ascending: false })
        .then((r) => r.data ?? [])))
    : [];

  const tabCls = (t: string) =>
    `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
      activeTab === t
        ? 'bg-blue-600 text-white'
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;

  if (!isCollaboratore) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-100 mb-6">Il mio profilo</h1>
        <ProfileForm
          collaborator={collaborator ?? null}
          role={role}
          email={user.email ?? ''}
          communities={communities}
          guidaFigli={guidaFigliRow ?? null}
          guidaPiva={guidaPivaRow ?? null}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Profilo e Documenti</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gestisci i tuoi dati personali e consulta i tuoi documenti.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <Link href="?tab=profilo" className={tabCls('profilo')}>Profilo</Link>
        <Link href="?tab=documenti" className={tabCls('documenti')}>Documenti</Link>
      </div>

      {activeTab === 'profilo' && (
        <div className="max-w-2xl">
          <ProfileForm
            collaborator={collaborator ?? null}
            role={role}
            email={user.email ?? ''}
            communities={communities}
            guidaFigli={guidaFigliRow ?? null}
            guidaPiva={guidaPivaRow ?? null}
          />
        </div>
      )}

      {activeTab === 'documenti' && (
        <DocumentList documents={documents} isAdmin={false} />
      )}
    </div>
  );
}
