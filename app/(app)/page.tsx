import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// ── Constants ──────────────────────────────────────────────
const ACTIVE_STATES = new Set([
  'BOZZA', 'INVIATO', 'INTEGRAZIONI_RICHIESTE', 'PRE_APPROVATO_RESP', 'APPROVATO_ADMIN',
]);

const ACTION_LABELS: Record<string, string> = {
  submit:              'inviato',
  withdraw:            'ritirato',
  resubmit:            'reinviato',
  approve_manager:     'pre-approvato dal responsabile',
  request_integration: 'integrazioni richieste',
  approve_admin:       'approvato',
  reject:              'rifiutato',
  mark_paid:           'pagato',
};

// ── Types ──────────────────────────────────────────────────
type CompRow = {
  id: string;
  tipo: string;
  stato: string;
  importo_netto: number | null;
  totale_fattura: number | null;
};

type ExpRow = { id: string; stato: string; importo: number | null };

type CommStat = {
  id: string;
  name: string;
  pendingComps: number;
  pendingExps: number;
  docsToSign: number;
  totalCollabs: number;
  stalloCount: number;
};

type FeedItem = {
  key:  string;
  icon: 'comp' | 'exp' | 'ticket' | 'ann';
  text: string;
  date: string;
  href: string;
};

// ── Helpers ────────────────────────────────────────────────
const sectionCls = 'rounded-2xl bg-gray-900 border border-gray-800';

