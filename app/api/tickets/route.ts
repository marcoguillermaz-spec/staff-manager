import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { TicketStatus } from '@/lib/types';
import { buildTicketCreatedNotification } from '@/lib/notification-utils';
import {
  getNotificationSettings,
  getResponsabiliForUser,
} from '@/lib/notification-helpers';
import { sendEmail } from '@/lib/email';
import { emailNuovoTicket } from '@/lib/email-templates';

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
  const isManager = ['amministrazione', 'responsabile_compensi'].includes(profile.role);
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

  // Notify responsabili if creator is a collaboratore
  if (profile.role === 'collaboratore') {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const [settings, responsabili] = await Promise.all([
      getNotificationSettings(svc),
      getResponsabiliForUser(user.id, svc),
    ]);
    const setting = settings.get('ticket_creato:responsabile_compensi');
    if ((setting?.inapp_enabled || setting?.email_enabled) && responsabili.length > 0) {
      const dataFormatted = new Date().toLocaleDateString('it-IT');
      // Get collaborator name for email
      const { data: collabRec } = await svc
        .from('collaborators')
        .select('nome, cognome')
        .eq('user_id', user.id)
        .single();
      const nomeColl = collabRec ? `${collabRec.nome} ${collabRec.cognome}`.trim() : '';
      for (const resp of responsabili) {
        if (setting?.inapp_enabled) {
          svc.from('notifications').insert(buildTicketCreatedNotification(resp.user_id, ticket.id, oggetto.trim())).then(() => {});
        }
        if (setting?.email_enabled && resp.email) {
          const { subject, html } = emailNuovoTicket({
            nomeResponsabile: resp.nome,
            nomeCollaboratore: nomeColl,
            oggetto: oggetto.trim(),
            categoria: categoria.trim(),
            data: dataFormatted,
          });
          sendEmail(resp.email, subject, html).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ ticket }, { status: 201 });
}
