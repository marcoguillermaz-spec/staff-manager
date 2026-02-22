-- ============================================================
-- 007: Communities settings — add is_active flag
-- ============================================================
-- Allows admin to deactivate a community without deleting it.
-- Inactive communities are hidden from all selects in the system
-- but existing records remain linked.
-- ============================================================

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- RLS: admin/super_admin can create and update communities
CREATE POLICY "communities_admin_write" ON communities
  FOR ALL USING (get_my_role() IN ('amministrazione', 'super_admin'));
