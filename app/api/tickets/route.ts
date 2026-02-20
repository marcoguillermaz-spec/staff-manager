import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { TicketStatus } from '@/lib/types';

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

  const { searchParams } = new URL(request.url);
  const statoFilter = searchParams.get('stato') as TicketStatus | null;

  let query = supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (statoFilter) query = query.eq('stato', statoFilter);

  const { data: tickets, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For admin/responsabile, enrich with creator name from collaborators
  const isManager = ['amministrazione', 'super_admin', 'responsabile'].includes(profile.role);
  if (isManager && tickets && tickets.length > 0) {
    const creatorIds = [...new Set(tickets.map((t) => t.creator_user_id))];
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: collabs } = await serviceClient
      .from('collaborators')
      .select('user_id, nome, cognome')
      .in('user_id', creatorIds);

    const collabMap = Object.fromEntries(
      (collabs ?? []).map((c) => [c.user_id, `${c.nome} ${c.cognome}`]),
    );

    const enriched = tickets.map((t) => ({
      ...t,
      creator_name: collabMap[t.creator_user_id] ?? null,
    }));

    return NextResponse.json({ tickets: enriched });
  }

  return NextResponse.json({ tickets: tickets ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });

  const body = await request.json();
  const { categoria, oggetto, messaggio } = body as {
    categoria: string;
    oggetto: string;
    messaggio?: string;
  };

  if (!categoria?.trim() || !oggetto?.trim()) {
    return NextResponse.json({ error: 'Categoria e oggetto sono obbligatori' }, { status: 400 });
  }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      creator_user_id: user.id,
      categoria: categoria.trim(),
      oggetto: oggetto.trim(),
      stato: 'APERTO',
      priority: 'NORMALE',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optionally create first message
  if (messaggio?.trim()) {
    await supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      author_user_id: user.id,
      message: messaggio.trim(),
    });
  }

  return NextResponse.json({ ticket }, { status: 201 });
}
