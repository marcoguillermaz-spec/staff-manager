-- ============================================================
-- Staff Manager — Migration 016: Feedback table + bucket
-- ============================================================
-- Stores user-submitted feedback (bug reports, suggestions, etc.)
-- with optional screenshot attachment.
-- All uploads go through the API route with service role.
-- ============================================================

CREATE TABLE feedback (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('collaboratore', 'responsabile', 'amministrazione')),
  categoria       text        NOT NULL CHECK (categoria IN ('Bug', 'Suggerimento', 'Domanda', 'Altro')),
  pagina          text        NOT NULL DEFAULT '',
  messaggio       text        NOT NULL,
  screenshot_path text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert their own feedback
CREATE POLICY feedback_insert ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only amministrazione can read feedback
CREATE POLICY feedback_admin_read ON feedback
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'amministrazione'
    )
  );

-- Only amministrazione can delete feedback
CREATE POLICY feedback_admin_delete ON feedback
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'amministrazione'
    )
  );

-- Private bucket for screenshot attachments (images only, 5 MB max)
-- Service role (used in API routes) bypasses RLS on storage —
-- authenticated users must NOT access this bucket directly.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback',
  'feedback',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;
