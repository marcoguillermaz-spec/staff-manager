-- Migration 024: remove BOZZA state from compensations + add corso_appartenenza
-- Block 7c/8: compensations are now created directly as IN_ATTESA by responsabile/admin.
-- BOZZA is no longer a valid state. Existing BOZZA records → IN_ATTESA.

-- Step 1: migrate existing BOZZA records to IN_ATTESA
UPDATE compensations
SET stato = 'IN_ATTESA'
WHERE stato = 'BOZZA';

-- Step 2: update CHECK constraint to remove BOZZA
ALTER TABLE compensations DROP CONSTRAINT IF EXISTS compensations_stato_check;
ALTER TABLE compensations ADD CONSTRAINT compensations_stato_check
  CHECK (stato IN ('IN_ATTESA', 'APPROVATO', 'RIFIUTATO', 'LIQUIDATO'));

-- Step 3: if the column has a DEFAULT of 'BOZZA', update it to 'IN_ATTESA'
ALTER TABLE compensations ALTER COLUMN stato SET DEFAULT 'IN_ATTESA';

-- Step 4: add corso_appartenenza optional text field
ALTER TABLE compensations ADD COLUMN IF NOT EXISTS corso_appartenenza TEXT;
