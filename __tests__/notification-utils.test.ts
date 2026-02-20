import { describe, it, expect } from 'vitest';
import {
  buildCompensationNotification,
  buildExpenseNotification,
  COMPENSATION_NOTIFIED_ACTIONS,
  EXPENSE_NOTIFIED_ACTIONS,
} from '@/lib/notification-utils';

const USER_ID = 'user-abc';
const ENTITY_ID = 'entity-123';

describe('buildCompensationNotification', () => {
  it('request_integration — default message when no note', () => {
    const n = buildCompensationNotification('request_integration', USER_ID, ENTITY_ID);
    expect(n.user_id).toBe(USER_ID);
    expect(n.entity_type).toBe('compensation');
    expect(n.entity_id).toBe(ENTITY_ID);
    expect(n.tipo).toBe('integrazioni_richieste');
    expect(n.titolo).toBe('Integrazioni richieste — Compenso');
    expect(n.messaggio).toBe('Il tuo compenso richiede integrazioni.');
  });

  it('request_integration — note included in messaggio', () => {
    const n = buildCompensationNotification('request_integration', USER_ID, ENTITY_ID, 'Allegato mancante');
    expect(n.messaggio).toBe('Nota: Allegato mancante');
  });

  it('approve_admin — correct titolo and tipo', () => {
    const n = buildCompensationNotification('approve_admin', USER_ID, ENTITY_ID);
    expect(n.tipo).toBe('approvato');
    expect(n.titolo).toBe('Compenso approvato');
    expect(n.messaggio).toBe('Il tuo compenso è stato approvato.');
  });

  it('reject — correct titolo', () => {
    const n = buildCompensationNotification('reject', USER_ID, ENTITY_ID);
    expect(n.tipo).toBe('rifiutato');
    expect(n.titolo).toBe('Compenso rifiutato');
  });

  it('mark_paid — correct titolo', () => {
    const n = buildCompensationNotification('mark_paid', USER_ID, ENTITY_ID);
    expect(n.tipo).toBe('pagato');
    expect(n.titolo).toBe('Compenso pagato');
  });
});

describe('buildExpenseNotification', () => {
  it('request_integration — default message when no note', () => {
    const n = buildExpenseNotification('request_integration', USER_ID, ENTITY_ID);
    expect(n.entity_type).toBe('reimbursement');
    expect(n.tipo).toBe('integrazioni_richieste');
    expect(n.titolo).toBe('Integrazioni richieste — Rimborso');
    expect(n.messaggio).toBe('Il tuo rimborso richiede integrazioni.');
  });

  it('request_integration — note included in messaggio', () => {
    const n = buildExpenseNotification('request_integration', USER_ID, ENTITY_ID, 'Scontrino illeggibile');
    expect(n.messaggio).toBe('Nota: Scontrino illeggibile');
  });

  it('approve_admin — correct titolo', () => {
    const n = buildExpenseNotification('approve_admin', USER_ID, ENTITY_ID);
    expect(n.tipo).toBe('approvato');
    expect(n.titolo).toBe('Rimborso approvato');
  });

  it('reject — correct titolo', () => {
    const n = buildExpenseNotification('reject', USER_ID, ENTITY_ID);
    expect(n.tipo).toBe('rifiutato');
    expect(n.titolo).toBe('Rimborso rifiutato');
  });

  it('mark_paid — correct titolo', () => {
    const n = buildExpenseNotification('mark_paid', USER_ID, ENTITY_ID);
    expect(n.tipo).toBe('pagato');
    expect(n.titolo).toBe('Rimborso pagato');
  });
});

describe('NOTIFIED_ACTIONS constants', () => {
  it('COMPENSATION_NOTIFIED_ACTIONS includes all expected actions', () => {
    expect(COMPENSATION_NOTIFIED_ACTIONS).toContain('request_integration');
    expect(COMPENSATION_NOTIFIED_ACTIONS).toContain('approve_admin');
    expect(COMPENSATION_NOTIFIED_ACTIONS).toContain('reject');
    expect(COMPENSATION_NOTIFIED_ACTIONS).toContain('mark_paid');
    expect(COMPENSATION_NOTIFIED_ACTIONS).toHaveLength(4);
  });

  it('EXPENSE_NOTIFIED_ACTIONS includes all expected actions', () => {
    expect(EXPENSE_NOTIFIED_ACTIONS).toContain('request_integration');
    expect(EXPENSE_NOTIFIED_ACTIONS).toContain('approve_admin');
    expect(EXPENSE_NOTIFIED_ACTIONS).toContain('reject');
    expect(EXPENSE_NOTIFIED_ACTIONS).toContain('mark_paid');
    expect(EXPENSE_NOTIFIED_ACTIONS).toHaveLength(4);
  });
});
