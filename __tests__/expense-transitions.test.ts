import { describe, it, expect } from 'vitest';
import {
  canExpenseTransition,
  applyExpenseTransition,
  ALLOWED_EXPENSE_TRANSITIONS,
} from '../lib/expense-transitions';

describe('canExpenseTransition', () => {
  // ── collaboratore ─────────────────────────────────────────────
  it('collaboratore può fare resubmit da INTEGRAZIONI_RICHIESTE', () => {
    const result = canExpenseTransition('collaboratore', 'INTEGRAZIONI_RICHIESTE', 'resubmit');
    expect(result.ok).toBe(true);
  });

  it('collaboratore NON può fare resubmit da INVIATO', () => {
    const result = canExpenseTransition('collaboratore', 'INVIATO', 'resubmit');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/INVIATO/);
  });

  it('collaboratore NON può fare approve_manager', () => {
    const result = canExpenseTransition('collaboratore', 'INVIATO', 'approve_manager');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  it('collaboratore NON può fare approve_admin', () => {
    const result = canExpenseTransition('collaboratore', 'PRE_APPROVATO_RESP', 'approve_admin');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  it('collaboratore NON può fare mark_paid', () => {
    const result = canExpenseTransition('collaboratore', 'APPROVATO_ADMIN', 'mark_paid');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  // ── responsabile ──────────────────────────────────────────────
  it('responsabile può fare approve_manager da INVIATO', () => {
    const result = canExpenseTransition('responsabile', 'INVIATO', 'approve_manager');
    expect(result.ok).toBe(true);
  });

  it('responsabile può fare approve_manager da INTEGRAZIONI_RICHIESTE', () => {
    const result = canExpenseTransition('responsabile', 'INTEGRAZIONI_RICHIESTE', 'approve_manager');
    expect(result.ok).toBe(true);
  });

  it('responsabile può fare request_integration da INVIATO con nota lunga', () => {
    const result = canExpenseTransition(
      'responsabile',
      'INVIATO',
      'request_integration',
      'Questa è una nota sufficientemente lunga per passare la validazione',
    );
    expect(result.ok).toBe(true);
  });

  it('responsabile NON può fare request_integration con nota troppo corta', () => {
    const result = canExpenseTransition('responsabile', 'INVIATO', 'request_integration', 'breve');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/20/);
  });

  it('responsabile PUÒ fare request_integration senza nota (UI visibility check)', () => {
    // No note = UI visibility check: skip note validation, show the button
    const result = canExpenseTransition('responsabile', 'INVIATO', 'request_integration');
    expect(result.ok).toBe(true);
  });

  it('responsabile può fare request_integration da INTEGRAZIONI_RICHIESTE con nota valida', () => {
    const result = canExpenseTransition(
      'responsabile',
      'INTEGRAZIONI_RICHIESTE',
      'request_integration',
      'Questa è una nota sufficientemente lunga per passare la validazione',
    );
    expect(result.ok).toBe(true);
  });

  it('amministrazione può fare request_integration da INVIATO con nota valida', () => {
    const result = canExpenseTransition(
      'amministrazione',
      'INVIATO',
      'request_integration',
      'Questa è una nota sufficientemente lunga per passare la validazione',
    );
    expect(result.ok).toBe(true);
  });

  it('amministrazione può fare request_integration da INTEGRAZIONI_RICHIESTE con nota valida', () => {
    const result = canExpenseTransition(
      'amministrazione',
      'INTEGRAZIONI_RICHIESTE',
      'request_integration',
      'Questa è una nota sufficientemente lunga per passare la validazione',
    );
    expect(result.ok).toBe(true);
  });

  it('super_admin può fare request_integration da INVIATO con nota valida', () => {
    const result = canExpenseTransition(
      'super_admin',
      'INVIATO',
      'request_integration',
      'Questa è una nota sufficientemente lunga per passare la validazione',
    );
    expect(result.ok).toBe(true);
  });

  it('collaboratore NON può fare request_integration', () => {
    const result = canExpenseTransition('collaboratore', 'INVIATO', 'request_integration');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  it('responsabile NON può fare approve_admin', () => {
    const result = canExpenseTransition('responsabile', 'PRE_APPROVATO_RESP', 'approve_admin');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  it('responsabile NON può fare mark_paid', () => {
    const result = canExpenseTransition('responsabile', 'APPROVATO_ADMIN', 'mark_paid');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  // ── amministrazione ───────────────────────────────────────────
  it('amministrazione può fare approve_admin da PRE_APPROVATO_RESP', () => {
    const result = canExpenseTransition('amministrazione', 'PRE_APPROVATO_RESP', 'approve_admin');
    expect(result.ok).toBe(true);
  });

  it('amministrazione può fare reject da PRE_APPROVATO_RESP', () => {
    const result = canExpenseTransition('amministrazione', 'PRE_APPROVATO_RESP', 'reject');
    expect(result.ok).toBe(true);
  });

  it('amministrazione può fare mark_paid da APPROVATO_ADMIN', () => {
    const result = canExpenseTransition('amministrazione', 'APPROVATO_ADMIN', 'mark_paid');
    expect(result.ok).toBe(true);
  });

  // ── super_admin ────────────────────────────────────────────────
  it('super_admin può fare approve_admin da PRE_APPROVATO_RESP', () => {
    const result = canExpenseTransition('super_admin', 'PRE_APPROVATO_RESP', 'approve_admin');
    expect(result.ok).toBe(true);
  });

  it('super_admin può fare reject da PRE_APPROVATO_RESP', () => {
    const result = canExpenseTransition('super_admin', 'PRE_APPROVATO_RESP', 'reject');
    expect(result.ok).toBe(true);
  });

  it('super_admin può fare mark_paid da APPROVATO_ADMIN', () => {
    const result = canExpenseTransition('super_admin', 'APPROVATO_ADMIN', 'mark_paid');
    expect(result.ok).toBe(true);
  });

  // ── stato non valido ──────────────────────────────────────────
  it('transizione da stato non valido → errore', () => {
    const result = canExpenseTransition('responsabile', 'PAGATO', 'approve_manager');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/PAGATO/);
  });

  it('approve_admin da INVIATO → errore (stato errato)', () => {
    const result = canExpenseTransition('amministrazione', 'INVIATO', 'approve_admin');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/INVIATO/);
  });
});

describe('applyExpenseTransition', () => {
  it('resubmit → INVIATO', () => {
    expect(applyExpenseTransition('resubmit')).toBe('INVIATO');
  });

  it('approve_manager → PRE_APPROVATO_RESP', () => {
    expect(applyExpenseTransition('approve_manager')).toBe('PRE_APPROVATO_RESP');
  });

  it('request_integration → INTEGRAZIONI_RICHIESTE', () => {
    expect(applyExpenseTransition('request_integration')).toBe('INTEGRAZIONI_RICHIESTE');
  });

  it('approve_admin → APPROVATO_ADMIN', () => {
    expect(applyExpenseTransition('approve_admin')).toBe('APPROVATO_ADMIN');
  });

  it('reject → RIFIUTATO', () => {
    expect(applyExpenseTransition('reject')).toBe('RIFIUTATO');
  });

  it('reject_manager → RIFIUTATO', () => {
    expect(applyExpenseTransition('reject_manager')).toBe('RIFIUTATO');
  });

  it('mark_paid → PAGATO', () => {
    expect(applyExpenseTransition('mark_paid')).toBe('PAGATO');
  });
});

describe('reject_manager expense', () => {
  it('responsabile può rifiutare da INVIATO', () => {
    expect(canExpenseTransition('responsabile', 'INVIATO', 'reject_manager').ok).toBe(true);
  });

  it('responsabile può rifiutare da INTEGRAZIONI_RICHIESTE', () => {
    expect(canExpenseTransition('responsabile', 'INTEGRAZIONI_RICHIESTE', 'reject_manager').ok).toBe(true);
  });

  it('responsabile NON può rifiutare da PRE_APPROVATO_RESP', () => {
    expect(canExpenseTransition('responsabile', 'PRE_APPROVATO_RESP', 'reject_manager').ok).toBe(false);
  });

  it('collaboratore NON può eseguire reject_manager', () => {
    expect(canExpenseTransition('collaboratore', 'INVIATO', 'reject_manager').ok).toBe(false);
  });

  it('admin NON può eseguire reject_manager', () => {
    expect(canExpenseTransition('amministrazione', 'INVIATO', 'reject_manager').ok).toBe(false);
  });
});

describe('ALLOWED_EXPENSE_TRANSITIONS map', () => {
  it('contains exactly 7 defined actions', () => {
    const actions = Object.keys(ALLOWED_EXPENSE_TRANSITIONS);
    expect(actions).toHaveLength(7);
  });

  it('request_integration requiresNote è true', () => {
    expect(ALLOWED_EXPENSE_TRANSITIONS.request_integration.requiresNote).toBe(true);
  });

  it('resubmit requiresNote è false', () => {
    expect(ALLOWED_EXPENSE_TRANSITIONS.resubmit.requiresNote).toBe(false);
  });

  it('mark_paid è consentito solo ad amministrazione e super_admin', () => {
    expect(ALLOWED_EXPENSE_TRANSITIONS.mark_paid.allowedRoles).toContain('amministrazione');
    expect(ALLOWED_EXPENSE_TRANSITIONS.mark_paid.allowedRoles).toContain('super_admin');
    expect(ALLOWED_EXPENSE_TRANSITIONS.mark_paid.allowedRoles).not.toContain('responsabile');
    expect(ALLOWED_EXPENSE_TRANSITIONS.mark_paid.allowedRoles).not.toContain('collaboratore');
  });

  it('nessuna azione parte da BOZZA (expense non ha stato BOZZA)', () => {
    for (const def of Object.values(ALLOWED_EXPENSE_TRANSITIONS)) {
      expect(def.fromStates).not.toContain('BOZZA');
    }
  });
});
