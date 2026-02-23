-- Migration 010: onboarding flow
-- Adds onboarding_completed flag to user_profiles
-- Adds tipo_contratto to collaborators
-- Makes nome/cognome nullable (filled during onboarding)

-- 1. onboarding_completed flag
ALTER TABLE user_profiles
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;

-- All existing users have already completed onboarding
UPDATE user_profiles SET onboarding_completed = true;

-- 2. tipo_contratto on collaborators (OCCASIONALE | COCOCO | PIVA)
ALTER TABLE collaborators
  ADD COLUMN tipo_contratto text;

-- 3. Make nome/cognome nullable so invite can create an empty record
ALTER TABLE collaborators ALTER COLUMN nome DROP NOT NULL;
ALTER TABLE collaborators ALTER COLUMN cognome DROP NOT NULL;
