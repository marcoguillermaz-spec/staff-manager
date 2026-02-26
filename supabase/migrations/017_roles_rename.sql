-- ============================================================
-- Migration 017: Roles rename + new roles
--
-- Changes:
--   • 'responsabile' → 'responsabile_compensi'
--   • New roles: 'responsabile_cittadino', 'responsabile_servizi_individuali'
--   • Email renames: admin-test@example.com → admin@test.com
--                    responsabile@test.com  → responsabile_compensi@test.com
--   • notification_settings data update (recipient_role)
--   • CHECK constraint update
--   • can_manage_community function update
--   • Affected RLS policies recreated
--
-- NOTE: new test users (responsabile_cittadino@test.com,
--       responsabile_servizi_individuali@test.com) must be created
--       separately via Supabase Management API / create-user endpoint.
-- ============================================================

-- ── 1. Migrate existing responsabile users ───────────────────
UPDATE user_profiles
SET role = 'responsabile_compensi'
WHERE role = 'responsabile';

-- ── 2. Update notification_settings recipient_role ───────────
UPDATE notification_settings
SET recipient_role = 'responsabile_compensi'
WHERE recipient_role = 'responsabile';

-- ── 3. Rename test accounts in auth.users + auth.identities ──
UPDATE auth.users
SET email = 'admin@test.com'
WHERE email = 'admin-test@example.com';

UPDATE auth.identities
SET email = 'admin@test.com',
    identity_data = jsonb_set(identity_data, '{email}', '"admin@test.com"')
WHERE email = 'admin-test@example.com';

UPDATE auth.users
SET email = 'responsabile_compensi@test.com'
WHERE email = 'responsabile@test.com';

UPDATE auth.identities
SET email = 'responsabile_compensi@test.com',
    identity_data = jsonb_set(identity_data, '{email}', '"responsabile_compensi@test.com"')
WHERE email = 'responsabile@test.com';

-- ── 4. Update role CHECK constraint ──────────────────────────
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN (
    'collaboratore',
    'responsabile_cittadino',
    'responsabile_compensi',
    'responsabile_servizi_individuali',
    'amministrazione'
  ));

-- ── 5. Recreate can_manage_community (responsabile_compensi) ─
CREATE OR REPLACE FUNCTION can_manage_community(p_community_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.user_id = auth.uid()
      AND (
        up.role = 'amministrazione'
        OR (
          up.role = 'responsabile_compensi'
          AND EXISTS (
            SELECT 1 FROM user_community_access uca
            WHERE uca.user_id = auth.uid()
              AND uca.community_id = p_community_id
          )
        )
      )
  )
$$;

-- ── 6. Recreate RLS policies that reference 'responsabile' ───

-- user_profiles
DROP POLICY IF EXISTS "user_profiles_responsabile_read" ON user_profiles;
CREATE POLICY "user_profiles_responsabile_read" ON user_profiles
  FOR SELECT USING (
    get_my_role() = 'responsabile_compensi'
    AND EXISTS (
      SELECT 1 FROM collaborators c
      JOIN collaborator_communities cc ON cc.collaborator_id = c.id
      JOIN user_community_access uca ON uca.community_id = cc.community_id
      WHERE c.user_id = user_profiles.user_id
        AND uca.user_id = auth.uid()
    )
  );

-- collaborators
DROP POLICY IF EXISTS "collaborators_responsabile_read" ON collaborators;
CREATE POLICY "collaborators_responsabile_read" ON collaborators
  FOR SELECT USING (
    get_my_role() = 'responsabile_compensi'
    AND EXISTS (
      SELECT 1 FROM collaborator_communities cc
      JOIN user_community_access uca ON uca.community_id = cc.community_id
      WHERE cc.collaborator_id = collaborators.id
        AND uca.user_id = auth.uid()
    )
  );

-- collaborator_communities
DROP POLICY IF EXISTS "user_community_access_responsabile_read" ON collaborator_communities;
CREATE POLICY "user_community_access_responsabile_read" ON collaborator_communities
  FOR SELECT USING (
    get_my_role() = 'responsabile_compensi'
    AND EXISTS (
      SELECT 1 FROM user_community_access uca
      WHERE uca.community_id = collaborator_communities.community_id
        AND uca.user_id = auth.uid()
    )
  );

-- compensations
DROP POLICY IF EXISTS "compensations_responsabile_update" ON compensations;
CREATE POLICY "compensations_responsabile_update" ON compensations
  FOR UPDATE USING (
    get_my_role() = 'responsabile_compensi'
    AND can_manage_community(community_id)
    AND stato IN ('INVIATO', 'INTEGRAZIONI_RICHIESTE')
  );

-- expense_reimbursements
DROP POLICY IF EXISTS "expenses_responsabile_read" ON expense_reimbursements;
CREATE POLICY "expenses_responsabile_read" ON expense_reimbursements
  FOR SELECT USING (
    get_my_role() = 'responsabile_compensi'
    AND EXISTS (
      SELECT 1 FROM collaborator_communities cc
      JOIN user_community_access uca ON uca.community_id = cc.community_id
      WHERE cc.collaborator_id = expense_reimbursements.collaborator_id
        AND uca.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "expenses_responsabile_update" ON expense_reimbursements;
CREATE POLICY "expenses_responsabile_update" ON expense_reimbursements
  FOR UPDATE USING (
    get_my_role() = 'responsabile_compensi'
    AND EXISTS (
      SELECT 1 FROM collaborator_communities cc
      JOIN user_community_access uca ON uca.community_id = cc.community_id
      WHERE cc.collaborator_id = expense_reimbursements.collaborator_id
        AND uca.user_id = auth.uid()
    )
    AND stato IN ('INVIATO', 'INTEGRAZIONI_RICHIESTE')
  );

-- expense_attachments
DROP POLICY IF EXISTS "exp_attachments_manager_read" ON expense_attachments;
CREATE POLICY "exp_attachments_manager_read" ON expense_attachments
  FOR SELECT USING (
    get_my_role() = 'responsabile_compensi'
    AND EXISTS (
      SELECT 1 FROM expense_reimbursements e
      JOIN collaborator_communities cc ON cc.collaborator_id = e.collaborator_id
      JOIN user_community_access uca ON uca.community_id = cc.community_id
      WHERE e.id = reimbursement_id
        AND uca.user_id = auth.uid()
    )
  );

-- expense_history
DROP POLICY IF EXISTS "exp_history_manager_read" ON expense_history;
CREATE POLICY "exp_history_manager_read" ON expense_history
  FOR SELECT USING (
    get_my_role() = 'responsabile_compensi'
    AND EXISTS (
      SELECT 1 FROM expense_reimbursements e
      JOIN collaborator_communities cc ON cc.collaborator_id = e.collaborator_id
      JOIN user_community_access uca ON uca.community_id = cc.community_id
      WHERE e.id = reimbursement_id
        AND uca.user_id = auth.uid()
    )
  );

-- tickets (updated in 015, now finalise with responsabile_compensi)
DROP POLICY IF EXISTS "tickets_admin_update" ON tickets;
CREATE POLICY "tickets_admin_update" ON tickets
  FOR UPDATE USING (get_my_role() IN ('amministrazione', 'responsabile_compensi'));

-- announcements (updated in 015, now finalise with responsabile_compensi)
DROP POLICY IF EXISTS "announcements_admin_write" ON announcements;
CREATE POLICY "announcements_admin_write" ON announcements
  FOR ALL USING (get_my_role() IN ('amministrazione', 'responsabile_compensi'));
