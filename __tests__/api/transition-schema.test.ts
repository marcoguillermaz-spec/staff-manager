import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ── Replicate schemas from API routes (single source of truth for validation) ─

const compensationTransitionSchema = z.object({
  action: z.enum(['reopen', 'approve', 'reject', 'mark_liquidated']),
  note: z.string().optional(),
  payment_reference: z.string().optional(),
});

const expenseTransitionSchema = z.object({
  action: z.enum(['approve', 'reject', 'mark_liquidated']),
  note: z.string().optional(),
  payment_reference: z.string().optional(),
});

const markPaidSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  payment_reference: z.string().min(1),
  table: z.enum(['compensations', 'expenses']),
});

const approveAllSchema = z.object({
  community_id: z.string().uuid(),
});

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

// ── Compensation transition ────────────────────────────────────────────────────

describe('compensation transition schema', () => {
  it('accetta tutte le 4 azioni valide', () => {
    const valid = ['reopen', 'approve', 'reject', 'mark_liquidated'];
    for (const action of valid) {
      expect(compensationTransitionSchema.safeParse({ action }).success).toBe(true);
    }
  });

  it('rifiuta le azioni legacy rimosse in Block 7', () => {
    const legacy = [
      'submit',
      'withdraw',
      'mark_paid',
      'approve_manager',
      'reject_manager',
      'request_integration',
      'approve_admin',
      'resubmit',
    ];
    for (const action of legacy) {
      expect(compensationTransitionSchema.safeParse({ action }).success).toBe(false);
    }
  });

  it('rifiuta payload senza action', () => {
    expect(compensationTransitionSchema.safeParse({}).success).toBe(false);
    expect(compensationTransitionSchema.safeParse({ note: 'testo' }).success).toBe(false);
  });

  it('note è opzionale e viene preservata', () => {
    const result = compensationTransitionSchema.safeParse({
      action: 'reject',
      note: 'Documentazione insufficiente',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBe('Documentazione insufficiente');
  });

  it('payment_reference è opzionale e viene preservata', () => {
    const result = compensationTransitionSchema.safeParse({
      action: 'mark_liquidated',
      payment_reference: 'BONIF-2026-042',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.payment_reference).toBe('BONIF-2026-042');
  });

  it('note e payment_reference sono undefined se non forniti', () => {
    const result = compensationTransitionSchema.safeParse({ action: 'approve' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeUndefined();
      expect(result.data.payment_reference).toBeUndefined();
    }
  });
});

// ── Expense transition ─────────────────────────────────────────────────────────

describe('expense transition schema', () => {
  it('accetta le 3 azioni valide per rimborsi', () => {
    const valid = ['approve', 'reject', 'mark_liquidated'];
    for (const action of valid) {
      expect(expenseTransitionSchema.safeParse({ action }).success).toBe(true);
    }
  });

  it('rifiuta submit, withdraw, reopen (non previsti per rimborsi)', () => {
    const disallowed = ['submit', 'withdraw', 'reopen'];
    for (const action of disallowed) {
      expect(expenseTransitionSchema.safeParse({ action }).success).toBe(false);
    }
  });

  it('rifiuta le azioni legacy rimosse in Block 7', () => {
    const legacy = ['mark_paid', 'approve_manager', 'reject_manager', 'request_integration'];
    for (const action of legacy) {
      expect(expenseTransitionSchema.safeParse({ action }).success).toBe(false);
    }
  });

  it('rifiuta payload senza action', () => {
    expect(expenseTransitionSchema.safeParse({}).success).toBe(false);
  });

  it('note opzionale per reject', () => {
    const result = expenseTransitionSchema.safeParse({
      action: 'reject',
      note: 'Scontrino illeggibile',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBe('Scontrino illeggibile');
  });
});

// ── Mark-paid (liquidazione bulk) schema ──────────────────────────────────────

describe('mark-paid schema', () => {
  it('accetta payload valido per compensations', () => {
    const result = markPaidSchema.safeParse({
      ids: [VALID_UUID],
      payment_reference: 'BONIF-2026-001',
      table: 'compensations',
    });
    expect(result.success).toBe(true);
  });

  it('accetta payload valido per expenses', () => {
    const result = markPaidSchema.safeParse({
      ids: [VALID_UUID, '223e4567-e89b-12d3-a456-426614174001'],
      payment_reference: 'RIM-2026-001',
      table: 'expenses',
    });
    expect(result.success).toBe(true);
  });

  it('rifiuta ids vuoto (min 1)', () => {
    const result = markPaidSchema.safeParse({
      ids: [],
      payment_reference: 'BONIF',
      table: 'compensations',
    });
    expect(result.success).toBe(false);
  });

  it('rifiuta id non-UUID', () => {
    const result = markPaidSchema.safeParse({
      ids: ['not-a-valid-uuid'],
      payment_reference: 'BONIF',
      table: 'compensations',
    });
    expect(result.success).toBe(false);
  });

  it('rifiuta payment_reference vuoto', () => {
    const result = markPaidSchema.safeParse({
      ids: [VALID_UUID],
      payment_reference: '',
      table: 'compensations',
    });
    expect(result.success).toBe(false);
  });

  it('rifiuta table non valida', () => {
    const result = markPaidSchema.safeParse({
      ids: [VALID_UUID],
      payment_reference: 'BONIF',
      table: 'invalid_table',
    });
    expect(result.success).toBe(false);
  });

  it('rifiuta expense_reimbursements (nome interno — il campo pubblico è "expenses")', () => {
    const result = markPaidSchema.safeParse({
      ids: [VALID_UUID],
      payment_reference: 'BONIF',
      table: 'expense_reimbursements',
    });
    expect(result.success).toBe(false);
  });

  it('rifiuta payload senza payment_reference', () => {
    const result = markPaidSchema.safeParse({
      ids: [VALID_UUID],
      table: 'compensations',
    });
    expect(result.success).toBe(false);
  });
});

// ── Approve-all schema ────────────────────────────────────────────────────────

describe('approve-all schema', () => {
  it('accetta UUID valido', () => {
    const result = approveAllSchema.safeParse({ community_id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('rifiuta stringa non-UUID', () => {
    expect(approveAllSchema.safeParse({ community_id: 'not-a-uuid' }).success).toBe(false);
    expect(approveAllSchema.safeParse({ community_id: '123' }).success).toBe(false);
  });

  it('rifiuta payload senza community_id', () => {
    expect(approveAllSchema.safeParse({}).success).toBe(false);
  });
});
