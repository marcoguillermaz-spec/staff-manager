import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import TicketStatusBadge from '@/components/ticket/TicketStatusBadge';
import TicketThread from '@/components/ticket/TicketThread';
import TicketMessageForm from '@/components/ticket/TicketMessageForm';
import { TICKET_PRIORITY_LABELS, ROLE_LABELS } from '@/lib/types';
import type { Role, TicketStatus } from '@/lib/types';

const BUCKET = 'tickets';
const SIGNED_URL_TTL = 60 * 60;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const PRIORITY_DOT: Record<string, string> = {
  ALTA:    'bg-red-500',
  NORMALE: 'bg-yellow-500',
  BASSA:   'bg-gray-500',
};

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');

  const role = profile.role as Role;

  // Fetch ticket (RLS ensures access)
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single();

  if (!ticket) notFound();

  // Fetch messages
  const { data: rawMessages } = await supabase
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  const messages = rawMessages ?? [];

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Resolve author role labels
  const authorIds = [...new Set(messages.map((m) => m.author_user_id))];
  let roleMap: Record<string, Role> = {};

  if (authorIds.length > 0) {
    const { data: profiles } = await serviceClient
      .from('user_profiles')
      .select('user_id, role')
      .in('user_id', authorIds);

    roleMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.user_id, p.role as Role]),
    );
  }

  // Generate signed URLs + compute author labels
  const messagesWithMeta = await Promise.all(
    messages.map(async (m) => {
      let signed_attachment_url: string | null = null;
      if (m.attachment_url) {
        const { data } = await serviceClient.storage
          .from(BUCKET)
          .createSignedUrl(m.attachment_url, SIGNED_URL_TTL);
        signed_attachment_url = data?.signedUrl ?? null;
      }

      const authorRole = roleMap[m.author_user_id] ?? 'collaboratore';
      const is_own = m.author_user_id === user.id;
      const author_label = is_own ? 'Tu' : ROLE_LABELS[authorRole];

      return {
        id: m.id,
        author_label,
        is_own,
        message: m.message,
        attachment_name: m.attachment_name ?? null,
        signed_attachment_url,
        created_at: m.created_at,
      };
    }),
  );

  const canChangeStatus = ['amministrazione', 'responsabile'].includes(role);

  return (
    <div className="p-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/ticket" className="text-sm text-gray-500 hover:text-gray-300 transition">
          ← Ticket
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-semibold text-gray-100 truncate">{ticket.oggetto}</h1>
      </div>

      {/* Ticket header */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 mb-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{ticket.categoria}</p>
            <h2 className="text-base font-semibold text-gray-100">{ticket.oggetto}</h2>
          </div>
          <TicketStatusBadge stato={ticket.stato as TicketStatus} />
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[ticket.priority] ?? 'bg-gray-500'}`} />
            Priorità {TICKET_PRIORITY_LABELS[ticket.priority as keyof typeof TICKET_PRIORITY_LABELS] ?? ticket.priority}
          </span>
          <span>Aperto il {formatDate(ticket.created_at)}</span>
        </div>
      </div>

      {/* Thread */}
      <div className="mb-5">
        <TicketThread messages={messagesWithMeta} ticketStato={ticket.stato as TicketStatus} />
      </div>

      {/* Reply form */}
      {ticket.stato !== 'CHIUSO' && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">
            {canChangeStatus ? 'Rispondi / Gestisci ticket' : 'Rispondi'}
          </h3>
          <TicketMessageForm
            ticketId={id}
            ticketStato={ticket.stato as TicketStatus}
            currentUserRole={role}
          />
        </div>
      )}
    </div>
  );
}
