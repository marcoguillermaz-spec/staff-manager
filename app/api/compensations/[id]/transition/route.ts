import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { canTransition, applyTransition } from '@/lib/compensation-transitions';
import type { CompensationAction } from '@/lib/compensation-transitions';
import { ROLE_LABELS } from '@/lib/types';
import type { Role, CompensationStatus } from '@/lib/types';
import {
  buildCompensationNotification,
  COMPENSATION_NOTIFIED_ACTIONS,
  buildCompensationSubmitNotification,
} from '@/lib/notification-utils';
import type { NotificationPayload } from '@/lib/notification-utils';
import {
  getNotificationSettings,
  getCollaboratorInfo,
  getResponsabiliForCommunity,
} from '@/lib/notification-helpers';
import { sendEmail } from '@/lib/email';
import {
  emailApprovato,
  emailRifiutato,
  emailPagato,
  emailNuovoInviato,
} from '@/lib/email-templates';

const transitionSchema = z.object({
  action: z.enum([
    'submit',
    'withdraw',
    'reopen',
    'approve',
    'reject',
    'mark_liquidated',
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

  // Fetch current compensation (RLS filters access)
  const { data: comp, error: fetchError } = await supabase
    .from('compensations')
    .select('id, stato, collaborator_id, community_id, importo_lordo, data_competenza')
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

  const { action, note, payment_reference } = parsed.data;
  const currentStato = comp.stato as CompensationStatus;

  // Validate transition
  const check = canTransition(role, currentStato, action as CompensationAction, note);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 403 });
  }

  const newStato = applyTransition(action as CompensationAction);

  // Build update payload
  const updatePayload: Record<string, unknown> = { stato: newStato };

  if (action === 'approve') {
    updatePayload.approved_by = user.id;
    updatePayload.approved_at = new Date().toISOString();
  }
  if (action === 'reject') {
    updatePayload.rejection_note = note ?? null;
  }
  if (action === 'mark_liquidated') {
    updatePayload.liquidated_at = new Date().toISOString();
    updatePayload.liquidated_by = user.id;
    updatePayload.payment_reference = payment_reference ?? null;
  }

  // Use service role to bypass RLS for transitions the collaboratore RLS doesn't cover
  // (withdraw: IN_ATTESA→BOZZA, reopen: RIFIUTATO→BOZZA)
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

  // Load notification settings
  const settings = await getNotificationSettings(serviceClient);

  // ── Notify responsabili on submit ────────────────────────────
  if (action === 'submit' && comp.community_id) {
    const setting = settings.get('comp_inviato:responsabile_compensi');
    if (setting?.inapp_enabled || setting?.email_enabled) {
      const [responsabili, collabInfo, commRes] = await Promise.all([
        getResponsabiliForCommunity(comp.community_id, serviceClient),
        getCollaboratorInfo(comp.collaborator_id, serviceClient),
        serviceClient.from('communities').select('name').eq('id', comp.community_id).single(),
      ]);
      const communityName = (commRes.data as { name?: string } | null)?.name ?? '';
      const dataFormatted = comp.data_competenza
        ? new Date(comp.data_competenza).toLocaleDateString('it-IT')
        : '';
      for (const resp of responsabili) {
        if (setting.inapp_enabled) {
          await serviceClient
            .from('notifications')
            .insert(buildCompensationSubmitNotification(resp.user_id, id));
        }
        if (setting.email_enabled && resp.email) {
          const { subject, html } = emailNuovoInviato({
            nomeResponsabile: resp.nome,
            nomeCollaboratore: `${collabInfo?.nome ?? ''} ${collabInfo?.cognome ?? ''}`.trim(),
            tipo: 'Compenso',
            importo: comp.importo_lordo ?? 0,
            community: communityName,
            data: dataFormatted,
          });
          sendEmail(resp.email, subject, html).catch(() => {});
        }
      }
    }
  }

  // ── Notify collaboratore on manager/admin actions ─────────────
  if ((COMPENSATION_NOTIFIED_ACTIONS as string[]).includes(action)) {
    const collabInfo = await getCollaboratorInfo(comp.collaborator_id, serviceClient);

    if (collabInfo?.user_id) {
      const notif: NotificationPayload = buildCompensationNotification(
        action as 'approve' | 'reject' | 'mark_liquidated',
        collabInfo.user_id,
        id,
        note,
      );

      const eventKeyMap: Record<string, string> = {
        approve:         'comp_approvato',
        reject:          'comp_rifiutato',
        mark_liquidated: 'comp_pagato',
      };
      const eventKey = eventKeyMap[action];
      const setting = eventKey ? settings.get(`${eventKey}:collaboratore`) : undefined;

      if (!setting || setting.inapp_enabled) {
        const { error: notifError } = await serviceClient.from('notifications').insert(notif);
        if (notifError) console.error('Notification insert failed:', notifError.message);
      }

      if (setting?.email_enabled && collabInfo.email) {
        const dataFormatted = comp.data_competenza
          ? new Date(comp.data_competenza).toLocaleDateString('it-IT')
          : '';
        const baseParams = {
          nome: collabInfo.nome,
          tipo: 'Compenso' as const,
          importo: comp.importo_lordo ?? 0,
          data: dataFormatted,
        };
        let emailPayload: { subject: string; html: string } | null = null;
        if (action === 'approve') {
          emailPayload = emailApprovato(baseParams);
        } else if (action === 'reject') {
          emailPayload = emailRifiutato(baseParams);
        } else if (action === 'mark_liquidated') {
          emailPayload = emailPagato({ nome: collabInfo.nome, tipo: 'Compenso', importo: comp.importo_lordo ?? 0, dataPagamento: dataFormatted });
        }
        if (emailPayload) {
          sendEmail(collabInfo.email, emailPayload.subject, emailPayload.html).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ stato: newStato });
}
