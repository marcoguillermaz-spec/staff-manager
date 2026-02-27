import { redirect, notFound } from 'next/navigation';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import CollaboratoreDetail from '@/components/responsabile/CollaboratoreDetail';
import type { Role, CompensationStatus, ExpenseStatus, DocumentType, DocumentSignStatus } from '@/lib/types';

export default async function CollaboratoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
  if (!['responsabile_compensi', 'amministrazione'].includes(role)) redirect('/');

  // ── Fetch collaborator ───────────────────────────────────────────────────
  const { data: collab, error: collabErr } = await svc
    .from('collaborators')
    .select('id, user_id, nome, cognome, codice_fiscale, telefono, email, tipo_contratto, data_ingresso, luogo_nascita, comune, indirizzo, username')
    .eq('id', id)
    .maybeSingle();

  if (collabErr || !collab) notFound();

  // ── Access check for responsabile ───────────────────────────────────────
  if (role === 'responsabile_compensi') {
    const { data: uca } = await svc
      .from('user_community_access')
      .select('community_id')
      .eq('user_id', user.id);
    const myCommIds = new Set((uca ?? []).map((u: { community_id: string }) => u.community_id));

    const { data: cc } = await svc
      .from('collaborator_communities')
      .select('community_id')
      .eq('collaborator_id', id);
    const collabCommIds = (cc ?? []).map((c: { community_id: string }) => c.community_id);

    if (!collabCommIds.some((cid: string) => myCommIds.has(cid))) redirect('/collaboratori');
  }

  // ── Fetch community names ────────────────────────────────────────────────
  const { data: ccData } = await svc
    .from('collaborator_communities')
    .select('community_id')
    .eq('collaborator_id', id);
  const communityIds = (ccData ?? []).map((c: { community_id: string }) => c.community_id);
  let communityNames: string[] = [];
  if (communityIds.length > 0) {
    const { data: commData } = await svc
      .from('communities')
      .select('id, name')
      .in('id', communityIds);
    communityNames = (commData ?? []).map((c: { name: string }) => c.name);
  }
  const communityById: Record<string, string> = {};
  if (communityIds.length > 0) {
    const { data: commData } = await svc
      .from('communities')
      .select('id, name')
      .in('id', communityIds);
    for (const c of (commData ?? []) as { id: string; name: string }[]) {
      communityById[c.id] = c.name;
    }
  }

  // ── Fetch member_status from user_profiles ───────────────────────────────
  const { data: upData } = await svc
    .from('user_profiles')
    .select('member_status')
    .eq('user_id', collab.user_id)
    .maybeSingle();
  const memberStatus = upData?.member_status ?? null;

  // ── Fetch compensations ──────────────────────────────────────────────────
  const { data: rawComp } = await svc
    .from('compensations')
    .select('id, tipo, periodo_riferimento, importo_lordo, importo_netto, totale_fattura, stato, community_id, created_at')
    .eq('collaborator_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  const compensations = (rawComp ?? []).map((c: {
    id: string;
    tipo: string;
    periodo_riferimento: string | null;
    importo_lordo: number | null;
    importo_netto: number | null;
    totale_fattura: number | null;
    stato: CompensationStatus;
    community_id: string | null;
    created_at: string;
  }) => ({
    ...c,
    community_name: c.community_id ? (communityById[c.community_id] ?? null) : null,
  }));

  // ── Fetch expenses ───────────────────────────────────────────────────────
  const { data: rawExp } = await svc
    .from('expense_reimbursements')
    .select('id, categoria, data_spesa, importo, stato, created_at')
    .eq('collaborator_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  const expenses = (rawExp ?? []) as {
    id: string;
    categoria: string;
    data_spesa: string;
    importo: number;
    stato: ExpenseStatus;
    created_at: string;
  }[];

  // ── Fetch documents ──────────────────────────────────────────────────────
  const { data: rawDocs } = await svc
    .from('documents')
    .select('id, titolo, tipo, stato_firma, created_at')
    .eq('collaborator_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  const documents = (rawDocs ?? []) as {
    id: string;
    titolo: string;
    tipo: DocumentType;
    stato_firma: DocumentSignStatus;
    created_at: string;
  }[];

  return (
    <CollaboratoreDetail
      collab={{
        id: collab.id,
        nome: collab.nome,
        cognome: collab.cognome,
        codice_fiscale: collab.codice_fiscale,
        telefono: collab.telefono,
        email: collab.email ?? null,
        tipo_contratto: collab.tipo_contratto,
        data_ingresso: collab.data_ingresso,
        luogo_nascita: collab.luogo_nascita,
        comune: collab.comune,
        indirizzo: collab.indirizzo,
        username: collab.username ?? null,
      }}
      memberStatus={memberStatus}
      communityNames={communityNames}
      compensations={compensations}
      expenses={expenses}
      documents={documents}
      role={role}
    />
  );
}
