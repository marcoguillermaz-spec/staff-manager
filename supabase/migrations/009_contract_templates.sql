-- ============================================================
-- Staff Manager — Migration 009: Contract Templates
-- ============================================================

-- 1. Add missing collaborator fields required for contract generation
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS luogo_nascita text;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS comune        text;

-- 2. Extend documents.tipo constraint to include new contract types
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_tipo_check;
ALTER TABLE documents ADD CONSTRAINT documents_tipo_check
  CHECK (tipo IN (
    'CONTRATTO_OCCASIONALE', 'CONTRATTO_COCOCO', 'CONTRATTO_PIVA',
    'RICEVUTA_PAGAMENTO', 'CU'
  ));

-- 3. Contract templates table (one row per tipo — replaced, not versioned)
CREATE TABLE IF NOT EXISTS contract_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        text        NOT NULL UNIQUE
                CHECK (tipo IN ('OCCASIONALE', 'COCOCO', 'PIVA')),
  file_url    text        NOT NULL,   -- storage path in contracts bucket
  file_name   text        NOT NULL,
  uploaded_by uuid        REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

-- Only admin/super_admin can read templates
CREATE POLICY "contract_templates_admin_read" ON contract_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('amministrazione', 'super_admin')
        AND is_active = true
    )
  );

-- 4. Storage bucket for .docx contract templates (private, 5 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  5242880,
  ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;
