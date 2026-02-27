-- ============================================================
-- Staff Manager — Migration 023: Workflow refactor
-- ============================================================
-- Renames compensation/expense stati:
--   INVIATO            → IN_ATTESA
--   INTEGRAZIONI_RICHIESTE → IN_ATTESA
--   PRE_APPROVATO_RESP → APPROVATO
--   APPROVATO_ADMIN    → APPROVATO
--   PAGATO             → LIQUIDATO
-- Removes: tipo (PIVA), PIVA-specific fields, integration fields,
--   manager/admin_approved_by/at, paid_by/at
-- Adds: approved_by/at, rejection_note, liquidated_by/at
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- COMPENSATIONS
-- ────────────────────────────────────────────────────────────

-- 1. Drop old CHECK constraints before UPDATE
ALTER TABLE compensations DROP CONSTRAINT IF EXISTS compensations_stato_check;
ALTER TABLE compensations DROP CONSTRAINT IF EXISTS compensations_tipo_check;

-- 2. Migrate stato values
UPDATE compensations SET stato = 'IN_ATTESA'
  WHERE stato IN ('INVIATO', 'INTEGRAZIONI_RICHIESTE');
UPDATE compensations SET stato = 'APPROVATO'
  WHERE stato IN ('PRE_APPROVATO_RESP', 'APPROVATO_ADMIN');
UPDATE compensations SET stato = 'LIQUIDATO'
  WHERE stato = 'PAGATO';

-- 3. Apply new CHECK constraint
ALTER TABLE compensations
  ADD CONSTRAINT compensations_stato_check
  CHECK (stato IN ('BOZZA','IN_ATTESA','APPROVATO','RIFIUTATO','LIQUIDATO'));

-- 4. Add new columns
ALTER TABLE compensations
  ADD COLUMN IF NOT EXISTS approved_by   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at   timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_note text,
  ADD COLUMN IF NOT EXISTS liquidated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS liquidated_by  uuid REFERENCES auth.users(id);

-- 5. Migrate approval data (manager first, admin as fallback)
UPDATE compensations
  SET approved_by = manager_approved_by,
      approved_at = manager_approved_at
  WHERE manager_approved_by IS NOT NULL;

UPDATE compensations
  SET approved_by = admin_approved_by,
      approved_at = admin_approved_at
  WHERE approved_by IS NULL AND admin_approved_by IS NOT NULL;

-- 6. Migrate payment data
UPDATE compensations
  SET liquidated_at = paid_at,
      liquidated_by  = paid_by
  WHERE paid_at IS NOT NULL;

-- 7. Migrate integration_note → rejection_note for RIFIUTATO records
UPDATE compensations
  SET rejection_note = integration_note
  WHERE stato = 'RIFIUTATO' AND integration_note IS NOT NULL;

-- 8. Drop old columns
ALTER TABLE compensations
  DROP COLUMN IF EXISTS tipo,
  DROP COLUMN IF EXISTS numero_fattura,
  DROP COLUMN IF EXISTS data_fattura,
  DROP COLUMN IF EXISTS imponibile,
  DROP COLUMN IF EXISTS iva_percentuale,
  DROP COLUMN IF EXISTS totale_fattura,
  DROP COLUMN IF EXISTS manager_approved_by,
  DROP COLUMN IF EXISTS manager_approved_at,
  DROP COLUMN IF EXISTS admin_approved_by,
  DROP COLUMN IF EXISTS admin_approved_at,
  DROP COLUMN IF EXISTS integration_note,
  DROP COLUMN IF EXISTS integration_reasons,
  DROP COLUMN IF EXISTS paid_at,
  DROP COLUMN IF EXISTS paid_by;

-- 9. Normalize compensation_history state names
UPDATE compensation_history SET stato_nuovo      = 'IN_ATTESA'
  WHERE stato_nuovo      IN ('INVIATO', 'INTEGRAZIONI_RICHIESTE');
UPDATE compensation_history SET stato_nuovo      = 'APPROVATO'
  WHERE stato_nuovo      IN ('PRE_APPROVATO_RESP', 'APPROVATO_ADMIN');
UPDATE compensation_history SET stato_nuovo      = 'LIQUIDATO'
  WHERE stato_nuovo      = 'PAGATO';
