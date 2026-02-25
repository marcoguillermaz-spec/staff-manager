import { describe, it, expect } from 'vitest';
import {
  canTransition,
  applyTransition,
  ALLOWED_TRANSITIONS,
} from '../lib/compensation-transitions';

describe('canTransition', () => {
  it('collaboratore può fare submit da BOZZA', () => {
    const result = canTransition('collaboratore', 'BOZZA', 'submit');
    expect(result.ok).toBe(true);
  });

  it('collaboratore NON può fare approve_manager', () => {
    const result = canTransition('collaboratore', 'INVIATO', 'approve_manager');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  it('responsabile NON può fare mark_paid', () => {
    const result = canTransition('responsabile', 'APPROVATO_ADMIN', 'mark_paid');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  it('admin può fare approve_admin da PRE_APPROVATO_RESP', () => {
    const result = canTransition('amministrazione', 'PRE_APPROVATO_RESP', 'approve_admin');
    expect(result.ok).toBe(true);
  });

  it('transizione da stato non valido → errore', () => {
    const result = canTransition('responsabile', 'BOZZA', 'approve_manager');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/BOZZA/);
  });

  it('request_integration richiede note ≥20 char', () => {
    const tooShort = canTransition('responsabile', 'INVIATO', 'request_integration', 'breve');
    expect(tooShort.ok).toBe(false);
    expect((tooShort as { ok: false; reason: string }).reason).toMatch(/20/);

    const valid = canTransition(
      'responsabile',
      'INVIATO',
      'request_integration',
      'Questa è una nota sufficientemente lunga',
    );
    expect(valid.ok).toBe(true);
  });

  it('collaboratore può fare withdraw da INVIATO', () => {
    const result = canTransition('collaboratore', 'INVIATO', 'withdraw');
    expect(result.ok).toBe(true);
  });

  it('amministrazione può fare request_integration da INVIATO con nota valida', () => {
    const result = canTransition(
      'amministrazione',
      'INVIATO',
      'request_integration',
      'Questa è una nota sufficientemente lunga',
    );
    expect(result.ok).toBe(true);
  });


  it('responsabile può fare request_integration da INTEGRAZIONI_RICHIESTE con nota valida', () => {
    const result = canTransition(
      'responsabile',
      'INTEGRAZIONI_RICHIESTE',
      'request_integration',
      'Questa è una nota sufficientemente lunga',
    );
    expect(result.ok).toBe(true);
  });

  it('amministrazione può fare request_integration da INTEGRAZIONI_RICHIESTE con nota valida', () => {
    const result = canTransition(
      'amministrazione',
      'INTEGRAZIONI_RICHIESTE',
      'request_integration',
      'Questa è una nota sufficientemente lunga',
    );
    expect(result.ok).toBe(true);
  });

  it('collaboratore NON può fare request_integration', () => {
    const result = canTransition('collaboratore', 'INVIATO', 'request_integration');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });
});

describe('applyTransition', () => {
  it('submit → INVIATO', () => {
    expect(applyTransition('submit')).toBe('INVIATO');
  });

  it('mark_paid → PAGATO', () => {
    expect(applyTransition('mark_paid')).toBe('PAGATO');
  });

  it('reject → RIFIUTATO', () => {
    expect(applyTransition('reject')).toBe('RIFIUTATO');
  });

  it('reject_manager → RIFIUTATO', () => {
    expect(applyTransition('reject_manager')).toBe('RIFIUTATO');
  });
});

describe('reject_manager', () => {
  it('responsabile può rifiutare da INVIATO', () => {
    expect(canTransition('responsabile', 'INVIATO', 'reject_manager').ok).toBe(true);
  });

  it('responsabile può rifiutare da INTEGRAZIONI_RICHIESTE', () => {
    expect(canTransition('responsabile', 'INTEGRAZIONI_RICHIESTE', 'reject_manager').ok).toBe(true);
  });

  it('responsabile NON può rifiutare da PRE_APPROVATO_RESP', () => {
    expect(canTransition('responsabile', 'PRE_APPROVATO_RESP', 'reject_manager').ok).toBe(false);
  });

  it('collaboratore NON può eseguire reject_manager', () => {
    expect(canTransition('collaboratore', 'INVIATO', 'reject_manager').ok).toBe(false);
  });

  it('admin NON può eseguire reject_manager', () => {
    expect(canTransition('amministrazione', 'INVIATO', 'reject_manager').ok).toBe(false);
  });
});

describe('ALLOWED_TRANSITIONS map', () => {
  it('contains all 9 defined actions', () => {
    const actions = Object.keys(ALLOWED_TRANSITIONS);
    expect(actions).toHaveLength(9);
  });

  it('request_integration requiresNote è true', () => {
    expect(ALLOWED_TRANSITIONS.request_integration.requiresNote).toBe(true);
  });

  it('submit requiresNote è false', () => {
    expect(ALLOWED_TRANSITIONS.submit.requiresNote).toBe(false);
  });
});
