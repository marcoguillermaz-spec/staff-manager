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
  it('approve — correct titolo and tipo', () => {
    const n = buildCompensationNotification('approve', USER_ID, ENTITY_ID);
    expect(n.user_id).toBe(USER_ID);
    expect(n.entity_type).toBe('compensation');
    expect(n.entity_id).toBe(ENTITY_ID);
    expect(n.tipo).toBe('approvato');
    expect(n.titolo).toBe('Compenso approvato');
    expect(n.messaggio).toBe('Il tuo compenso è stato approvato.');
  });

  it('reject — default message when no note', () => {
    const n = buildCompensationNotification('reject', USER_ID, ENTITY_ID);
    expect(n.tipo).toBe('rifiutato');
    expect(n.titolo).toBe('Compenso rifiutato');
    expect(n.messaggio).toBe('Il tuo compenso è stato rifiutato.');
  });

  it('reject — note included in messaggio', () => {
    const n = buildCompensationNotification('reject', USER_ID, ENTITY_ID, 'Allegato mancante');
    expect(n.messaggio).toBe('Motivazione: Allegato mancante');
  });

  it('mark_liquidated — correct titolo', () => {
    const n = buildCompensationNotification('mark_liquidated', USER_ID, ENTITY_ID);
    expect(n.tipo).toBe('liquidato');
    expect(n.titolo).toBe('Compenso liquidato');
  });
});

describe('buildExpenseNotification', () => {
  it('approve — correct titolo', () => {
    const n = buildExpenseNotification('approve', USER_ID, ENTITY_ID);
    expect(n.entity_type).toBe('reimbursement');
    expect(n.tipo).toBe('approvato');
    expect(n.titolo).toBe('Rimborso approvato');
  });

  it('reject — default message when no note', () => {
    const n = buildExpenseNotification('reject', USER_ID, ENTITY_ID);
    expect(n.tipo).toBe('rifiutato');
    expect(n.titolo).toBe('Rimborso rifiutato');
    expect(n.messaggio).toBe('Il tuo rimborso è stato rifiutato.');
  });

  it('reject — note included in messaggio', () => {
    const n = buildExpenseNotification('reject', USER_ID, ENTITY_ID, 'Scontrino illeggibile');
    expect(n.messaggio).toBe('Motivazione: Scontrino illeggibile');
  });

  it('mark_liquidated — correct titolo', () => {
    const n = buildExpenseNotification('mark_liquidated', USER_ID, ENTITY_ID);
    expect(n.tipo).toBe('liquidato');
    expect(n.titolo).toBe('Rimborso liquidato');
  });
});

describe('NOTIFIED_ACTIONS constants', () => {
  it('COMPENSATION_NOTIFIED_ACTIONS includes all expected actions', () => {
    expect(COMPENSATION_NOTIFIED_ACTIONS).toContain('approve');
    expect(COMPENSATION_NOTIFIED_ACTIONS).toContain('reject');
    expect(COMPENSATION_NOTIFIED_ACTIONS).toContain('mark_liquidated');
    expect(COMPENSATION_NOTIFIED_ACTIONS).toHaveLength(3);
  });

  it('EXPENSE_NOTIFIED_ACTIONS includes all expected actions', () => {
    expect(EXPENSE_NOTIFIED_ACTIONS).toContain('approve');
    expect(EXPENSE_NOTIFIED_ACTIONS).toContain('reject');
    expect(EXPENSE_NOTIFIED_ACTIONS).toContain('mark_liquidated');
    expect(EXPENSE_NOTIFIED_ACTIONS).toHaveLength(3);
  });
});
