import type { Role, ExpenseStatus } from './types';

export type ExpenseAction =
  | 'approve'
  | 'reject'
  | 'mark_liquidated';

interface TransitionDef {
  fromStates: ExpenseStatus[];
  allowedRoles: Role[];
  requiresNote: boolean;
}

export const ALLOWED_EXPENSE_TRANSITIONS: Record<ExpenseAction, TransitionDef> = {
  approve:         { fromStates: ['IN_ATTESA'], allowedRoles: ['responsabile_compensi', 'amministrazione'], requiresNote: false },
  reject:          { fromStates: ['IN_ATTESA'], allowedRoles: ['responsabile_compensi', 'amministrazione'], requiresNote: true  },
  mark_liquidated: { fromStates: ['APPROVATO'], allowedRoles: ['responsabile_compensi', 'amministrazione'], requiresNote: false },
};

export const EXPENSE_ACTION_TO_STATE: Record<ExpenseAction, ExpenseStatus> = {
  approve:         'APPROVATO',
  reject:          'RIFIUTATO',
  mark_liquidated: 'LIQUIDATO',
};

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Pure function — zero side effects, no Supabase.
 * Checks if the given role can perform `action` on an expense in state `stato`.
 * If `requiresNote` is true (reject action), validates that note is non-empty.
 */
export function canExpenseTransition(
  role: Role,
  stato: ExpenseStatus,
  action: ExpenseAction,
  note?: string,
): TransitionResult {
  const def = ALLOWED_EXPENSE_TRANSITIONS[action];
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

/** Returns the target state for a given expense action. */
export function applyExpenseTransition(action: ExpenseAction): ExpenseStatus {
  return EXPENSE_ACTION_TO_STATE[action];
}
