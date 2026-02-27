// Pure utility functions for building notification payloads.
// Used by API route handlers to insert into the `notifications` table.

export type NotificationEntityType = 'compensation' | 'reimbursement' | 'document' | 'ticket';

export interface NotificationPayload {
  user_id: string;
  tipo: string;
  titolo: string;
  messaggio: string;
  entity_type: NotificationEntityType;
  entity_id: string;
}

type CompensationNotifiableAction = 'approve' | 'reject' | 'mark_liquidated';
type ExpenseNotifiableAction = 'approve' | 'reject' | 'mark_liquidated';

export function buildCompensationNotification(
  action: CompensationNotifiableAction,
  userId: string,
  entityId: string,
  note?: string | null,
): NotificationPayload {
  const base = { user_id: userId, entity_type: 'compensation' as const, entity_id: entityId };
  switch (action) {
    case 'approve':
      return {
        ...base,
        tipo: 'approvato',
        titolo: 'Compenso approvato',
        messaggio: 'Il tuo compenso è stato approvato.',
      };
    case 'reject':
      return {
        ...base,
        tipo: 'rifiutato',
        titolo: 'Compenso rifiutato',
        messaggio: note ? `Motivazione: ${note}` : 'Il tuo compenso è stato rifiutato.',
      };
    case 'mark_liquidated':
      return {
        ...base,
        tipo: 'liquidato',
        titolo: 'Compenso liquidato',
        messaggio: 'Il tuo compenso è stato contrassegnato come liquidato.',
      };
  }
}

export function buildExpenseNotification(
  action: ExpenseNotifiableAction,
  userId: string,
  entityId: string,
  note?: string | null,
): NotificationPayload {
  const base = { user_id: userId, entity_type: 'reimbursement' as const, entity_id: entityId };
  switch (action) {
    case 'approve':
      return {
        ...base,
        tipo: 'approvato',
        titolo: 'Rimborso approvato',
        messaggio: 'Il tuo rimborso è stato approvato.',
      };
    case 'reject':
      return {
        ...base,
        tipo: 'rifiutato',
        titolo: 'Rimborso rifiutato',
        messaggio: note ? `Motivazione: ${note}` : 'Il tuo rimborso è stato rifiutato.',
      };
    case 'mark_liquidated':
      return {
        ...base,
        tipo: 'liquidato',
        titolo: 'Rimborso liquidato',
        messaggio: 'Il tuo rimborso è stato contrassegnato come liquidato.',
      };
  }
}

export const COMPENSATION_NOTIFIED_ACTIONS: CompensationNotifiableAction[] = [
  'approve',
  'reject',
  'mark_liquidated',
];

export const EXPENSE_NOTIFIED_ACTIONS: ExpenseNotifiableAction[] = [
  'approve',
  'reject',
  'mark_liquidated',
];

export function buildTicketReplyNotification(
  userId: string,
  ticketId: string,
  ticketOggetto: string,
): NotificationPayload {
  return {
    user_id: userId,
    tipo: 'risposta_ticket',
    titolo: 'Nuova risposta al tuo ticket',
    messaggio: `Hai ricevuto una risposta al ticket: ${ticketOggetto}`,
    entity_type: 'ticket',
    entity_id: ticketId,
  };
}

// ── Responsabile-destined builders ────────────────────────────

export function buildCompensationSubmitNotification(
  responsabileUserId: string,
  entityId: string,
): NotificationPayload {
  return {
    user_id: responsabileUserId,
    tipo: 'comp_inviato',
    titolo: 'Nuovo compenso da approvare',
    messaggio: 'Un collaboratore ha inviato un compenso in attesa di approvazione.',
    entity_type: 'compensation',
    entity_id: entityId,
  };
}

export function buildExpenseSubmitNotification(
  responsabileUserId: string,
  entityId: string,
): NotificationPayload {
  return {
    user_id: responsabileUserId,
    tipo: 'rimborso_inviato',
    titolo: 'Nuovo rimborso da approvare',
    messaggio: 'Un collaboratore ha inviato un rimborso in attesa di approvazione.',
    entity_type: 'reimbursement',
    entity_id: entityId,
  };
}

export function buildTicketCreatedNotification(
  responsabileUserId: string,
  ticketId: string,
  ticketOggetto: string,
): NotificationPayload {
  return {
    user_id: responsabileUserId,
    tipo: 'ticket_creato',
    titolo: 'Nuovo ticket di supporto',
    messaggio: `È stato aperto un nuovo ticket: ${ticketOggetto}`,
    entity_type: 'ticket',
    entity_id: ticketId,
  };
}

export function buildTicketCollabReplyNotification(
  responsabileUserId: string,
  ticketId: string,
  ticketOggetto: string,
): NotificationPayload {
  return {
    user_id: responsabileUserId,
    tipo: 'risposta_ticket_collab',
    titolo: 'Risposta al ticket',
    messaggio: `Il collaboratore ha risposto al ticket: ${ticketOggetto}`,
    entity_type: 'ticket',
    entity_id: ticketId,
  };
}

export function buildTicketStatusNotification(
  collaboratoreUserId: string,
  ticketId: string,
  nuovoStato: string,
): NotificationPayload {
  const statoLabel: Record<string, string> = {
    APERTO: 'Aperto',
    IN_LAVORAZIONE: 'In lavorazione',
    CHIUSO: 'Chiuso',
  };
  return {
    user_id: collaboratoreUserId,
    tipo: 'ticket_stato',
    titolo: 'Stato ticket aggiornato',
    messaggio: `Il tuo ticket è ora: ${statoLabel[nuovoStato] ?? nuovoStato}`,
    entity_type: 'ticket',
    entity_id: ticketId,
  };
}
