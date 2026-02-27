import type { Role, CompensationStatus } from './types';

export type CompensationAction =
  | 'reopen'
  | 'approve'
  | 'reject'
  | 'mark_liquidated';

interface TransitionDef {
  fromStates: CompensationStatus[];
  allowedRoles: Role[];
  requiresNote: boolean;
}

export const ALLOWED_TRANSITIONS: Record<CompensationAction, TransitionDef> = {
  reopen:          { fromStates: ['RIFIUTATO'], allowedRoles: ['collaboratore'],                              requiresNote: false },
  approve:         { fromStates: ['IN_ATTESA'], allowedRoles: ['responsabile_compensi', 'amministrazione'],   requiresNote: false },
  reject:          { fromStates: ['IN_ATTESA'], allowedRoles: ['responsabile_compensi', 'amministrazione'],   requiresNote: true  },
  mark_liquidated: { fromStates: ['APPROVATO'], allowedRoles: ['responsabile_compensi', 'amministrazione'],   requiresNote: false },
};

export const ACTION_TO_STATE: Record<CompensationAction, CompensationStatus> = {
  reopen:          'IN_ATTESA',
  approve:         'APPROVATO',
  reject:          'RIFIUTATO',
  mark_liquidated: 'LIQUIDATO',
};

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Pure function — zero side effects, no Supabase.
 * Checks if the given role can perform `action` on a compensation in state `stato`.
 * If `requiresNote` is true (reject action), validates that note is non-empty.
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

  // Note validation: only run when note is provided (used by API routes).
  // When note is undefined (UI visibility checks), skip — the modal enforces the requirement.
  if (def.requiresNote && note !== undefined) {
    if (note.trim().length === 0) {
      return { ok: false, reason: 'La motivazione del rifiuto è obbligatoria' };
    }
  }

  return { ok: true };
}

/** Returns the target state for a given action. */
export function applyTransition(action: CompensationAction): CompensationStatus {
  return ACTION_TO_STATE[action];
}
