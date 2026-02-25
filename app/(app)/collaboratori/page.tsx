import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type { Role } from '@/lib/types';

type Filter = 'all' | 'documenti' | 'stallo';

const PAGE_SIZE = 20;

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Tutti',
  documenti: 'Doc da firmare',
  stallo: 'Pagamenti in sospeso',
};

export default async function CollaboratoriPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await svc
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');
  const role = profile?.role as Role;
  if (!['responsabile', 'amministrazione'].includes(role)) redirect('/');

  const { filter: filterParam, page: pageParam } = await searchParams;
  const filter = (['all', 'documenti', 'stallo'].includes(filterParam ?? '') ? filterParam : 'all') as Filter;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));

  // ── Step 1: collaborator IDs accessible to this user ────────────────────────
  let allCollaboratorIds: string[] = [];

  if (role === 'responsabile') {
    const { data: uca } = await svc
      .from('user_community_access')
      .select('community_id')
      .eq('user_id', user.id);
    const communityIds = (uca ?? []).map((u: { community_id: string }) => u.community_id);
    if (communityIds.length > 0) {
      const { data: cc } = await svc
        .from('collaborator_communities')
        .select('collaborator_id')
        .in('community_id', communityIds);
      allCollaboratorIds = [...new Set((cc ?? []).map((c: { collaborator_id: string }) => c.collaborator_id))];
    }
  } else {
    const { data: all } = await svc.from('collaborators').select('id');
    allCollaboratorIds = (all ?? []).map((c: { id: string }) => c.id);
  }

  // ── Step 2: apply filter ─────────────────────────────────────────────────────
  let filteredIds = allCollaboratorIds;

  if (allCollaboratorIds.length > 0) {
    if (filter === 'documenti') {
      const { data: docs } = await svc
        .from('documents')
        .select('collaborator_id')
        .eq('stato_firma', 'DA_FIRMARE')
        .in('collaborator_id', allCollaboratorIds);
      const matched = new Set((docs ?? []).map((d: { collaborator_id: string }) => d.collaborator_id));
      filteredIds = allCollaboratorIds.filter(id => matched.has(id));
    } else if (filter === 'stallo') {
      const [{ data: comp }, { data: exp }] = await Promise.all([
        svc
          .from('compensations')
          .select('collaborator_id')
          .neq('stato', 'PAGATO')
          .neq('stato', 'RIFIUTATO')
          .in('collaborator_id', allCollaboratorIds),
        svc
          .from('expense_reimbursements')
          .select('collaborator_id')
          .neq('stato', 'PAGATO')
          .neq('stato', 'RIFIUTATO')
          .in('collaborator_id', allCollaboratorIds),
      ]);
      const stallIds = new Set([
        ...(comp ?? []).map((c: { collaborator_id: string }) => c.collaborator_id),
        ...(exp ?? []).map((e: { collaborator_id: string }) => e.collaborator_id),
      ]);
      filteredIds = allCollaboratorIds.filter(id => stallIds.has(id));
    }
  }

  const total = filteredIds.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageIds = filteredIds.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Step 3: fetch page data ─────────────────────────────────────────────────
  type CollabRow = { id: string; nome: string | null; cognome: string | null; codice_fiscale: string | null; telefono: string | null };
  let collaborators: CollabRow[] = [];
  let communityByCollab: Record<string, string[]> = {};

  if (pageIds.length > 0) {
    const { data: collabData } = await svc
      .from('collaborators')
      .select('id, nome, cognome, codice_fiscale, telefono')
      .in('id', pageIds);
    collaborators = ((collabData ?? []) as CollabRow[]).sort((a, b) =>
      (a.cognome ?? '').localeCompare(b.cognome ?? '', 'it')
    );

    const { data: ccData } = await svc
      .from('collaborator_communities')
      .select('collaborator_id, community_id')
      .in('collaborator_id', pageIds);
    const communityIds = [...new Set((ccData ?? []).map((cc: { community_id: string }) => cc.community_id))];
    let nameById: Record<string, string> = {};
    if (communityIds.length > 0) {
      const { data: comm } = await svc
        .from('communities')
        .select('id, name')
        .in('id', communityIds);
      nameById = Object.fromEntries((comm ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
    }
    for (const cc of (ccData ?? []) as { collaborator_id: string; community_id: string }[]) {
      if (!communityByCollab[cc.collaborator_id]) communityByCollab[cc.collaborator_id] = [];
      if (nameById[cc.community_id]) communityByCollab[cc.collaborator_id].push(nameById[cc.community_id]);
    }
  }

  const subtitle =
    role === 'responsabile'
      ? 'Collaboratori nelle community a te assegnate'
      : 'Tutti i collaboratori';

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Collaboratori</h1>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'documenti', 'stallo'] as Filter[]).map((f) => (
          <Link
            key={f}
            href={`/collaboratori?filter=${f}&page=1`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            {FILTER_LABELS[f]}
          </Link>
        ))}
      </div>

      {allCollaboratorIds.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          {role === 'responsabile'
            ? 'Nessuna community assegnata. Contatta un amministratore.'
            : 'Nessun collaboratore presente.'}
        </p>
      ) : collaborators.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">Nessun collaboratore trovato per il filtro selezionato.</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Nome', 'Cognome', 'Codice fiscale', 'Telefono', 'Community', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {collaborators.map((c) => (
                <tr key={c.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition">
                  <td className="px-4 py-3 text-gray-200">{c.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-200 font-medium">{c.cognome ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{c.codice_fiscale ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{c.telefono ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{(communityByCollab[c.id] ?? []).join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/collaboratori/${c.id}`}
                      className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                    >
                      Dettaglio →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {total} collaborator{total !== 1 ? 'i' : 'e'} · pagina {safePage} di {totalPages}
          </span>
          <div className="flex gap-2">
            {safePage > 1 && (
              <Link
                href={`/collaboratori?filter=${filter}&page=${safePage - 1}`}
                className="px-3 py-1.5 rounded-md text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
              >
                ← Precedente
              </Link>
            )}
            {safePage < totalPages && (
              <Link
                href={`/collaboratori?filter=${filter}&page=${safePage + 1}`}
                className="px-3 py-1.5 rounded-md text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
              >
                Successiva →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
