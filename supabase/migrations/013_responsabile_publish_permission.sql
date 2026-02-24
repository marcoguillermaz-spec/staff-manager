-- Migration 011: add can_publish_announcements flag to user_profiles
-- Allows admin to grant/revoke announcement publishing per responsabile
-- DEFAULT true preserves current behaviour for existing responsabili

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS can_publish_announcements boolean DEFAULT true;
