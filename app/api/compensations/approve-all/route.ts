import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';

const bodySchema = z.object({
  community_id: z.string().uuid(),
});

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
  if (!['responsabile_compensi', 'amministrazione'].includes(profile.role)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  const { community_id } = parsed.data;
  const role = profile.role as Role;

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Responsabile: verify they manage this community
  if (role === 'responsabile_compensi') {
    const { data: access } = await serviceClient
      .from('user_community_access')
      .select('community_id')
      .eq('user_id', user.id)
      .eq('community_id', community_id)
      .single();

    if (!access) {
      return NextResponse.json({ error: 'Community non gestita' }, { status: 403 });
    }
  }

  const now = new Date().toISOString();

  // Fetch all IN_ATTESA compensations for this community
  const { data: toApprove, error: fetchError } = await serviceClient
    .from('compensations')
    .select('id')
    .eq('community_id', community_id)
    .eq('stato', 'IN_ATTESA');

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!toApprove || toApprove.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const ids = toApprove.map((r: { id: string }) => r.id);

  const { error: updateError } = await serviceClient
    .from('compensations')
    .update({
      stato: 'APPROVATO',
      approved_by: user.id,
      approved_at: now,
    })
    .in('id', ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const historyRows = ids.map((id: string) => ({
    compensation_id: id,
    stato_precedente: 'IN_ATTESA',
    stato_nuovo: 'APPROVATO',
    changed_by: user.id,
    role_label: ROLE_LABELS[role],
    note: null,
  }));

  const { error: historyError } = await serviceClient
    .from('compensation_history')
    .insert(historyRows);

  if (historyError) {
    console.error('Compensation history insert failed:', historyError.message);
  }

  return NextResponse.json({ updated: ids.length });
}
