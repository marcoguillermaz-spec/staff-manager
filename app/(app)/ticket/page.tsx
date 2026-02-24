import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import TicketList from '@/components/ticket/TicketList';
import type { Role } from '@/lib/types';

export default async function TicketPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active, member_status')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');

  const role = profile.role as Role;
  if (role === 'collaboratore' && profile.member_status === 'uscente_senza_compenso') redirect('/documenti');

  // Fetch tickets (RLS auto-filters by role)
  let tickets: Record<string, unknown>[] = [];

  const { data: rawTickets } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (rawTickets && rawTickets.length > 0) {
    const isManager = ['amministrazione', 'super_admin', 'responsabile'].includes(role);

    if (isManager) {
      // Enrich with creator name
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      const creatorIds = [...new Set(rawTickets.map((t) => t.creator_user_id))];
      const { data: collabs } = await serviceClient
        .from('collaborators')
        .select('user_id, nome, cognome')
        .in('user_id', creatorIds);

      const collabMap = Object.fromEntries(
        (collabs ?? []).map((c) => [c.user_id, `${c.nome} ${c.cognome}`]),
      );

      tickets = rawTickets.map((t) => ({
        ...t,
        creator_name: collabMap[t.creator_user_id] ?? null,
      }));
    } else {
      tickets = rawTickets;
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Ticket</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {['amministrazione', 'super_admin', 'responsabile'].includes(role)
            ? 'Gestione ticket aperti dai collaboratori.'
            : 'Le tue richieste di supporto.'}
        </p>
      </div>

      <TicketList
        tickets={tickets as Parameters<typeof TicketList>[0]['tickets']}
        role={role}
      />
    </div>
  );
}
