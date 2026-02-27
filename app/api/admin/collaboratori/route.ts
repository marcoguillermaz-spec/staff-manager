import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });
  if (!['responsabile_compensi', 'amministrazione'].includes(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const communityIdFilter = searchParams.get('community_id');
  const activeOnly = searchParams.get('active_only') !== 'false';

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Determine allowed community IDs (responsabile: managed only; admin: all)
  let allowedCommunityIds: string[] | null = null;
  if (profile.role === 'responsabile_compensi') {
    const { data: access } = await svc
      .from('user_community_access')
      .select('community_id')
      .eq('user_id', user.id);
    allowedCommunityIds = (access ?? []).map((a: { community_id: string }) => a.community_id);
    if (allowedCommunityIds.length === 0) {
      return NextResponse.json({ collaborators: [] });
    }
  }

  // Fetch collaborator_communities to know which collaborators are in scope
  let ccQuery = svc.from('collaborator_communities').select('collaborator_id, community_id');
  if (allowedCommunityIds) {
    ccQuery = ccQuery.in('community_id', allowedCommunityIds);
  }
  if (communityIdFilter) {
    ccQuery = ccQuery.eq('community_id', communityIdFilter);
  }
  const { data: ccRows } = await ccQuery;

  if (!ccRows || ccRows.length === 0) {
    return NextResponse.json({ collaborators: [] });
  }

  // Build collaborator → communities map
  const collabCommunityMap = new Map<string, string[]>();
  for (const row of ccRows) {
    const existing = collabCommunityMap.get(row.collaborator_id) ?? [];
    existing.push(row.community_id);
    collabCommunityMap.set(row.collaborator_id, existing);
  }
  const collabIds = [...collabCommunityMap.keys()];

  // Fetch collaborator records
  const { data: collaborators } = await svc
    .from('collaborators')
    .select('id, nome, cognome, username, codice_fiscale, user_id')
    .in('id', collabIds);

  if (!collaborators || collaborators.length === 0) {
    return NextResponse.json({ collaborators: [] });
  }

  const userIds = collaborators.map((c: { user_id: string }) => c.user_id);

  // Fetch profiles for active/status check
  const { data: profiles } = await svc
    .from('user_profiles')
    .select('user_id, is_active, member_status')
    .in('user_id', userIds);

  const profileMap = new Map<string, { is_active: boolean; member_status: string | null }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.user_id, { is_active: p.is_active, member_status: p.member_status });
  }

  // Fetch community names
  const allCommunityIds = [...new Set(ccRows.map((r: { community_id: string }) => r.community_id))];
  const { data: communities } = await svc
    .from('communities')
    .select('id, name')
    .in('id', allCommunityIds);

  const communityMap = new Map<string, string>();
  for (const c of communities ?? []) {
    communityMap.set(c.id, c.name);
  }

  // Build result, apply filters
  const result = collaborators
    .map((c: { id: string; nome: string; cognome: string; username: string | null; codice_fiscale: string | null; user_id: string }) => {
      const prof = profileMap.get(c.user_id);
      const communityIds = collabCommunityMap.get(c.id) ?? [];
      const communityList = communityIds
        .filter((id) => communityMap.has(id))
        .map((id) => ({ id, name: communityMap.get(id)! }));

      return {
        id: c.id,
        nome: c.nome,
        cognome: c.cognome,
        username: c.username,
        codice_fiscale: c.codice_fiscale,
        is_active: prof?.is_active ?? false,
        member_status: prof?.member_status ?? null,
        communities: communityList,
      };
    })
    .filter((c) => {
      if (activeOnly && (!c.is_active || c.member_status === 'uscente_senza_compenso')) return false;
      if (q) {
        const searchStr = `${c.nome} ${c.cognome} ${c.username ?? ''} ${c.codice_fiscale ?? ''}`.toLowerCase();
        if (!searchStr.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'));

  return NextResponse.json({ collaborators: result });
}
