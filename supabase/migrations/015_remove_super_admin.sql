-- ============================================================
-- Migration 015: Remove super_admin role
-- Migrate all super_admin users to amministrazione,
-- update CHECK constraint, recreate affected RLS policies.
-- ============================================================

-- 1. Migrate existing super_admin users to amministrazione
UPDATE user_profiles
SET role = 'amministrazione'
WHERE role = 'super_admin';

-- 2. Update role CHECK constraint (drop old, add new without super_admin)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('collaboratore', 'responsabile', 'amministrazione'));

-- 3. Recreate can_manage_community function (removes super_admin check)
CREATE OR REPLACE FUNCTION can_manage_community(p_community_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.user_id = auth.uid()
      AND (
        up.role = 'amministrazione'
        OR (
          up.role = 'responsabile'
          AND EXISTS (
            SELECT 1 FROM user_community_access uca
            WHERE uca.user_id = auth.uid()
              AND uca.community_id = p_community_id
          )
        )
      )
  )
$$;

-- ============================================================
-- 4. Recreate RLS policies that referenced super_admin
-- ============================================================

-- user_profiles: admin read
DROP POLICY IF EXISTS "user_profiles_admin_read" ON user_profiles;
CREATE POLICY "user_profiles_admin_read" ON user_profiles
  FOR SELECT USING (get_my_role() = 'amministrazione');

-- user_profiles: superadmin_write → admin_write
DROP POLICY IF EXISTS "user_profiles_superadmin_write" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_write" ON user_profiles;
CREATE POLICY "user_profiles_admin_write" ON user_profiles
  FOR ALL USING (get_my_role() = 'amministrazione');

-- user_community_access
DROP POLICY IF EXISTS "uca_admin_all" ON user_community_access;
CREATE POLICY "uca_admin_all" ON user_community_access
  FOR ALL USING (get_my_role() = 'amministrazione');

-- collaborators
DROP POLICY IF EXISTS "collaborators_admin_read" ON collaborators;
CREATE POLICY "collaborators_admin_read" ON collaborators
  FOR SELECT USING (get_my_role() = 'amministrazione');

DROP POLICY IF EXISTS "collaborators_admin_write" ON collaborators;
CREATE POLICY "collaborators_admin_write" ON collaborators
  FOR ALL USING (get_my_role() = 'amministrazione');

-- collaborator_communities
DROP POLICY IF EXISTS "user_community_access_admin_all" ON collaborator_communities;
CREATE POLICY "user_community_access_admin_all" ON collaborator_communities
  FOR ALL USING (get_my_role() = 'amministrazione');

-- compensations
DROP POLICY IF EXISTS "compensations_admin_all" ON compensations;
CREATE POLICY "compensations_admin_all" ON compensations
  FOR ALL USING (get_my_role() = 'amministrazione');

-- compensation_attachments
DROP POLICY IF EXISTS "comp_attachments_admin_all" ON compensation_attachments;
CREATE POLICY "comp_attachments_admin_all" ON compensation_attachments
  FOR ALL USING (get_my_role() = 'amministrazione');

-- expense_reimbursements
DROP POLICY IF EXISTS "expenses_admin_all" ON expense_reimbursements;
CREATE POLICY "expenses_admin_all" ON expense_reimbursements
  FOR ALL USING (get_my_role() = 'amministrazione');

-- expense_attachments
DROP POLICY IF EXISTS "exp_attachments_admin_all" ON expense_attachments;
CREATE POLICY "exp_attachments_admin_all" ON expense_attachments
  FOR ALL USING (get_my_role() = 'amministrazione');

-- documents
DROP POLICY IF EXISTS "documents_admin_all" ON documents;
CREATE POLICY "documents_admin_all" ON documents
  FOR ALL USING (get_my_role() = 'amministrazione');

-- tickets
DROP POLICY IF EXISTS "tickets_manager_read" ON tickets;
CREATE POLICY "tickets_manager_read" ON tickets
  FOR SELECT USING (
    can_manage_community(community_id)
    OR get_my_role() = 'amministrazione'
  );

DROP POLICY IF EXISTS "tickets_admin_update" ON tickets;
CREATE POLICY "tickets_admin_update" ON tickets
  FOR UPDATE USING (get_my_role() IN ('amministrazione', 'responsabile'));

-- ticket_messages
DROP POLICY IF EXISTS "ticket_messages_read" ON ticket_messages;
CREATE POLICY "ticket_messages_read" ON ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
        AND (
          t.creator_user_id = auth.uid()
          OR can_manage_community(t.community_id)
          OR get_my_role() = 'amministrazione'
        )
    )
  );

DROP POLICY IF EXISTS "ticket_messages_insert" ON ticket_messages;
CREATE POLICY "ticket_messages_insert" ON ticket_messages
  FOR INSERT WITH CHECK (
    author_user_id = auth.uid()
    AND is_active_user()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
        AND (
          t.creator_user_id = auth.uid()
          OR can_manage_community(t.community_id)
          OR get_my_role() = 'amministrazione'
        )
    )
  );

-- announcements
DROP POLICY IF EXISTS "announcements_admin_write" ON announcements;
CREATE POLICY "announcements_admin_write" ON announcements
  FOR ALL USING (get_my_role() IN ('amministrazione', 'responsabile'));

-- benefits
DROP POLICY IF EXISTS "benefits_admin_write" ON benefits;
CREATE POLICY "benefits_admin_write" ON benefits
  FOR ALL USING (get_my_role() = 'amministrazione');

-- resources
DROP POLICY IF EXISTS "resources_admin_write" ON resources;
CREATE POLICY "resources_admin_write" ON resources
  FOR ALL USING (get_my_role() = 'amministrazione');

-- events
DROP POLICY IF EXISTS "events_admin_write" ON events;
CREATE POLICY "events_admin_write" ON events
  FOR ALL USING (get_my_role() = 'amministrazione');

-- communities (from migration 007)
DROP POLICY IF EXISTS "communities_admin_write" ON communities;
CREATE POLICY "communities_admin_write" ON communities
  FOR ALL USING (get_my_role() = 'amministrazione');

-- notification_settings (from migration 012)
DROP POLICY IF EXISTS "notif_settings_admin_write" ON notification_settings;
CREATE POLICY "notif_settings_admin_write" ON notification_settings
  FOR UPDATE USING (get_my_role() = 'amministrazione');

-- contract_templates (from migration 009)
DROP POLICY IF EXISTS "contract_templates_admin_read" ON contract_templates;
CREATE POLICY "contract_templates_admin_read" ON contract_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role = 'amministrazione'
        AND is_active = true
    )
  );

-- ============================================================
-- 5. Storage policies (storage.objects) — from migration 004
-- ============================================================
DROP POLICY IF EXISTS "documents_admin_upload" ON storage.objects;
CREATE POLICY "documents_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'amministrazione'
  );

DROP POLICY IF EXISTS "documents_admin_read" ON storage.objects;
CREATE POLICY "documents_admin_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'amministrazione'
  );

DROP POLICY IF EXISTS "documents_admin_delete" ON storage.objects;
CREATE POLICY "documents_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'amministrazione'
  );