UPDATE compensation_history SET stato_precedente = 'IN_ATTESA'
  WHERE stato_precedente IN ('INVIATO', 'INTEGRAZIONI_RICHIESTE');
UPDATE compensation_history SET stato_precedente = 'APPROVATO'
  WHERE stato_precedente IN ('PRE_APPROVATO_RESP', 'APPROVATO_ADMIN');
UPDATE compensation_history SET stato_precedente = 'LIQUIDATO'
  WHERE stato_precedente = 'PAGATO';

-- ────────────────────────────────────────────────────────────
-- EXPENSE REIMBURSEMENTS
-- ────────────────────────────────────────────────────────────

-- 1. Drop old CHECK constraint
ALTER TABLE expense_reimbursements DROP CONSTRAINT IF EXISTS expense_reimbursements_stato_check;

-- 2. Migrate stato values
UPDATE expense_reimbursements SET stato = 'IN_ATTESA'
  WHERE stato IN ('INVIATO', 'INTEGRAZIONI_RICHIESTE');
UPDATE expense_reimbursements SET stato = 'APPROVATO'
  WHERE stato IN ('PRE_APPROVATO_RESP', 'APPROVATO_ADMIN');
UPDATE expense_reimbursements SET stato = 'LIQUIDATO'
  WHERE stato = 'PAGATO';

-- 3. Apply new CHECK constraint
ALTER TABLE expense_reimbursements
  ADD CONSTRAINT expense_reimbursements_stato_check
  CHECK (stato IN ('IN_ATTESA','APPROVATO','RIFIUTATO','LIQUIDATO'));

-- 4. Add new columns
ALTER TABLE expense_reimbursements
  ADD COLUMN IF NOT EXISTS approved_by   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at   timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_note text,
  ADD COLUMN IF NOT EXISTS liquidated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS liquidated_by  uuid REFERENCES auth.users(id);

-- 5. Migrate approval data
UPDATE expense_reimbursements
  SET approved_by = manager_approved_by,
      approved_at = manager_approved_at
  WHERE manager_approved_by IS NOT NULL;

UPDATE expense_reimbursements
  SET approved_by = admin_approved_by,
      approved_at = admin_approved_at
  WHERE approved_by IS NULL AND admin_approved_by IS NOT NULL;

-- 6. Migrate payment data
UPDATE expense_reimbursements
  SET liquidated_at = paid_at,
      liquidated_by  = paid_by
  WHERE paid_at IS NOT NULL;

-- 7. Migrate integration_note → rejection_note for RIFIUTATO records
UPDATE expense_reimbursements
  SET rejection_note = integration_note
  WHERE stato = 'RIFIUTATO' AND integration_note IS NOT NULL;

-- 8. Drop old columns
ALTER TABLE expense_reimbursements
  DROP COLUMN IF EXISTS manager_approved_by,
  DROP COLUMN IF EXISTS manager_approved_at,
  DROP COLUMN IF EXISTS admin_approved_by,
  DROP COLUMN IF EXISTS admin_approved_at,
  DROP COLUMN IF EXISTS integration_note,
  DROP COLUMN IF EXISTS integration_reasons,
  DROP COLUMN IF EXISTS paid_at,
  DROP COLUMN IF EXISTS paid_by;

-- 9. Normalize expense_history state names
UPDATE expense_history SET stato_nuovo      = 'IN_ATTESA'
  WHERE stato_nuovo      IN ('INVIATO', 'INTEGRAZIONI_RICHIESTE');
UPDATE expense_history SET stato_nuovo      = 'APPROVATO'
  WHERE stato_nuovo      IN ('PRE_APPROVATO_RESP', 'APPROVATO_ADMIN');
UPDATE expense_history SET stato_nuovo      = 'LIQUIDATO'
  WHERE stato_nuovo      = 'PAGATO';
UPDATE expense_history SET stato_precedente = 'IN_ATTESA'
  WHERE stato_precedente IN ('INVIATO', 'INTEGRAZIONI_RICHIESTE');
UPDATE expense_history SET stato_precedente = 'APPROVATO'
  WHERE stato_precedente IN ('PRE_APPROVATO_RESP', 'APPROVATO_ADMIN');
UPDATE expense_history SET stato_precedente = 'LIQUIDATO'
  WHERE stato_precedente = 'PAGATO';

COMMIT;
