import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const ADMIN_ROLES = ['amministrazione'];
const VALID_STATUSES = ['attivo', 'uscente_con_compenso', 'uscente_senza_compenso'] as const;
type MemberStatus = typeof VALID_STATUSES[number];

// PATCH — update member_status for a collaborator (by collaborator.id)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params; // collaborator.id
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });
  if (!ADMIN_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });

  const { member_status } = await request.json() as { member_status: MemberStatus };
  if (!VALID_STATUSES.includes(member_status)) {
    return NextResponse.json({ error: 'Valore member_status non valido' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Resolve user_id from collaborator.id
  const { data: collab } = await serviceClient
    .from('collaborators')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!collab) return NextResponse.json({ error: 'Collaboratore non trovato' }, { status: 404 });

  const { error } = await serviceClient
    .from('user_profiles')
    .update({ member_status })
    .eq('user_id', collab.user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: true });
}
