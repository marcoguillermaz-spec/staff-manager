import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { canExpenseTransition, applyExpenseTransition } from '@/lib/expense-transitions';
import type { ExpenseAction } from '@/lib/expense-transitions';
import { ROLE_LABELS } from '@/lib/types';
import type { Role, ExpenseStatus } from '@/lib/types';
import { buildExpenseNotification, EXPENSE_NOTIFIED_ACTIONS } from '@/lib/notification-utils';
import type { NotificationPayload } from '@/lib/notification-utils';

const transitionSchema = z.object({
  action: z.enum([
    'resubmit',
    'approve_manager',
    'request_integration',
    'reject_manager',
    'approve_admin',
    'reject',
    'mark_paid',
  ]),
  note: z.string().optional(),
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

  const { data: expense, error: fetchError } = await supabase
    .from('expense_reimbursements')
    .select('id, stato, collaborator_id')
    .eq('id', id)
    .single();

  if (fetchError || !expense) {
    return NextResponse.json({ error: 'Rimborso non trovato' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  const { action, note, payment_reference } = parsed.data;
  const currentStato = expense.stato as ExpenseStatus;

  const check = canExpenseTransition(role, currentStato, action as ExpenseAction, note);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 403 });
  }

  const newStato = applyExpenseTransition(action as ExpenseAction);

  const updatePayload: Record<string, unknown> = { stato: newStato };

  if (action === 'approve_manager') {
    updatePayload.manager_approved_by = user.id;
    updatePayload.manager_approved_at = new Date().toISOString();
  }
  if (action === 'request_integration') {
    updatePayload.integration_note = note ?? null;
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

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error: updateError } = await serviceClient
    .from('expense_reimbursements')
    .update(updatePayload)
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: historyError } = await serviceClient
    .from('expense_history')
    .insert({
      reimbursement_id: id,
      stato_precedente: currentStato,
      stato_nuovo: newStato,
      changed_by: user.id,
      role_label: ROLE_LABELS[role],
      note: note ?? null,
    });

  if (historyError) {
    console.error('Expense history insert failed:', historyError.message);
  }

  // Insert notification for collaboratore on state-changing actions
  // reject_manager maps to the same notification as reject
  const notifAction = action === 'reject_manager' ? 'reject' : action;
  if ((EXPENSE_NOTIFIED_ACTIONS as string[]).includes(notifAction)) {
    const { data: collab } = await serviceClient
      .from('collaborators')
      .select('user_id')
      .eq('id', expense.collaborator_id)
      .single();

    if (collab?.user_id) {
      const notif: NotificationPayload = buildExpenseNotification(
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
