import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  payment_reference: z.string().min(1),
  table: z.enum(['compensations', 'expenses']),
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
  if (!['amministrazione'].includes(profile.role)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  const { ids, payment_reference, table } = parsed.data;
  const role = profile.role as Role;

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const now = new Date().toISOString();

  if (table === 'compensations') {
    const { data: updated, error: updateError } = await serviceClient
      .from('compensations')
      .update({
        stato: 'PAGATO',
        paid_at: now,
        paid_by: user.id,
        payment_reference,
      })
      .in('id', ids)
      .eq('stato', 'APPROVATO_ADMIN')
      .select('id, stato');

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const updatedIds = (updated ?? []).map((r: { id: string }) => r.id);

    if (updatedIds.length > 0) {
      const historyRows = updatedIds.map((id: string) => ({
        compensation_id: id,
        stato_precedente: 'APPROVATO_ADMIN',
        stato_nuovo: 'PAGATO',
        changed_by: user.id,
        role_label: ROLE_LABELS[role],
        note: `Pagamento registrato — riferimento: ${payment_reference}`,
      }));

      const { error: historyError } = await serviceClient
        .from('compensation_history')
        .insert(historyRows);

      if (historyError) {
        console.error('Compensation history insert failed:', historyError.message);
      }
    }

    return NextResponse.json({ updated: updatedIds.length });
  }

  // table === 'expenses'
  const { data: updated, error: updateError } = await serviceClient
    .from('expense_reimbursements')
    .update({
      stato: 'PAGATO',
      paid_at: now,
      paid_by: user.id,
      payment_reference,
    })
    .in('id', ids)
    .eq('stato', 'APPROVATO_ADMIN')
    .select('id, stato');

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const updatedIds = (updated ?? []).map((r: { id: string }) => r.id);

  if (updatedIds.length > 0) {
    const historyRows = updatedIds.map((id: string) => ({
      reimbursement_id: id,
      stato_precedente: 'APPROVATO_ADMIN',
      stato_nuovo: 'PAGATO',
      changed_by: user.id,
      role_label: ROLE_LABELS[role],
      note: `Pagamento registrato — riferimento: ${payment_reference}`,
    }));

    const { error: historyError } = await serviceClient
      .from('expense_history')
      .insert(historyRows);

    if (historyError) {
      console.error('Expense history insert failed:', historyError.message);
    }
  }

  return NextResponse.json({ updated: updatedIds.length });
}
