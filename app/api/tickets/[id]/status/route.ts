import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { TicketStatus } from '@/lib/types';

const VALID_STATI: TicketStatus[] = ['APERTO', 'IN_LAVORAZIONE', 'CHIUSO'];

export async function PATCH(
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
  if (!['amministrazione', 'super_admin', 'responsabile'].includes(profile.role)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 });
  }

  const body = await request.json();
  const { stato } = body as { stato: TicketStatus };

  if (!stato || !VALID_STATI.includes(stato)) {
    return NextResponse.json({ error: 'Stato non valido' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: ticket, error } = await serviceClient
    .from('tickets')
    .update({ stato })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ticket });
}
