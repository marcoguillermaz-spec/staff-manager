import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { buildTicketReplyNotification } from '@/lib/notification-utils';

const BUCKET = 'tickets';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: ticketId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });

  // Use service role for all DB operations to avoid SSR auth cookie ambiguities
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch ticket via service role (bypasses RLS — access control done explicitly below)
  const { data: ticket, error: ticketErr } = await serviceClient
    .from('tickets')
    .select('id, creator_user_id, oggetto, stato')
    .eq('id', ticketId)
    .single();

  if (ticketErr || !ticket) {
    return NextResponse.json({ error: 'Ticket non trovato' }, { status: 404 });
  }

  // Explicit access check: only creator or admin/responsabile can reply
  const canAccess =
    ticket.creator_user_id === user.id ||
    ['amministrazione', 'super_admin', 'responsabile'].includes(profile.role);

  if (!canAccess) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 });
  }

  if (ticket.stato === 'CHIUSO') {
    return NextResponse.json({ error: 'Il ticket è chiuso' }, { status: 400 });
  }

  const formData = await request.formData();
  const message = (formData.get('message') as string | null)?.trim();
  const file = formData.get('file') as File | null;

  if (!message) {
    return NextResponse.json({ error: 'Il messaggio è obbligatorio' }, { status: 400 });
  }

  // Upload attachment if provided
  let attachment_url: string | null = null;
  let attachment_name: string | null = null;

  if (file && file.size > 0) {
    const messageId = crypto.randomUUID();
    const storagePath = `${ticketId}/${messageId}/${file.name}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await serviceClient.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json({ error: `Errore upload: ${uploadErr.message}` }, { status: 500 });
    }

    attachment_url = storagePath;
    attachment_name = file.name;
  }

  // Insert message (service role to bypass RLS complexity with storage path)
  const { data: msg, error: msgErr } = await serviceClient
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      author_user_id: user.id,
      message,
      attachment_url,
      attachment_name,
    })
    .select()
    .single();

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  // Notify ticket creator if the author is not the creator
  if (ticket.creator_user_id !== user.id) {
    const notif = buildTicketReplyNotification(
      ticket.creator_user_id,
      ticketId,
      ticket.oggetto,
    );
    await serviceClient.from('notifications').insert(notif);
  }

  return NextResponse.json({ message: msg }, { status: 201 });
}