function eur(n: number) {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function compAmount(c: CompRow) {
  return c.tipo === 'PIVA' ? (c.totale_fattura ?? 0) : (c.importo_netto ?? 0);
}

// ── Sub-components ─────────────────────────────────────────
function StatCard({
  label, count, total, pendingCount, pendingTotal,
}: {
  label: string;
  count: number;
  total: number;
  pendingCount: number;
  pendingTotal: number;
}) {
  return (
    <div className={sectionCls + ' p-5 flex flex-col gap-3'}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-200">{label}</h2>
        <span className="rounded-full bg-gray-800 border border-gray-700 px-2.5 py-0.5 text-xs text-gray-400">
          {count} attiv{count === 1 ? 'o' : 'i'}
        </span>
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-100 tabular-nums">{eur(total)}</p>
        <p className="text-xs text-gray-500 mt-0.5">importo totale in corso</p>
      </div>
      {pendingCount > 0 && (
        <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/30 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-emerald-400">In attesa pagamento ({pendingCount})</span>
          <span className="text-xs font-medium text-emerald-300 tabular-nums">{eur(pendingTotal)}</span>
        </div>
      )}
    </div>
  );
}

function DocCard({ count }: { count: number }) {
  return (
    <div className={sectionCls + ' p-5 flex flex-col gap-3'}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-200">Da firmare</h2>
        <span className={
          count > 0
            ? 'rounded-full bg-amber-900/60 border border-amber-700/50 px-2.5 py-0.5 text-xs text-amber-300'
            : 'rounded-full bg-gray-800 border border-gray-700 px-2.5 py-0.5 text-xs text-gray-400'
        }>
          {count}
        </span>
      </div>
      {count > 0 ? (
        <>
          <p className="text-sm text-amber-300/80">
            {count === 1 ? 'Hai 1 documento' : `Hai ${count} documenti`} in attesa di firma.
          </p>
          <Link href="/documenti" className="text-xs text-blue-400 hover:text-blue-300 transition">
            Vai ai documenti →
          </Link>
        </>
      ) : (
        <p className="text-xs text-gray-500">Nessun documento in attesa di firma.</p>
      )}
    </div>
  );
}

function CommCard({ stat }: { stat: CommStat }) {
  return (
    <div className={sectionCls + ' p-5 space-y-4'}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-100">{stat.name}</h2>
        <span className="text-xs text-gray-500">
          {stat.totalCollabs} collaborator{stat.totalCollabs === 1 ? 'e' : 'i'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Link
          href="/approvazioni?tab=compensi"
          className={`flex flex-col items-center justify-center rounded-xl py-3 px-2 transition ${
            stat.pendingComps > 0
              ? 'bg-amber-950/40 border border-amber-800/30 hover:bg-amber-950/60'
              : 'bg-gray-800/50 border border-gray-700/50'
          }`}
        >
          <span className={`text-2xl font-bold tabular-nums ${stat.pendingComps > 0 ? 'text-amber-300' : 'text-gray-600'}`}>
            {stat.pendingComps}
          </span>
          <span className="text-xs text-gray-400 mt-1 text-center leading-tight">Compensi</span>
        </Link>
        <Link
          href="/approvazioni?tab=rimborsi"
          className={`flex flex-col items-center justify-center rounded-xl py-3 px-2 transition ${
            stat.pendingExps > 0
              ? 'bg-amber-950/40 border border-amber-800/30 hover:bg-amber-950/60'
              : 'bg-gray-800/50 border border-gray-700/50'
          }`}
        >
          <span className={`text-2xl font-bold tabular-nums ${stat.pendingExps > 0 ? 'text-amber-300' : 'text-gray-600'}`}>
            {stat.pendingExps}
          </span>
          <span className="text-xs text-gray-400 mt-1 text-center leading-tight">Rimborsi</span>
        </Link>
        <Link
          href="/collaboratori?filter=documenti"
          className={`flex flex-col items-center justify-center rounded-xl py-3 px-2 transition ${
            stat.docsToSign > 0
              ? 'bg-blue-950/40 border border-blue-800/30 hover:bg-blue-950/60'
              : 'bg-gray-800/50 border border-gray-700/50'
          }`}
        >
          <span className={`text-2xl font-bold tabular-nums ${stat.docsToSign > 0 ? 'text-blue-300' : 'text-gray-600'}`}>
            {stat.docsToSign}
          </span>
          <span className="text-xs text-gray-400 mt-1 text-center leading-tight">Da firmare</span>
        </Link>
      </div>
      {stat.stalloCount > 0 && (
        <p className="text-xs text-gray-500 border-t border-gray-800 pt-3">
          {stat.stalloCount} richiesta{stat.stalloCount === 1 ? '' : 'e'} in pipeline
        </p>
      )}
    </div>
  );
}

const FEED_ICONS: Record<FeedItem['icon'], string> = {
  comp:   '💼',
  exp:    '🧾',
  ticket: '💬',
  ann:    '📣',
};

function FeedRow({ item }: { item: FeedItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-start gap-3 py-2.5 px-1 rounded-lg hover:bg-gray-800/50 transition group"
    >
      <span className="text-base mt-0.5 flex-shrink-0">{FEED_ICONS[item.icon]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 group-hover:text-gray-100 truncate transition">{item.text}</p>
        <p className="text-xs text-gray-600 mt-0.5">
          {new Date(item.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = profile?.role ?? '';

  // ── RESPONSABILE DASHBOARD ────────────────────────────────
  if (role === 'responsabile') {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Round 1 — community IDs for this responsabile
    const { data: ucaRows } = await svc
      .from('user_community_access')
      .select('community_id')
      .eq('user_id', user.id);

    const communityIds = (ucaRows ?? []).map((r: { community_id: string }) => r.community_id);

    if (communityIds.length === 0) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-gray-500">Nessuna community assegnata.</p>
        </div>
      );
    }

    // Round 2 — community data + collaborators (join via FK verified) + announcements
    type CommunityRow = { id: string; name: string };
    type CCRow = {
      collaborator_id: string;
      community_id: string;
      collaborators: { id: string; nome: string | null; cognome: string | null; member_status: string; user_id: string } | null;
    };
    type AnnRow = { id: string; titolo: string; published_at: string };

    const [commResult, ccResult, annResult] = await Promise.all([
      svc.from('communities').select('id, name').in('id', communityIds),
      svc.from('collaborator_communities')
        .select('collaborator_id, community_id, collaborators(id, nome, cognome, member_status, user_id)')
        .in('community_id', communityIds),
      svc.from('announcements')
        .select('id, titolo, published_at')
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(3),
    ]);

    const commRows    = commResult.data  as CommunityRow[] | null;
    const ccRawRows   = ccResult.data    as CCRow[] | null;
    const annRows     = annResult.data   as AnnRow[] | null;

    // Build lookup maps
    const allCollabIds: string[] = [...new Set((ccRawRows ?? []).map(r => r.collaborator_id))];
    const allUserIds:   string[] = [];
    const collabIdsByComm: Record<string, Set<string>> = {};
    const collabByCollabId: Record<string, { nome: string; cognome: string; member_status: string; user_id: string }> = {};
    const commNameMap: Record<string, string> = {};

    for (const c of commRows ?? []) commNameMap[c.id] = c.name;

    for (const row of ccRawRows ?? []) {
      if (!collabIdsByComm[row.community_id]) collabIdsByComm[row.community_id] = new Set();
      collabIdsByComm[row.community_id].add(row.collaborator_id);
      if (row.collaborators) {
        collabByCollabId[row.collaborator_id] = {
          nome: row.collaborators.nome ?? '',
          cognome: row.collaborators.cognome ?? '',
          member_status: row.collaborators.member_status,
          user_id: row.collaborators.user_id,
        };
        if (row.collaborators.user_id) allUserIds.push(row.collaborators.user_id);
      }
    }

    const noCollabs = allCollabIds.length === 0;
    const noUsers   = allUserIds.length === 0;

    // Round 3 — all data in parallel using collabIds + userIds
    type PComp   = { id: string; collaborator_id: string; community_id: string; created_at: string };
    type PExp    = { id: string; collaborator_id: string; created_at: string };
    type DocRow2 = { id: string; collaborator_id: string; community_id: string };
    type SComp   = { id: string; collaborator_id: string; community_id: string };
    type SExp    = { id: string; collaborator_id: string };
    type TRow    = { id: string; oggetto: string; stato: string; creator_user_id: string; created_at: string };

    const resolve = <T,>(v: T[]) => Promise.resolve({ data: v, error: null });

    const [pcRes, peRes, ddRes, scRes, seRes, tkRes] = await Promise.all([
      noCollabs ? resolve<PComp>([]) : svc.from('compensations')
        .select('id, collaborator_id, community_id, created_at')
        .in('collaborator_id', allCollabIds).eq('stato', 'INVIATO')
        .order('created_at', { ascending: false }).limit(20),
      noCollabs ? resolve<PExp>([]) : svc.from('expense_reimbursements')
        .select('id, collaborator_id, created_at')
        .in('collaborator_id', allCollabIds).eq('stato', 'INVIATO')
        .order('created_at', { ascending: false }).limit(20),
      noCollabs ? resolve<DocRow2>([]) : svc.from('documents')
        .select('id, collaborator_id, community_id')
        .in('collaborator_id', allCollabIds).eq('stato_firma', 'DA_FIRMARE'),
      noCollabs ? resolve<SComp>([]) : svc.from('compensations')
        .select('id, collaborator_id, community_id')
        .in('collaborator_id', allCollabIds)
        .neq('stato', 'PAGATO').neq('stato', 'RIFIUTATO').neq('stato', 'BOZZA'),
      noCollabs ? resolve<SExp>([]) : svc.from('expense_reimbursements')
        .select('id, collaborator_id')
        .in('collaborator_id', allCollabIds)
        .neq('stato', 'PAGATO').neq('stato', 'RIFIUTATO'),
      noUsers ? resolve<TRow>([]) : svc.from('tickets')
        .select('id, oggetto, stato, creator_user_id, created_at')
        .in('creator_user_id', allUserIds).neq('stato', 'CHIUSO')
        .order('created_at', { ascending: false }).limit(10),
    ]);

    const pendingComps = (pcRes.data ?? []) as PComp[];
    const pendingExps  = (peRes.data ?? []) as PExp[];
    const docsToSign   = (ddRes.data ?? []) as DocRow2[];
    const stalloComps  = (scRes.data ?? []) as SComp[];
    const stalloExps   = (seRes.data ?? []) as SExp[];
    const openTickets  = (tkRes.data ?? []) as TRow[];

    // ── Per-community stats ──────────────────────────────────
    const communityStats: CommStat[] = communityIds.map(commId => {
      const collabsInComm = collabIdsByComm[commId] ?? new Set<string>();
      return {
        id:           commId,
        name:         commNameMap[commId] ?? commId,
        pendingComps: pendingComps.filter(c => c.community_id === commId).length,
        pendingExps:  pendingExps.filter(e => collabsInComm.has(e.collaborator_id)).length,
        docsToSign:   docsToSign.filter(d => d.community_id === commId).length,
        totalCollabs: collabsInComm.size,
        stalloCount:  stalloComps.filter(c => c.community_id === commId).length +
                      stalloExps.filter(e => collabsInComm.has(e.collaborator_id)).length,
      };
    });

    // ── Cosa devo fare ───────────────────────────────────────
    const collabsWithDocs = new Set(docsToSign.map(d => d.collaborator_id)).size;
    const rCosaDevoFare = [
      pendingComps.length > 0 && {
        text: `${pendingComps.length} compensi in attesa di pre-approvazione`,
        href: '/approvazioni?tab=compensi',
      },
      pendingExps.length > 0 && {
        text: `${pendingExps.length} rimborsi in attesa di pre-approvazione`,
        href: '/approvazioni?tab=rimborsi',
      },
      collabsWithDocs > 0 && {
        text: `${collabsWithDocs} collaboratore${collabsWithDocs === 1 ? '' : 'i'} con documenti da firmare`,
        href: '/collaboratori?filter=documenti',
      },
      openTickets.length > 0 && {
        text: `${openTickets.length} ticket aperti nelle community`,
        href: '/ticket',
      },
    ].filter(Boolean) as { text: string; href: string }[];

    // ── Feed ─────────────────────────────────────────────────
    const rFeedItems: FeedItem[] = [];

    for (const c of pendingComps.slice(0, 5)) {
      const collab = collabByCollabId[c.collaborator_id];
      const name = collab ? `${collab.nome} ${collab.cognome}`.trim() : 'Collaboratore';
      rFeedItems.push({ key: `pc-${c.id}`, icon: 'comp', text: `Compenso inviato da ${name}`, date: c.created_at, href: `/collaboratori/${c.collaborator_id}` });
    }
    for (const e of pendingExps.slice(0, 5)) {
      const collab = collabByCollabId[e.collaborator_id];
      const name = collab ? `${collab.nome} ${collab.cognome}`.trim() : 'Collaboratore';
      rFeedItems.push({ key: `pe-${e.id}`, icon: 'exp', text: `Rimborso inviato da ${name}`, date: e.created_at, href: `/collaboratori/${e.collaborator_id}` });
    }
    for (const t of openTickets.slice(0, 4)) {
      rFeedItems.push({ key: `tk-${t.id}`, icon: 'ticket', text: `Ticket aperto: "${t.oggetto}"`, date: t.created_at, href: `/ticket/${t.id}` });
    }
    for (const a of annRows ?? []) {
      rFeedItems.push({ key: `ann-${a.id}`, icon: 'ann', text: a.titolo, date: a.published_at, href: '/contenuti?tab=bacheca' });
    }
    rFeedItems.sort((a, b) => b.date.localeCompare(a.date));
    const rFeed = rFeedItems.slice(0, 10);

    return (
      <div className="p-6 max-w-4xl space-y-6">
        <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>

        {/* Per-community overview cards */}
        <div className={`grid gap-4 ${communityStats.length === 1 ? 'grid-cols-1 max-w-sm' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {communityStats.map(stat => <CommCard key={stat.id} stat={stat} />)}
        </div>

        {/* Cosa devo fare */}
        {rCosaDevoFare.length > 0 && (
          <div className={sectionCls}>
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="text-sm font-medium text-gray-200">Cosa devo fare</h2>
            </div>
            <div className="p-5 space-y-2">
              {rCosaDevoFare.map(item => (
                <Link
                  key={item.href + item.text}
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg bg-amber-950/30 border border-amber-800/30 px-3 py-2.5 text-sm text-amber-300 hover:bg-amber-950/50 transition"
                >
                  <span className="flex-shrink-0 text-base">⚠</span>
                  {item.text}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Azioni rapide */}
        <div className={sectionCls}>
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-medium text-gray-200">Azioni rapide</h2>
          </div>
          <div className="p-5 flex flex-wrap gap-3">
            <Link href="/approvazioni" className="rounded-lg bg-blue-700 hover:bg-blue-600 px-4 py-2 text-sm font-medium text-white transition">
              Approvazioni
            </Link>
            <Link href="/collaboratori" className="rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 transition">
              Collaboratori
            </Link>
            <Link href="/ticket/nuova" className="rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 transition">
              + Apri ticket
            </Link>
          </div>
        </div>

        {/* Ultimi aggiornamenti */}
        <div className={sectionCls}>
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-medium text-gray-200">Ultimi aggiornamenti</h2>
          </div>
          <div className="px-4 py-2 divide-y divide-gray-800/50">
            {rFeed.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Nessun aggiornamento recente.</p>
            ) : (
              rFeed.map(item => <FeedRow key={item.key} item={item} />)
            )}
          </div>
        </div>
      </div>
    );
  }

  // Non-collaboratori (admin, super_admin): semplice benvenuto
  if (role !== 'collaboratore') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-100">Benvenuto</h1>
          <p className="mt-2 text-sm text-gray-500 capitalize">{role.replace('_', ' ')}</p>
        </div>
      </div>
    );
  }

  // Fetch collaborator record (needed for documents filter + profile completeness)
  const { data: collaborator } = await supabase
    .from('collaborators')
    .select('id, iban, codice_fiscale')
    .eq('user_id', user.id)
    .single();

  // Parallel main fetches
  const docsQuery = collaborator
    ? supabase.from('documents').select('id').eq('collaborator_id', collaborator.id).eq('stato_firma', 'DA_FIRMARE')
    : Promise.resolve({ data: null as { id: string }[] | null, error: null });

  const [
    { data: compensations },
    { data: expenses },
    { data: docsToSign },
    { data: allTickets },
    { data: announcements },
  ] = await Promise.all([
    supabase.from('compensations').select('id, tipo, stato, importo_netto, totale_fattura'),
    supabase.from('expense_reimbursements').select('id, stato, importo'),
    docsQuery,
    supabase.from('tickets').select('id, oggetto, stato').eq('creator_user_id', user.id),
    supabase
      .from('announcements')
      .select('id, titolo, published_at')
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(3),
  ]);

  // Derive IDs for second-tier queries
  const compIds = (compensations ?? []).map((c: CompRow) => c.id);
  const expIds   = (expenses ?? []).map((e: ExpRow) => e.id);
  const openTickets     = (allTickets ?? []).filter((t: { id: string; oggetto: string; stato: string }) => t.stato !== 'CHIUSO');
  const openTicketIds   = openTickets.map((t: { id: string }) => t.id);
  const ticketOggettoMap: Record<string, string> = Object.fromEntries(
    (allTickets ?? []).map((t: { id: string; oggetto: string }) => [t.id, t.oggetto]),
  );

  // Service client for ticket_messages (bypasses RLS — ticket service role pattern)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Parallel second-tier fetches
  type CompHistRow = { compensation_id: string; azione: string; created_at: string };
  type ExpHistRow  = { reimbursement_id: string; azione: string; created_at: string };
  type MsgRow      = { id: string; ticket_id: string; author_user_id: string; created_at: string };

  const [
    { data: compHistory },
    { data: expHistory },
    { data: ticketMsgs },
  ] = await Promise.all([
    compIds.length > 0
      ? supabase.from('compensation_history').select('compensation_id, azione, created_at').in('compensation_id', compIds).order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: null as CompHistRow[] | null, error: null }),
    expIds.length > 0
      ? supabase.from('expense_history').select('reimbursement_id, azione, created_at').in('reimbursement_id', expIds).order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: null as ExpHistRow[] | null, error: null }),
    openTicketIds.length > 0
      ? serviceClient.from('ticket_messages').select('id, ticket_id, author_user_id, created_at').in('ticket_id', openTicketIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: null as MsgRow[] | null, error: null }),
  ]);

  // ── Aggregations ──────────────────────────────────────────

  // Cards — compensi
  const activeComps    = (compensations ?? []).filter((c: CompRow) => ACTIVE_STATES.has(c.stato));
  const compTotal      = activeComps.reduce((s: number, c: CompRow) => s + compAmount(c), 0);
  const pendingComps   = activeComps.filter((c: CompRow) => c.stato === 'APPROVATO_ADMIN');
  const compPendingTot = pendingComps.reduce((s: number, c: CompRow) => s + compAmount(c), 0);

  // Cards — rimborsi
  const activeExps    = (expenses ?? []).filter((e: ExpRow) => ACTIVE_STATES.has(e.stato));
  const expTotal      = activeExps.reduce((s: number, e: ExpRow) => s + (e.importo ?? 0), 0);
  const pendingExps   = activeExps.filter((e: ExpRow) => e.stato === 'APPROVATO_ADMIN');
  const expPendingTot = pendingExps.reduce((s: number, e: ExpRow) => s + (e.importo ?? 0), 0);

  // Card — documenti da firmare
  const daFirmareCount = (docsToSign ?? []).length;

  // Cosa mi manca
  const integrazioniCount =
    (compensations ?? []).filter((c: CompRow) => c.stato === 'INTEGRAZIONI_RICHIESTE').length +
    (expenses ?? []).filter((e: ExpRow) => e.stato === 'INTEGRAZIONI_RICHIESTE').length;

  // Ticket senza risposta: last message per ticket not from current user
  const lastMsgByTicket: Record<string, MsgRow> = {};
  for (const msg of (ticketMsgs ?? []) as MsgRow[]) {
    if (!lastMsgByTicket[msg.ticket_id]) lastMsgByTicket[msg.ticket_id] = msg;
  }
  const ticketNeedsReply = openTicketIds.filter((id: string) => {
    const last = lastMsgByTicket[id];
    return last && last.author_user_id !== user.id;
  }).length;

  const profiloIncompleto = !collaborator?.iban || !collaborator?.codice_fiscale;

  const cosaMiManca = [
    integrazioniCount > 0 && {
      text: `${integrazioniCount} richiesta${integrazioniCount === 1 ? '' : 'e'} che richied${integrazioniCount === 1 ? 'e' : 'ono'} integrazione`,
      href: '/compensi',
    },
    daFirmareCount > 0 && {
      text: `${daFirmareCount} documento${daFirmareCount === 1 ? '' : 'i'} da firmare`,
      href: '/documenti',
    },
    ticketNeedsReply > 0 && {
      text: `${ticketNeedsReply} ticket in attesa di risposta`,
      href: '/ticket',
    },
    profiloIncompleto && {
      text: 'Completa il tuo profilo (IBAN o codice fiscale mancante)',
      href: '/profilo',
    },
  ].filter(Boolean) as { text: string; href: string }[];

  // Feed
  const feedItems: FeedItem[] = [];

  for (const h of (compHistory ?? []) as CompHistRow[]) {
    feedItems.push({
      key:  `ch-${h.compensation_id}-${h.created_at}`,
      icon: 'comp',
      text: `Compenso ${ACTION_LABELS[h.azione] ?? h.azione}`,
      date: h.created_at,
      href: `/compensi/${h.compensation_id}`,
    });
  }

  for (const h of (expHistory ?? []) as ExpHistRow[]) {
    feedItems.push({
      key:  `eh-${h.reimbursement_id}-${h.created_at}`,
      icon: 'exp',
      text: `Rimborso ${ACTION_LABELS[h.azione] ?? h.azione}`,
      date: h.created_at,
      href: `/rimborsi/${h.reimbursement_id}`,
    });
  }

  const seenTicketFeed = new Set<string>();
  for (const m of (ticketMsgs ?? []) as MsgRow[]) {
    if (m.author_user_id !== user.id && !seenTicketFeed.has(m.ticket_id)) {
      seenTicketFeed.add(m.ticket_id);
      feedItems.push({
        key:  `tm-${m.id}`,
        icon: 'ticket',
        text: `Risposta ricevuta: "${ticketOggettoMap[m.ticket_id] ?? 'Ticket'}"`,
        date: m.created_at,
        href: `/ticket/${m.ticket_id}`,
      });
    }
  }

  for (const a of (announcements ?? []) as { id: string; titolo: string; published_at: string }[]) {
    feedItems.push({
      key:  `ann-${a.id}`,
      icon: 'ann',
      text: a.titolo,
      date: a.published_at,
      href: '/contenuti?tab=bacheca',
    });
  }

  feedItems.sort((a, b) => b.date.localeCompare(a.date));
  const feed = feedItems.slice(0, 10);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>

      {/* Card di riepilogo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Compensi"
          count={activeComps.length}
          total={compTotal}
          pendingCount={pendingComps.length}
          pendingTotal={compPendingTot}
        />
        <StatCard
          label="Rimborsi"
          count={activeExps.length}
          total={expTotal}
          pendingCount={pendingExps.length}
          pendingTotal={expPendingTot}
        />
        <DocCard count={daFirmareCount} />
      </div>

      {/* Azioni rapide */}
      <div className={sectionCls}>
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-medium text-gray-200">Azioni rapide</h2>
        </div>
        <div className="p-5 flex flex-wrap gap-3">
          <Link
            href="/compensi/nuova"
            className="rounded-lg bg-blue-700 hover:bg-blue-600 px-4 py-2 text-sm font-medium text-white transition"
          >
            + Nuovo compenso
          </Link>
          <Link
            href="/rimborsi/nuova"
            className="rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 transition"
          >
            + Nuovo rimborso
          </Link>
          <Link
            href="/ticket/nuova"
            className="rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 transition"
          >
            + Apri ticket
          </Link>
        </div>
      </div>

      {/* Cosa mi manca */}
      {cosaMiManca.length > 0 && (
        <div className={sectionCls}>
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-medium text-gray-200">Cosa mi manca</h2>
          </div>
          <div className="p-5 space-y-2">
            {cosaMiManca.map((item) => (
              <Link
                key={item.href + item.text}
                href={item.href}
                className="flex items-center gap-2 rounded-lg bg-amber-950/30 border border-amber-800/30 px-3 py-2.5 text-sm text-amber-300 hover:bg-amber-950/50 transition"
              >
                <span className="flex-shrink-0 text-base">⚠</span>
                {item.text}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Ultimi aggiornamenti */}
      <div className={sectionCls}>
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-medium text-gray-200">Ultimi aggiornamenti</h2>
        </div>
        <div className="px-4 py-2 divide-y divide-gray-800/50">
          {feed.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nessun aggiornamento recente.</p>
          ) : (
            feed.map((item) => <FeedRow key={item.key} item={item} />)
          )}
        </div>
      </div>
    </div>
  );
}
