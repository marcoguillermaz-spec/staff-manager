-- Consolidate contract types: OCCASIONALE only (remove COCOCO and PIVA)
-- Development environment: no real data, safe to delete/migrate all records

-- 1. Remove historical documents of deprecated contract types
DELETE FROM documents WHERE tipo IN ('CONTRATTO_COCOCO', 'CONTRATTO_PIVA');

-- 2. Migrate existing collaborators with COCOCO/PIVA to OCCASIONALE
UPDATE collaborators
  SET tipo_contratto = 'OCCASIONALE'
  WHERE tipo_contratto IN ('COCOCO', 'PIVA');

-- 3. Update CHECK constraint on collaborators.tipo_contratto
ALTER TABLE collaborators DROP CONSTRAINT IF EXISTS collaborators_tipo_contratto_check;
ALTER TABLE collaborators
  ADD CONSTRAINT collaborators_tipo_contratto_check
  CHECK (tipo_contratto IN ('OCCASIONALE'));

-- 4. Update CHECK constraint on contract_templates.tipo
ALTER TABLE contract_templates DROP CONSTRAINT IF EXISTS contract_templates_tipo_check;
-- Remove COCOCO/PIVA contract templates before adding new constraint
DELETE FROM contract_templates WHERE tipo IN ('COCOCO', 'PIVA');
ALTER TABLE contract_templates
  ADD CONSTRAINT contract_templates_tipo_check
  CHECK (tipo IN ('OCCASIONALE'));

-- 5. Update CHECK constraint on documents.tipo (remove CONTRATTO_COCOCO, CONTRATTO_PIVA)
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_tipo_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_tipo_check
  CHECK (tipo IN ('CONTRATTO_OCCASIONALE', 'RICEVUTA_PAGAMENTO', 'CU'));
