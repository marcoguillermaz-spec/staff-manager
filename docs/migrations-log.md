# Staff Manager — Migrations Log

> Update in **pipeline Phase 2** every time a new migration is created and applied to the remote DB:
> add a row with sequential number, filename, application date, and a brief description.

| # | File | Applied on | Description |
|---|---|---|---|
| 001 | `001_schema.sql` | — | Initial full schema: compensations, expense_reimbursements, communities, collaborators, user_profiles, documents, tickets, announcements, benefits, resources, events |
| 002 | `002_rls.sql` | — | Row Level Security policies on all tables; helper functions: `get_my_role()`, `is_active_user()`, `can_manage_community()`, `get_my_collaborator_id()` |
| 003 | `003_must_change_password.sql` | — | ADD COLUMN `must_change_password` boolean DEFAULT false on `user_profiles` |
| 004 | `004_documents_storage.sql` | — | Private bucket `documents` + storage policies (authenticated upload, service role read) |
| 005 | `005_add_titolo_to_documents.sql` | — | ALTER TABLE documents ADD COLUMN `titolo` text; automatic backfill from filename |
| 006 | `006_tickets_storage.sql` | — | Private bucket `tickets` + storage policies (10 MB, PDF/image/doc) |
| 007 | `007_communities_settings.sql` | — | ADD COLUMN `communities.is_active` boolean DEFAULT true + policy `communities_admin_write` |
| 008 | `008_avatars_bucket.sql` | — | Public bucket `avatars` + storage policies (2 MB, jpg/png/webp) |
| 009 | `009_contract_templates.sql` | — | ADD COLUMN `luogo_nascita`/`comune` on collaborators; types `CONTRATTO_COCOCO`/`PIVA`; table `contract_templates`; bucket `contracts` |
| 010 | `010_onboarding.sql` | — | ADD COLUMN `onboarding_completed` on user_profiles (DEFAULT false, backfill true); `tipo_contratto` on collaborators; nome/cognome nullable |
| 011 | `011_contract_fields.sql` | — | ADD COLUMN `provincia_nascita`, `provincia_residenza`, `civico_residenza` on collaborators |
| 012 | `012_notification_settings.sql` | — | Table `notification_settings` + 15 default rows (inapp+email toggle per event_key×recipient_role) |
| 013 | `013_responsabile_publish_permission.sql` | — | ADD COLUMN `can_publish_announcements` boolean DEFAULT true on user_profiles |
| 014 | `014_document_macro_type.sql` | — | ADD COLUMN `macro_type` TEXT GENERATED ALWAYS (stored) + unique partial index `uq_one_contratto_per_collaborator` |
| 015 | `015_remove_super_admin.sql` | — | Remove `super_admin` role: update CHECK constraint, migrate existing users to `amministrazione`, recreate all RLS policies |
| 016 | `016_feedback.sql` | — | Table `feedback` + RLS (authenticated insert, admin select/delete) + private bucket `feedback` (5 MB, images) |
| 017 | `017_roles_rename.sql` | 2026-02-26 | Rename `responsabile` → `responsabile_compensi`; add `responsabile_cittadino` and `responsabile_servizi_individuali`; update CHECK constraint, `can_manage_community()`, all RLS policies; rename test accounts |
