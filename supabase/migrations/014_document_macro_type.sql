-- Add macro_type as a generated column for grouping (CONTRATTO / RICEVUTA_PAGAMENTO / CU)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS macro_type TEXT GENERATED ALWAYS AS (
  CASE
    WHEN tipo LIKE 'CONTRATTO_%' THEN 'CONTRATTO'
    WHEN tipo = 'RICEVUTA_PAGAMENTO' THEN 'RICEVUTA_PAGAMENTO'
    WHEN tipo = 'CU' THEN 'CU'
    ELSE NULL
  END
) STORED;

-- Unique constraint: max 1 CONTRATTO attivo per collaboratore
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_contratto_per_collaborator
  ON documents(collaborator_id)
  WHERE macro_type = 'CONTRATTO';
