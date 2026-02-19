import type { Role, CompensationStatus } from './types';

export type CompensationAction =
  | 'submit'
  | 'withdraw'
  | 'resubmit'
  | 'approve_manager'
  | 'request_integration'
  | 'approve_admin'
  | 'reject'
  | 'mark_paid';

interface TransitionDef {
  fromStates: CompensationStatus[];
  allowedRoles: Role[];
  requiresNote: boolean;
}

export const ALLOWED_TRANSITIONS: Record<CompensationAction, TransitionDef> = {
  submit:              { fromStates: ['BOZZA'],                            allowedRoles: ['collaboratore'],                  requiresNote: false },
  withdraw:            { fromStates: ['INVIATO'],                          allowedRoles: ['collaboratore'],                  requiresNote: false },
  resubmit:            { fromStates: ['INTEGRAZIONI_RICHIESTE'],           allowedRoles: ['collaboratore'],                  requiresNote: false },
  approve_manager:     { fromStates: ['INVIATO', 'INTEGRAZIONI_RICHIESTE'],allowedRoles: ['responsabile'],                   requiresNote: false },
  request_integration: { fromStates: ['INVIATO'],                          allowedRoles: ['responsabile'],                   requiresNote: true  },
  approve_admin:       { fromStates: ['PRE_APPROVATO_RESP'],               allowedRoles: ['amministrazione', 'super_admin'], requiresNote: false },
  reject:              { fromStates: ['PRE_APPROVATO_RESP'],               allowedRoles: ['amministrazione', 'super_admin'], requiresNote: false },
  mark_paid:           { fromStates: ['APPROVATO_ADMIN'],                  allowedRoles: ['amministrazione', 'super_admin'], requiresNote: false },
};

export const ACTION_TO_STATE: Record<CompensationAction, CompensationStatus> = {
  submit:              'INVIATO',
  withdraw:            'BOZZA',
  resubmit:            'INVIATO',
  approve_manager:     'PRE_APPROVATO_RESP',
  request_integration: 'INTEGRAZIONI_RICHIESTE',
  approve_admin:       'APPROVATO_ADMIN',
  reject:              'RIFIUTATO',
  mark_paid:           'PAGATO',
};

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Pure function — zero side effects, no Supabase.
 * Checks if the given role can perform `action` on a compensation in state `stato`.
 * If `requiresNote` is true, validates that note is present and ≥ 20 chars.
 */
export function canTransition(
  role: Role,
  stato: CompensationStatus,
  action: CompensationAction,
  note?: string,
): TransitionResult {
  const def = ALLOWED_TRANSITIONS[action];
  if (!def) return { ok: false, reason: 'Azione non riconosciuta' };

  if (!def.allowedRoles.includes(role)) {
    return { ok: false, reason: 'Ruolo non autorizzato per questa azione' };
  }

  if (!def.fromStates.includes(stato)) {
    return { ok: false, reason: `Transizione non consentita dallo stato ${stato}` };
  }

  if (def.requiresNote) {
    if (!note || note.trim().length < 20) {
      return { ok: false, reason: 'La nota deve essere di almeno 20 caratteri' };
    }
  }

  return { ok: true };
}

/** Returns the target state for a given action. */
export function applyTransition(action: CompensationAction): CompensationStatus {
  return ACTION_TO_STATE[action];
}
