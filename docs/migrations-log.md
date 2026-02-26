# Staff Manager — Migrations Log

> Aggiornare in **Fase 2 pipeline** ogni volta che viene creata e applicata una nuova migration al DB remoto:
> aggiungere una riga con numero progressivo, filename, data di applicazione e descrizione sintetica.

| # | File | Data applicazione | Descrizione |
|---|---|---|---|
| 001 | `001_schema.sql` | — | Schema completo iniziale: compensations, expense_reimbursements, communities, collaborators, user_profiles, documents, tickets, announcements, benefits, resources, events |
| 002 | `002_rls.sql` | — | Row Level Security policies su tutte le tabelle; helper functions: `get_my_role()`, `is_active_user()`, `can_manage_community()`, `get_my_collaborator_id()` |
| 003 | `003_must_change_password.sql` | — | ADD COLUMN `must_change_password` boolean DEFAULT false su `user_profiles` |
| 004 | `004_documents_storage.sql` | — | Bucket privato `documents` + storage policies (upload autenticati, lettura service role) |
| 005 | `005_add_titolo_to_documents.sql` | — | ALTER TABLE documents ADD COLUMN `titolo` text; backfill automatico da filename |
| 006 | `006_tickets_storage.sql` | — | Bucket privato `tickets` + storage policies (10 MB, PDF/image/doc) |
| 007 | `007_communities_settings.sql` | — | ADD COLUMN `communities.is_active` boolean DEFAULT true + policy `communities_admin_write` |
| 008 | `008_avatars_bucket.sql` | — | Bucket pubblico `avatars` + storage policies (2 MB, jpg/png/webp) |
| 009 | `009_contract_templates.sql` | — | ADD COLUMN `luogo_nascita`/`comune` su collaborators; tipi `CONTRATTO_COCOCO`/`PIVA`; tabella `contract_templates`; bucket `contracts` |
| 010 | `010_onboarding.sql` | — | ADD COLUMN `onboarding_completed` su user_profiles (DEFAULT false, backfill true); `tipo_contratto` su collaborators; nome/cognome nullable |
| 011 | `011_contract_fields.sql` | — | ADD COLUMN `provincia_nascita`, `provincia_residenza`, `civico_residenza` su collaborators |
| 012 | `012_notification_settings.sql` | — | Tabella `notification_settings` + 15 righe default (toggle inapp+email per event_key×recipient_role) |
| 013 | `013_responsabile_publish_permission.sql` | — | ADD COLUMN `can_publish_announcements` boolean DEFAULT true su user_profiles |
| 014 | `014_document_macro_type.sql` | — | ADD COLUMN `macro_type` TEXT GENERATED ALWAYS (stored) + unique partial index `uq_one_contratto_per_collaborator` |
| 015 | `015_remove_super_admin.sql` | — | Rimozione ruolo `super_admin`: aggiorna CHECK constraint, migra utenti esistenti a `amministrazione`, ricrea tutte le RLS policies |
| 016 | `016_feedback.sql` | — | Tabella `feedback` + RLS (insert autenticati, select/delete admin) + bucket privato `feedback` (5 MB, immagini) |
| 017 | `017_roles_rename.sql` | 2026-02-26 | Rename `responsabile` → `responsabile_compensi`; aggiunge `responsabile_cittadino` e `responsabile_servizi_individuali`; aggiorna CHECK constraint, `can_manage_community()`, tutte le RLS policies; rename account di test |
