// Pure utility functions for building notification payloads.
// Used by API route handlers to insert into the `notifications` table.

export type NotificationEntityType = 'compensation' | 'reimbursement' | 'document';

export interface NotificationPayload {
  user_id: string;
  tipo: string;
  titolo: string;
  messaggio: string;
  entity_type: NotificationEntityType;
  entity_id: string;
}

type CompensationNotifiableAction = 'request_integration' | 'approve_admin' | 'reject' | 'mark_paid';
type ExpenseNotifiableAction = 'request_integration' | 'approve_admin' | 'reject' | 'mark_paid';

export function buildCompensationNotification(
  action: CompensationNotifiableAction,
  userId: string,
  entityId: string,
  note?: string | null,
): NotificationPayload {
  const base = { user_id: userId, entity_type: 'compensation' as const, entity_id: entityId };
  switch (action) {
    case 'request_integration':
      return {
        ...base,
        tipo: 'integrazioni_richieste',
        titolo: 'Integrazioni richieste — Compenso',
        messaggio: note ? `Nota: ${note}` : 'Il tuo compenso richiede integrazioni.',
      };
    case 'approve_admin':
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
        messaggio: 'Il tuo compenso è stato rifiutato.',
      };
    case 'mark_paid':
      return {
        ...base,
        tipo: 'pagato',
        titolo: 'Compenso pagato',
        messaggio: 'Il tuo compenso è stato contrassegnato come pagato.',
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
    case 'request_integration':
      return {
        ...base,
        tipo: 'integrazioni_richieste',
        titolo: 'Integrazioni richieste — Rimborso',
        messaggio: note ? `Nota: ${note}` : 'Il tuo rimborso richiede integrazioni.',
      };
    case 'approve_admin':
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
        messaggio: 'Il tuo rimborso è stato rifiutato.',
      };
    case 'mark_paid':
      return {
        ...base,
        tipo: 'pagato',
        titolo: 'Rimborso pagato',
        messaggio: 'Il tuo rimborso è stato contrassegnato come pagato.',
      };
  }
}

export const COMPENSATION_NOTIFIED_ACTIONS: CompensationNotifiableAction[] = [
  'request_integration',
  'approve_admin',
  'reject',
  'mark_paid',
];

export const EXPENSE_NOTIFIED_ACTIONS: ExpenseNotifiableAction[] = [
  'request_integration',
  'approve_admin',
  'reject',
  'mark_paid',
];
