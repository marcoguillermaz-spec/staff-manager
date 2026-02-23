import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import CreateUserForm from '@/components/impostazioni/CreateUserForm';
import CommunityManager from '@/components/impostazioni/CommunityManager';
import MemberStatusManager from '@/components/impostazioni/MemberStatusManager';
import ContractTemplateManager from '@/components/impostazioni/ContractTemplateManager';

type Tab = 'utenti' | 'community' | 'collaboratori' | 'contratti';

export default async function ImpostazioniPage({
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
  const activeTab: Tab = tab === 'community' ? 'community'
    : tab === 'collaboratori' ? 'collaboratori'
    : tab === 'contratti' ? 'contratti'
    : 'utenti';

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch contract templates for the contratti tab
  const contractTemplates = activeTab === 'contratti'
    ? await serviceClient
        .from('contract_templates')
        .select('id, tipo, file_name, uploaded_at')
        .order('tipo')
        .then((r) => r.data ?? [])
    : [];

  // Fetch data for active tab
  const communities = activeTab === 'community' || activeTab === 'utenti'
    ? await serviceClient
        .from('communities')
        .select('id, name, is_active')
        .order('name')
        .then((r) => r.data ?? [])
    : [];

  const responsabili = activeTab === 'community'
    ? await (async () => {
        const { data: profiles } = await serviceClient
          .from('user_profiles')
          .select('user_id')
          .eq('role', 'responsabile')
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (!profiles || profiles.length === 0) return [];
        const userIds = profiles.map((p) => p.user_id);

        const [{ data: collabs }, { data: assignments }, { data: authData }] = await Promise.all([
          serviceClient.from('collaborators').select('user_id, nome, cognome').in('user_id', userIds),
          serviceClient.from('user_community_access').select('user_id, community_id, communities(id, name)').in('user_id', userIds),
          serviceClient.auth.admin.listUsers(),
        ]);

        const collabMap = Object.fromEntries((collabs ?? []).map((c) => [c.user_id, `${c.nome} ${c.cognome}`]));
        const emailMap = Object.fromEntries((authData?.users ?? []).map((u) => [u.id, u.email ?? '']));
        const assignMap: Record<string, { id: string; name: string }[]> = {};
        for (const a of assignments ?? []) {
          if (!assignMap[a.user_id]) assignMap[a.user_id] = [];
          const comm = Array.isArray(a.communities) ? a.communities[0] : a.communities;
          if (comm) assignMap[a.user_id].push({ id: comm.id, name: comm.name });
        }

        return profiles.map((p) => ({
          user_id: p.user_id,
          display_name: collabMap[p.user_id] ?? emailMap[p.user_id] ?? p.user_id,
          email: emailMap[p.user_id] ?? '',
          communities: assignMap[p.user_id] ?? [],
        }));
      })()
    : [];

  const members = activeTab === 'collaboratori'
    ? await (async () => {
        const { data: collabs } = await serviceClient
          .from('collaborators')
          .select('id, user_id, nome, cognome, data_ingresso')
          .order('cognome', { ascending: true })
          .order('nome', { ascending: true });
        if (!collabs || collabs.length === 0) return [];
        const userIds = collabs.map((c) => c.user_id);
        const { data: profiles } = await serviceClient
          .from('user_profiles')
          .select('user_id, member_status, is_active')
          .in('user_id', userIds);
        const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));
        return collabs.map((c) => {
          const p = profileMap[c.user_id];
          return {
            id: c.id,
            user_id: c.user_id,
            nome: c.nome,
            cognome: c.cognome,
            member_status: (p?.member_status ?? 'attivo') as 'attivo' | 'uscente_con_compenso' | 'uscente_senza_compenso',
            is_active: p?.is_active ?? true,
            data_ingresso: c.data_ingresso ?? null,
          };
        });
      })()
    : [];

  const tabCls = (t: Tab) =>
    `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
      activeTab === t
        ? 'bg-blue-600 text-white'
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Impostazioni</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestione utenti, community e stato collaboratori.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        <Link href="?tab=utenti" className={tabCls('utenti')}>Utenti</Link>
        <Link href="?tab=community" className={tabCls('community')}>Community</Link>
        <Link href="?tab=collaboratori" className={tabCls('collaboratori')}>Collaboratori</Link>
        <Link href="?tab=contratti" className={tabCls('contratti')}>Contratti</Link>
      </div>

      {activeTab === 'utenti' && (
        <div className="rounded-2xl bg-gray-900 border border-gray-800">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-medium text-gray-200">Crea nuovo utente</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Genera le credenziali di accesso per un nuovo collaboratore o responsabile.
            </p>
          </div>
          <div className="p-5">
            <CreateUserForm />
          </div>
        </div>
      )}

      {activeTab === 'community' && (
        <CommunityManager
          communities={communities as { id: string; name: string; is_active: boolean }[]}
          responsabili={responsabili}
        />
      )}

      {activeTab === 'collaboratori' && (
        <MemberStatusManager members={members} />
      )}

      {activeTab === 'contratti' && (
        <ContractTemplateManager
          templates={contractTemplates as { id: string; tipo: 'OCCASIONALE' | 'COCOCO' | 'PIVA'; file_name: string; uploaded_at: string }[]}
        />
      )}
    </div>
  );
}
