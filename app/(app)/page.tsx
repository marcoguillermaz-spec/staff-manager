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

  // Non-collaboratori: semplice benvenuto
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
    supabase.from('compensations').select('id, tipo, stato, importo_netto, totale_fattura').eq('user_id', user.id),
    supabase.from('expense_reimbursements').select('id, stato, importo').eq('user_id', user.id),
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
