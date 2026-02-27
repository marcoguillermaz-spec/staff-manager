import { describe, it, expect } from 'vitest';
import {
  canTransition,
  applyTransition,
  ALLOWED_TRANSITIONS,
} from '../lib/compensation-transitions';

describe('canTransition — collaboratore', () => {
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

  it('NON può fare approve da RIFIUTATO', () => {
    const result = canTransition('responsabile_compensi', 'RIFIUTATO', 'approve');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/RIFIUTATO/);
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

  it('approve da IN_ATTESA dopo reopen → non possibile per collaboratore', () => {
    const result = canTransition('collaboratore', 'IN_ATTESA', 'approve');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/ruolo/i);
  });
});

describe('applyTransition', () => {
  it('reopen → IN_ATTESA', () => {
    expect(applyTransition('reopen')).toBe('IN_ATTESA');
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
  it('contains exactly 4 defined actions', () => {
    const actions = Object.keys(ALLOWED_TRANSITIONS);
    expect(actions).toHaveLength(4);
  });

  it('reject.requiresNote è true', () => {
    expect(ALLOWED_TRANSITIONS.reject.requiresNote).toBe(true);
  });

  it('reopen parte da RIFIUTATO e va a IN_ATTESA', () => {
    expect(ALLOWED_TRANSITIONS.reopen.fromStates).toContain('RIFIUTATO');
  });

  it('nessuna azione parte da LIQUIDATO (terminale)', () => {
    for (const def of Object.values(ALLOWED_TRANSITIONS)) {
      expect(def.fromStates).not.toContain('LIQUIDATO');
    }
  });
});
