import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { canTransition, applyTransition } from '@/lib/compensation-transitions';
import type { CompensationAction } from '@/lib/compensation-transitions';
import { ROLE_LABELS } from '@/lib/types';
import type { Role, CompensationStatus } from '@/lib/types';
import { buildCompensationNotification, COMPENSATION_NOTIFIED_ACTIONS } from '@/lib/notification-utils';
import type { NotificationPayload } from '@/lib/notification-utils';

const transitionSchema = z.object({
  action: z.enum([
    'submit',
    'withdraw',
    'resubmit',
    'approve_manager',
    'request_integration',
    'reject_manager',
    'approve_admin',
    'reject',
    'mark_paid',
  ]),
  note: z.string().optional(),
  reasons: z.array(z.string()).optional(),
  payment_reference: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });

  const { id } = await params;
  const role = profile.role as Role;

  // Fetch current compensation (RLS filters access)
  const { data: comp, error: fetchError } = await supabase
    .from('compensations')
    .select('id, stato, collaborator_id, community_id')
    .eq('id', id)
    .single();

  if (fetchError || !comp) {
    return NextResponse.json({ error: 'Compenso non trovato' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  const { action, note, reasons, payment_reference } = parsed.data;
  const currentStato = comp.stato as CompensationStatus;

  // Validate transition
  const check = canTransition(role, currentStato, action as CompensationAction, note);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 403 });
  }

  const newStato = applyTransition(action as CompensationAction);

  // Build update payload
  const updatePayload: Record<string, unknown> = { stato: newStato };

  if (action === 'approve_manager') {
    updatePayload.manager_approved_by = user.id;
    updatePayload.manager_approved_at = new Date().toISOString();
  }
  if (action === 'request_integration') {
    updatePayload.integration_note = note ?? null;
    updatePayload.integration_reasons = reasons ?? null;
  }
  if (action === 'approve_admin') {
    updatePayload.admin_approved_by = user.id;
    updatePayload.admin_approved_at = new Date().toISOString();
  }
  if (action === 'mark_paid') {
    updatePayload.paid_at = new Date().toISOString();
    updatePayload.paid_by = user.id;
    updatePayload.payment_reference = payment_reference ?? null;
  }

  // Use service role to bypass RLS for transitions the collaboratore RLS doesn't cover
  // (withdraw: INVIATO→BOZZA, resubmit: INTEGRAZIONI_RICHIESTE→INVIATO)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error: updateError } = await serviceClient
    .from('compensations')
    .update(updatePayload)
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Insert history entry
  const { error: historyError } = await serviceClient
    .from('compensation_history')
    .insert({
      compensation_id: id,
      stato_precedente: currentStato,
      stato_nuovo: newStato,
      changed_by: user.id,
      role_label: ROLE_LABELS[role],
      note: note ?? null,
    });

  if (historyError) {
    console.error('History insert failed:', historyError.message);
  }

  // Insert notification for collaboratore on state-changing actions
  // reject_manager maps to the same notification as reject
  const notifAction = action === 'reject_manager' ? 'reject' : action;
  if ((COMPENSATION_NOTIFIED_ACTIONS as string[]).includes(notifAction)) {
    const { data: collab } = await serviceClient
      .from('collaborators')
      .select('user_id')
      .eq('id', comp.collaborator_id)
      .single();

    if (collab?.user_id) {
      const notif: NotificationPayload = buildCompensationNotification(
        notifAction as 'request_integration' | 'approve_admin' | 'reject' | 'mark_paid',
        collab.user_id,
        id,
        note,
      );
      const { error: notifError } = await serviceClient.from('notifications').insert(notif);
      if (notifError) console.error('Notification insert failed:', notifError.message);
    }
  }

  return NextResponse.json({ stato: newStato });
}
