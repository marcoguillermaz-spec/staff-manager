import { describe, it, expect } from 'vitest';
import {
  canExpenseTransition,
  applyExpenseTransition,
  ALLOWED_EXPENSE_TRANSITIONS,
} from '../lib/expense-transitions';

describe('canExpenseTransition — collaboratore', () => {
  it('NON può fare approve', () => {
    const result = canExpenseTransition('collaboratore', 'IN_ATTESA', 'approve');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  it('NON può fare reject', () => {
    const result = canExpenseTransition('collaboratore', 'IN_ATTESA', 'reject', 'motivo');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  it('NON può fare mark_liquidated', () => {
    const result = canExpenseTransition('collaboratore', 'APPROVATO', 'mark_liquidated');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });
});

describe('canExpenseTransition — responsabile_compensi', () => {
  it('può fare approve da IN_ATTESA', () => {
    expect(canExpenseTransition('responsabile_compensi', 'IN_ATTESA', 'approve').ok).toBe(true);
  });

  it('può fare reject da IN_ATTESA con nota non vuota', () => {
    expect(canExpenseTransition('responsabile_compensi', 'IN_ATTESA', 'reject', 'Motivazione rifiuto').ok).toBe(true);
  });

  it('NON può fare reject con nota vuota', () => {
    const result = canExpenseTransition('responsabile_compensi', 'IN_ATTESA', 'reject', '');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/obbligator/i);
  });

  it('può fare reject senza nota (UI visibility check)', () => {
    expect(canExpenseTransition('responsabile_compensi', 'IN_ATTESA', 'reject').ok).toBe(true);
  });

  it('può fare mark_liquidated da APPROVATO', () => {
    expect(canExpenseTransition('responsabile_compensi', 'APPROVATO', 'mark_liquidated').ok).toBe(true);
  });

  it('NON può fare approve da RIFIUTATO', () => {
    const result = canExpenseTransition('responsabile_compensi', 'RIFIUTATO', 'approve');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/RIFIUTATO/);
  });
});

describe('canExpenseTransition — amministrazione', () => {
  it('può fare approve da IN_ATTESA', () => {
    expect(canExpenseTransition('amministrazione', 'IN_ATTESA', 'approve').ok).toBe(true);
  });

  it('può fare reject da IN_ATTESA con nota', () => {
    expect(canExpenseTransition('amministrazione', 'IN_ATTESA', 'reject', 'Nota di rifiuto').ok).toBe(true);
  });

  it('può fare mark_liquidated da APPROVATO', () => {
    expect(canExpenseTransition('amministrazione', 'APPROVATO', 'mark_liquidated').ok).toBe(true);
  });
});

describe('canExpenseTransition — stato non valido', () => {
  it('approve da LIQUIDATO → errore stato', () => {
    const result = canExpenseTransition('responsabile_compensi', 'LIQUIDATO', 'approve');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/LIQUIDATO/);
  });

  it('mark_liquidated da IN_ATTESA → errore stato', () => {
    const result = canExpenseTransition('responsabile_compensi', 'IN_ATTESA', 'mark_liquidated');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/IN_ATTESA/);
  });
});

describe('applyExpenseTransition', () => {
  it('approve → APPROVATO', () => {
    expect(applyExpenseTransition('approve')).toBe('APPROVATO');
  });

  it('reject → RIFIUTATO', () => {
    expect(applyExpenseTransition('reject')).toBe('RIFIUTATO');
  });

  it('mark_liquidated → LIQUIDATO', () => {
    expect(applyExpenseTransition('mark_liquidated')).toBe('LIQUIDATO');
  });
});

describe('ALLOWED_EXPENSE_TRANSITIONS map', () => {
  it('contains exactly 3 defined actions', () => {
    const actions = Object.keys(ALLOWED_EXPENSE_TRANSITIONS);
    expect(actions).toHaveLength(3);
  });

  it('reject.requiresNote è true', () => {
    expect(ALLOWED_EXPENSE_TRANSITIONS.reject.requiresNote).toBe(true);
  });

  it('approve.requiresNote è false', () => {
    expect(ALLOWED_EXPENSE_TRANSITIONS.approve.requiresNote).toBe(false);
  });

  it('mark_liquidated consentito a responsabile_compensi e amministrazione', () => {
    expect(ALLOWED_EXPENSE_TRANSITIONS.mark_liquidated.allowedRoles).toContain('responsabile_compensi');
    expect(ALLOWED_EXPENSE_TRANSITIONS.mark_liquidated.allowedRoles).toContain('amministrazione');
    expect(ALLOWED_EXPENSE_TRANSITIONS.mark_liquidated.allowedRoles).not.toContain('collaboratore');
  });

  it('nessuna azione parte da BOZZA (expense non ha stato BOZZA)', () => {
    for (const def of Object.values(ALLOWED_EXPENSE_TRANSITIONS)) {
      expect(def.fromStates).not.toContain('BOZZA');
    }
  });
});
