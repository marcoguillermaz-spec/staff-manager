import { describe, it, expect } from 'vitest';
import {
  canTransition,
  applyTransition,
  ALLOWED_TRANSITIONS,
} from '../lib/compensation-transitions';

describe('canTransition — collaboratore', () => {
  it('può fare submit da BOZZA', () => {
    expect(canTransition('collaboratore', 'BOZZA', 'submit').ok).toBe(true);
  });

  it('può fare withdraw da IN_ATTESA', () => {
    expect(canTransition('collaboratore', 'IN_ATTESA', 'withdraw').ok).toBe(true);
  });

  it('può fare reopen da RIFIUTATO', () => {
    expect(canTransition('collaboratore', 'RIFIUTATO', 'reopen').ok).toBe(true);
  });

  it('NON può fare approve', () => {
    const result = canTransition('collaboratore', 'IN_ATTESA', 'approve');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  it('NON può fare reject', () => {
    const result = canTransition('collaboratore', 'IN_ATTESA', 'reject', 'motivo');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });

  it('NON può fare mark_liquidated', () => {
    const result = canTransition('collaboratore', 'APPROVATO', 'mark_liquidated');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });
});

describe('canTransition — responsabile_compensi', () => {
  it('può fare approve da IN_ATTESA', () => {
    expect(canTransition('responsabile_compensi', 'IN_ATTESA', 'approve').ok).toBe(true);
  });

  it('può fare reject da IN_ATTESA con nota non vuota', () => {
    expect(canTransition('responsabile_compensi', 'IN_ATTESA', 'reject', 'Motivazione rifiuto').ok).toBe(true);
  });

  it('NON può fare reject con nota vuota', () => {
    const result = canTransition('responsabile_compensi', 'IN_ATTESA', 'reject', '');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/obbligator/i);
  });

  it('può fare reject senza nota (UI visibility check — nota undefined)', () => {
    // No note = UI visibility check: skip note validation
    expect(canTransition('responsabile_compensi', 'IN_ATTESA', 'reject').ok).toBe(true);
  });

  it('può fare mark_liquidated da APPROVATO', () => {
    expect(canTransition('responsabile_compensi', 'APPROVATO', 'mark_liquidated').ok).toBe(true);
  });

  it('NON può fare approve da BOZZA', () => {
    const result = canTransition('responsabile_compensi', 'BOZZA', 'approve');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/BOZZA/);
  });
});

describe('canTransition — amministrazione', () => {
  it('può fare approve da IN_ATTESA', () => {
    expect(canTransition('amministrazione', 'IN_ATTESA', 'approve').ok).toBe(true);
  });

  it('può fare reject da IN_ATTESA con nota', () => {
    expect(canTransition('amministrazione', 'IN_ATTESA', 'reject', 'Nota di rifiuto').ok).toBe(true);
  });

  it('può fare mark_liquidated da APPROVATO', () => {
    expect(canTransition('amministrazione', 'APPROVATO', 'mark_liquidated').ok).toBe(true);
  });
});

describe('canTransition — stato non valido', () => {
  it('approve da LIQUIDATO → errore stato', () => {
    const result = canTransition('responsabile_compensi', 'LIQUIDATO', 'approve');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/LIQUIDATO/);
  });

  it('submit da IN_ATTESA → errore stato', () => {
    const result = canTransition('collaboratore', 'IN_ATTESA', 'submit');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/IN_ATTESA/);
  });
});

describe('applyTransition', () => {
  it('submit → IN_ATTESA', () => {
    expect(applyTransition('submit')).toBe('IN_ATTESA');
  });

  it('withdraw → BOZZA', () => {
    expect(applyTransition('withdraw')).toBe('BOZZA');
  });

  it('reopen → BOZZA', () => {
    expect(applyTransition('reopen')).toBe('BOZZA');
  });

  it('approve → APPROVATO', () => {
    expect(applyTransition('approve')).toBe('APPROVATO');
  });

  it('reject → RIFIUTATO', () => {
    expect(applyTransition('reject')).toBe('RIFIUTATO');
  });

  it('mark_liquidated → LIQUIDATO', () => {
    expect(applyTransition('mark_liquidated')).toBe('LIQUIDATO');
  });
});

describe('ALLOWED_TRANSITIONS map', () => {
  it('contains exactly 6 defined actions', () => {
    const actions = Object.keys(ALLOWED_TRANSITIONS);
    expect(actions).toHaveLength(6);
  });

  it('reject.requiresNote è true', () => {
    expect(ALLOWED_TRANSITIONS.reject.requiresNote).toBe(true);
  });

  it('submit.requiresNote è false', () => {
    expect(ALLOWED_TRANSITIONS.submit.requiresNote).toBe(false);
  });

  it('nessuna azione parte da LIQUIDATO (terminale)', () => {
    for (const def of Object.values(ALLOWED_TRANSITIONS)) {
      expect(def.fromStates).not.toContain('LIQUIDATO');
    }
  });
});
