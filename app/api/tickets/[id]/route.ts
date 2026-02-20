import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';

const BUCKET = 'tickets';
const SIGNED_URL_TTL = 60 * 60; // 1 hour

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });

  // Fetch ticket (RLS ensures access)
  const { data: ticket, error: ticketErr } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single();

  if (ticketErr || !ticket) {
    return NextResponse.json({ error: 'Ticket non trovato' }, { status: 404 });
  }

  // Fetch messages
  const { data: rawMessages, error: msgErr } = await supabase
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  const messages = rawMessages ?? [];

  // Resolve author role labels (service role to bypass RLS on user_profiles)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

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

  // Generate signed URLs for messages with attachments
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
        ...m,
        is_own,
        author_label,
        signed_attachment_url,
      };
    }),
  );

  return NextResponse.json({
    ticket,
    messages: messagesWithMeta,
    current_user_id: user.id,
    current_user_role: profile.role,
  });
}
