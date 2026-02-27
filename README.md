# Staff Manager

Internal portal for managing collaborators, compensation/reimbursement approvals, documents, and support tickets. Role-based access control (email/password, invite-only) via Supabase Auth.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript, `output: 'standalone'`)
- **Styling**: Tailwind CSS — no component libraries
- **Auth**: Supabase Auth (email/password, invite-only, forced password change on first login)
- **Database**: Supabase Postgres with Row Level Security
- **Email**: Resend (transactional, fire-and-forget, `noreply@testbusters.it`)
- **Testing**: Vitest + @vitest/coverage-v8

## Roles

| Role | Access |
|------|--------|
| `collaboratore` | Own profile, compensation requests, reimbursements, documents, support tickets |
| `responsabile_compensi` | Approve compensations/reimbursements for assigned communities; own profile, documents, and support tickets |
| `responsabile_cittadino` | *(in definition — access TBD)* |
| `responsabile_servizi_individuali` | *(in definition — access TBD)* |
| `amministrazione` | Full approval queue, payments, user management, exports, settings |

## Compensation Flow (State Machine)

Compensations created by `responsabile_compensi` or `amministrazione` — always start as `IN_ATTESA`.

```
IN_ATTESA → APPROVATO → LIQUIDATO
          ↘ RIFIUTATO (rejection_note obbligatoria)
RIFIUTATO → IN_ATTESA (reopen, collaboratore)
```

| Action | From | To | Role |
|--------|------|----|------|
| reopen | RIFIUTATO | IN_ATTESA | collaboratore |
| approve | IN_ATTESA | APPROVATO | responsabile_compensi, amministrazione |
| reject | IN_ATTESA | RIFIUTATO | responsabile_compensi, amministrazione |
| mark_liquidated | APPROVATO | LIQUIDATO | responsabile_compensi, amministrazione |

## Reimbursement Flow (State Machine)

Reimbursements created by `collaboratore` — submitted directly as `IN_ATTESA`.

```
IN_ATTESA → APPROVATO → LIQUIDATO
          ↘ RIFIUTATO
```

| Action | From | To | Role |
|--------|------|----|------|
| approve | IN_ATTESA | APPROVATO | responsabile_compensi, amministrazione |
| reject | IN_ATTESA | RIFIUTATO | responsabile_compensi, amministrazione |
| mark_liquidated | APPROVATO | LIQUIDATO | responsabile_compensi, amministrazione |

## Project Structure

```
app/
  (app)/
    page.tsx                     → Dashboard collaboratore (cards, quick actions, cosa mi manca, feed) + responsabile (CommCard per community, cosa devo fare, feed pending) + amministrazione (KPI, community cards, urgenti, feed filtrable, period metrics, blocks drawer)
    layout.tsx                   → Protected layout (auth guard + Sidebar)
    profilo/page.tsx             → Profile editor + tab Documenti for collaboratore (avatar, fiscal data, editable IBAN/phone/address/tshirt | DocumentList)
    impostazioni/page.tsx        → Settings: 5-tab server component — Users (create), Community (CRUD + responsabile assignment), Collaborators (member_status), Contratti (template upload), Notifiche (in-app + email toggles per event)
    compensi/page.tsx            → Collaboratore: unified Compensi e Rimborsi page (PaymentOverview + CompensationList + ExpenseList + TicketQuickModal)
    compensi/nuova/page.tsx      → (removed in Block 7)
    compensi/[id]/page.tsx       → Compensation detail + timeline + actions
    rimborsi/page.tsx            → Redirect → /compensi (unified page)
    rimborsi/nuova/page.tsx      → Reimbursement creation form (single step)
    rimborsi/[id]/page.tsx       → Reimbursement detail + timeline + actions
    approvazioni/page.tsx        → Responsabile: pending queue (?tab=compensi|rimborsi) + "Carica compensi" button
    approvazioni/carica/page.tsx → Responsabile/admin: choice screen (Singolo per docente | Excel placeholder) + CompensationCreateWizard
    collaboratori/page.tsx       → Responsabile + admin: paginated list (20/page) with URL-driven filters (all/doc-da-firmare/stallo)
    collaboratori/[id]/page.tsx  → Collaborator detail: anagrafica + compensi/rimborsi/documenti + inline pre-approva/integrazioni
    coda/page.tsx                → Admin: pre-approved + approved queue (?tab=compensi|rimborsi)
    export/page.tsx              → Admin: export approved records as CSV/XLSX + bulk mark-paid (?tab=occasionali|piva|rimborsi)
    documenti/page.tsx           → Admin: 3 tabs (list/upload/cu-batch). Responsabile: list + upload. Collaboratore: redirect → /profilo?tab=documenti
    eventi/page.tsx              → Collaboratore: events list (read-only, ordered by start_datetime ASC)
    comunicazioni/page.tsx       → Collaboratore: 2 tabs — Comunicazioni (AnnouncementBoard) + Risorse (ResourceList), read-only
    opportunita/page.tsx         → Collaboratore: benefits list (BenefitList read-only)
    documenti/[id]/page.tsx      → Document detail with signed URL + sign flow (checkbox gate) + delete section for admin+CONTRATTO
    ticket/page.tsx              → Ticket list (collaboratore: own; admin/responsabile: all + Collaboratore column)
    ticket/nuova/page.tsx        → Create new ticket form
    ticket/[id]/page.tsx         → Ticket detail: message thread + reply form + status change buttons
    contenuti/page.tsx           → Content hub: 4 URL-based tabs (bacheca/agevolazioni/guide/eventi), per-tab fetch
    notifiche/page.tsx           → Full notifications page (Suspense wrapper → NotificationPageClient)
    feedback/page.tsx            → Admin-only: list all feedback with categoria badge, role, pagina, message, signed screenshot URL (1h TTL)
  api/
    profile/route.ts             → PATCH own profile fields (nome, cognome, codice_fiscale, data_nascita, luogo_nascita, provincia_nascita, comune, provincia_residenza, telefono, indirizzo, civico_residenza, IBAN, tshirt, partita_iva, ha_figli_a_carico)
    profile/avatar/route.ts      → POST upload profile photo → avatars bucket
    auth/change-password/        → POST forced password change
    auth/clear-force-change/     → POST clear must_change_password flag
    admin/create-user/           → POST invite new user (email + role + tipo_contratto required) + create collaborators record, onboarding_completed=false
    admin/communities/           → GET list communities (?all=1 returns inactive too) + POST create
    admin/communities/[id]/      → PATCH rename + toggle is_active
    admin/responsabili/[userId]/communities/ → PUT replace community assignments for a responsabile
    admin/responsabili/[userId]/publish-permission/ → PATCH toggle can_publish_announcements for a responsabile
    admin/members/[id]/status/   → PATCH update member_status for a collaboratore
    admin/members/[id]/data-ingresso/ → PATCH update data_ingresso (admin only)
    admin/contract-templates/    → GET list templates + POST upload/replace .docx per type (OCCASIONALE/COCOCO/PIVA)
    admin/collaboratori/route.ts → GET search collaborators (q, community_id, active_only) scoped for responsabile
    admin/blocks/clear-flag/     → POST clear must_change_password flag for a user (admin only)
    admin/notification-settings/ → GET list all 15 settings + PATCH toggle inapp_enabled/email_enabled (admin only)
    feedback/route.ts            → POST create feedback entry (authenticated; FormData: categoria/pagina/messaggio/screenshot)
    compensations/route.ts       → GET (list, role-filtered) + POST (create, responsabile/admin only, always IN_ATTESA)
    compensations/[id]/route.ts  → GET (detail + history)
    compensations/[id]/transition/route.ts → POST (state machine: reopen/approve/reject/mark_liquidated)
    compensations/communities/route.ts → GET (collaboratore's communities)
    expenses/route.ts            → GET (list) + POST (create, always INVIATO)
    expenses/[id]/route.ts       → GET (detail + history + attachments)
    expenses/[id]/transition/route.ts → POST (reimbursement state machine)
    expenses/[id]/attachments/route.ts → POST (register uploaded file)
    export/mark-paid/route.ts    → POST (bulk mark APPROVATO_ADMIN → PAGATO + history, admin only)
    documents/route.ts           → GET (list, RLS-filtered) + POST (create; collab/resp forces NON_RICHIESTO; enforces 1 CONTRATTO per collaboratore)
    documents/[id]/route.ts      → GET (detail + signed URL) + DELETE (admin only, CONTRATTO only, hard-deletes storage + DB)
    documents/[id]/sign/route.ts → POST (collab/resp uploads signed PDF; requires confirmed=true in FormData)
    documents/cu-batch/route.ts  → POST (ZIP+CSV batch import, dedup by collaborator+anno, notifications)
    notifications/route.ts       → GET (paginated list + real unread count; ?page/limit/unread_only) + PATCH (mark all read)
    notifications/[id]/route.ts  → PATCH (mark single read) + DELETE (dismiss)
    tickets/route.ts             → GET (list, role-filtered + enriched with creator name) + POST (create)
    tickets/[id]/route.ts        → GET (detail + messages + signed attachment URLs + author role labels)
    tickets/[id]/messages/route.ts → POST (reply FormData + optional file, service role, notification on reply)
    tickets/[id]/status/route.ts → PATCH (change status APERTO/IN_LAVORAZIONE/CHIUSO, admin/responsabile)
    announcements/route.ts       → GET (pinned first) + POST (admin/responsabile)
    announcements/[id]/route.ts  → PATCH + DELETE
    benefits/route.ts            → GET + POST (admin)
    benefits/[id]/route.ts       → PATCH + DELETE
    resources/route.ts           → GET + POST with tag[] (admin)
    resources/[id]/route.ts      → PATCH + DELETE
    events/route.ts              → GET (ordered by start_datetime asc) + POST (admin)
    events/[id]/route.ts         → PATCH + DELETE
    onboarding/complete/route.ts → POST save anagrafica + generate contract (docxtemplater) + onboarding_completed=true
  auth/callback/route.ts
  login/page.tsx
  change-password/page.tsx
  onboarding/page.tsx          → Standalone onboarding wizard (proxy redirects here when onboarding_completed=false)
  pending/page.tsx
  layout.tsx
  globals.css

components/
  onboarding/
    OnboardingWizard.tsx         → 2-step client wizard: anagrafica (all fields required) + contract generation + download
  impostazioni/
    CreateUserForm.tsx            → Create user form with dual-mode toggle: "Invito rapido" (email + nome + cognome + tipo_contratto required) and "Invito completo" (full optional anagrafica pre-fill)
    CommunityManager.tsx          → Community CRUD (create/rename/toggle active) + responsabile→community assignment
    MemberStatusManager.tsx       → Collaborator list with member_status dropdown + data_ingresso inline edit
    ContractTemplateManager.tsx   → Admin: upload/replace .docx templates per type (OCCASIONALE/COCOCO/PIVA) + placeholders reference (including 13 CoCoCo-specific vars)
    NotificationSettingsManager.tsx → Admin: toggle grid for in-app + email per event×role (15 rows, optimistic updates)
  Sidebar.tsx                    → Role-based navigation sidebar (hosts NotificationBell); renders comingSoon items as non-clickable span with "Presto" badge
  NotificationBell.tsx           → Bell icon + unread badge + dropdown (30s polling, mark-read single on click, mark-all button, dismiss ×, loading/error states, truncation warning, link to /notifiche)
  FeedbackButton.tsx             → Fixed bottom-right floating button (all app pages): opens modal form (categoria/pagina/messaggio/screenshot upload), POST to /api/feedback, success toast
  notifications/
    NotificationPageClient.tsx   → Full notifications page: "solo non lette" filter toggle, pagination (20/page), mark-read + dismiss per row
  ProfileForm.tsx                → Profile edit form (avatar, fiscal data, guide collassabili)
  compensation/
    PaymentOverview.tsx          → Server component: payments by year (PAGATO) + pending balance
  compensation/
    StatusBadge.tsx              → Pill badge for CompensationStatus | ExpenseStatus
    CompensationCreateWizard.tsx → 3-step creation wizard for responsabile/admin (choice→search collab→data→summary+create)
    CompensationList.tsx         → Table with status filter
    CompensationDetail.tsx       → Read-only detail card
    Timeline.tsx                 → Chronological event list (accepts HistoryEvent[])
    ActionPanel.tsx              → Role-aware action buttons + modals
  expense/
    ExpenseList.tsx              → Reimbursement table with status filter
    ExpenseDetail.tsx            → Read-only reimbursement detail card
    ExpenseActionPanel.tsx       → Role-aware action buttons + modals for reimbursements
    ExpenseForm.tsx              → Single-step creation form (categoria, data, importo, descrizione + file upload)
  export/
    ExportSection.tsx            → Client: tab bar + action buttons (CSV/XLSX/mark-paid) + modal
    ExportTable.tsx              → Table with checkboxes, columns vary by tab
  documents/
    DocumentList.tsx             → Documents grouped by macro-type (CONTRATTO/RICEVUTA/CU) with type badges (violet/teal/blue) + delete button for admin on CONTRATTO
    DocumentUploadForm.tsx       → Bifurcated admin/non-admin: admin gets collaboratore selector + tipo optgroup + firma toggle (CONTRATTO only); non-admin gets simplified form (NON_RICHIESTO enforced server-side)
    DocumentSignFlow.tsx         → Collaboratore: download original + checkbox confirmation gate + upload signed PDF
    DocumentDeleteButton.tsx     → Client component: delete CONTRATTO (admin only) via DELETE API + redirect
    CUBatchUpload.tsx            → Admin: ZIP + CSV + year batch import with success/duplicate/error detail
  ticket/
    TicketStatusBadge.tsx        → Pill badge for ticket status (APERTO=green, IN_LAVORAZIONE=yellow, CHIUSO=gray)
    TicketList.tsx               → Ticket table with status/priority filters + Collaboratore column for admin
    TicketForm.tsx               → Create form (fixed category dropdown, oggetto, optional initial message)
    TicketQuickModal.tsx         → Self-contained modal with trigger button: opens inline ticket form (categoria/oggetto/messaggio), POST /api/tickets, redirect to /ticket/[id]
    TicketThread.tsx             → Server-side message thread with author labels, closed banner, signed URLs
    TicketMessageForm.tsx        → Reply form (textarea + file) + status change buttons (admin/responsabile)
  admin/
    types.ts                     → Shared TypeScript types for admin dashboard (AdminDashboardData, AdminKPIs, AdminBlockItem, etc.)
    BlocksDrawer.tsx             → Slide-in drawer: block situations grouped by type (password, onboarding, stalled comps/exps) with direct actions
    AdminDashboard.tsx           → Main admin dashboard client component (KPI cards, community cards, urgenti, feed filters, Recharts period charts, blocks drawer trigger)
  responsabile/
    CollaboratoreDetail.tsx      → Client: anagrafica header + compensi/rimborsi/documenti sections with inline action buttons + integration modal
  contenuti/
    AnnouncementBoard.tsx        → Announcement CRUD with pin, community scope, expiry-unaware display
    BenefitList.tsx              → Benefit CRUD with expiry badge (Attivo/In scadenza/Scaduto), discount code
    ResourceList.tsx             → Resource CRUD with comma-separated tag → chip display, link + file_url
    EventList.tsx                → Event CRUD with datetime, location, Luma external link + iframe embed

lib/
  supabase/client.ts             → Browser Supabase client
  supabase/server.ts             → Server Supabase client (SSR)
  types.ts                       → Role, status enums, DB row interfaces (Compensation, Expense, HistoryEvent)
  nav.ts                         → NAV_BY_ROLE config; NavItem supports comingSoon flag (collaboratore: 8 voci semantiche)
  compensation-transitions.ts    → Pure state machine: canTransition, applyTransition (4 actions: reopen/approve/reject/mark_liquidated)
  expense-transitions.ts         → Pure state machine: canExpenseTransition, applyExpenseTransition (7 actions incl. reject_manager)
  export-utils.ts                → Pure functions: buildCSV, buildXLSXWorkbook, ExportItem type
  documents-storage.ts           → buildStoragePath, getSignedUrl, getDocumentUrls (1h TTL, service role)
  notification-utils.ts          → Pure notification payload builders (comp/expense/ticket — collaboratore + responsabile side)
  notification-helpers.ts        → DB helpers: getNotificationSettings (SettingsMap), getCollaboratorInfo, getResponsabiliForCommunity/Collaborator/User
  email.ts                       → Resend transactional email wrapper (fire-and-forget, from noreply@testbusters.it)
  email-templates.ts             → 8 branded HTML templates E1–E8 (Testbusters logo + legal footer; APP_URL env controls all CTA links)

supabase/migrations/
  001_schema.sql                 → Full schema (compensations, expense_reimbursements, communities, documents, etc.)
  002_rls.sql                    → Row Level Security policies
  003_must_change_password.sql   → must_change_password column
  004_documents_storage.sql      → Private `documents` bucket + storage policies
  005_add_titolo_to_documents.sql → ALTER TABLE documents ADD COLUMN titolo text
  006_tickets_storage.sql        → Private `tickets` bucket + storage policies (10MB, PDF/image/doc)
  007_communities_settings.sql   → ADD COLUMN communities.is_active boolean DEFAULT true + admin write policy
  008_avatars_bucket.sql         → Public `avatars` bucket + storage policies (2MB, jpg/png/webp)
  009_contract_templates.sql     → luogo_nascita/comune on collaborators, CONTRATTO_COCOCO/PIVA doc types, contract_templates table, contracts bucket
  010_onboarding.sql             → onboarding_completed on user_profiles, tipo_contratto on collaborators, nome/cognome nullable
  011_contract_fields.sql        → ADD COLUMN provincia_nascita, provincia_residenza, civico_residenza on collaborators
  012_notification_settings.sql  → notification_settings table + 15 default rows (per-event × recipient_role, inapp + email toggles)
  013_responsabile_publish_permission.sql → ADD COLUMN can_publish_announcements boolean DEFAULT true on user_profiles
  014_document_macro_type.sql    → macro_type stored generated column + unique partial index (one CONTRATTO per collaborator)
  015_remove_super_admin.sql     → Remove super_admin role: update CHECK constraint, migrate existing users to amministrazione, recreate all RLS policies
  016_feedback.sql               → feedback table + RLS (insert for authenticated, select/delete for amministrazione) + private `feedback` bucket (5 MB, images)
  017_roles_rename.sql           → Rename `responsabile` → `responsabile_compensi`; add `responsabile_cittadino` + `responsabile_servizi_individuali`; update CHECK constraint, can_manage_community(), all RLS policies; rename test accounts
  018_sono_figlio_a_carico.sql   → Rename ha_figli_a_carico → sono_un_figlio_a_carico
  019_importo_lordo_massimale.sql → ADD COLUMN importo_lordo_massimale on collaborators
  020_consolidate_occasionale.sql → Remove COCOCO/PIVA tipo_contratto options; consolidate as OCCASIONALE
  021_username.sql               → ADD COLUMN username TEXT UNIQUE on collaborators
  022_expense_descrizione_nullable.sql → ALTER TABLE expense_reimbursements ALTER COLUMN descrizione DROP NOT NULL
  023_workflow_refactor.sql      → (skipped — superseded by 024)
  024_remove_bozza_add_corso.sql → Remove BOZZA state (migrate→IN_ATTESA, update CHECK, DEFAULT IN_ATTESA); ADD COLUMN corso_appartenenza TEXT on compensations

__tests__/                         → 156 tests total (vitest)
  compensation-transitions.test.ts → State machine unit tests for compensations (22 cases)
  expense-transitions.test.ts      → State machine unit tests for reimbursements
  export-utils.test.ts             → Unit tests for CSV/XLSX builders
  cu-batch-parser.test.ts          → Unit tests for CU batch CSV parser + dedup logic (11 cases)
  notification-utils.test.ts       → Unit tests for notification payload builders
  ticket-notification.test.ts      → Unit tests for buildTicketReplyNotification (6 cases)
  api/
    create-user-schema.test.ts     → Unit tests for create-user Zod schema validation (9 cases)
    collaboratore-profile.test.ts  → Unit tests for collaboratore profile PATCH schema (12 cases)
    expense-form.test.ts           → Unit tests for expense form Zod schema (12 cases)
    transition-schema.test.ts      → Unit tests for compensation/expense/mark-paid/approve-all Zod schemas (22 cases)
    username.test.ts               → Unit tests for username generation and validation (23 cases)

e2e/
  rimborsi.spec.ts                 → Playwright UAT: reimbursement full flow (S1–S10, 11 tests)
  export.spec.ts                   → Playwright UAT: export page S1–S8 (CSV/XLSX/mark-paid, 8 tests)
  documents.spec.ts                → Playwright UAT: documents + CU batch S1–S10 (upload, sign flow, 10 tests)
  notifications.spec.ts            → Playwright UAT: in-app notifications S1–S9 (bell, badge, mark-read, 9 tests)
  ticket.spec.ts                   → Playwright UAT: ticket full flow S1–S9 (create, thread, notify, states, 9 tests)
  contenuti.spec.ts                → Playwright UAT: content hub S1–S12 (tabs, CRUD, iframe embed, RBAC, 12 tests)
  impostazioni.spec.ts             → Playwright UAT: settings S1–S11 (community CRUD, member_status, responsabile assignment, 11 tests)
  profilo.spec.ts                  → Playwright UAT: extended profile S1–S11 (avatar, fiscal data, payment overview, 11 tests)
  dashboard.spec.ts                → Playwright UAT: collaboratore dashboard S1–S10 (cards, quick actions, feed, 10 tests)
  contratti.spec.ts                → Playwright UAT: contract templates + onboarding + CoCoCo fields S1–S10 (upload, new province/civico DB fields, full COCOCO onboarding wizard, 10 tests)
  onboarding.spec.ts               → Playwright UAT: onboarding flow S1–S10 (wizard, anagrafica, contract download, proxy redirect, 10 tests)
  collaboratori.spec.ts            → Playwright UAT: collaboratori section S1–S10 (list/filters, detail, inline actions, RBAC, 10 tests)
  dashboard-responsabile.spec.ts   → Playwright UAT: responsabile dashboard S1–S10 (CommCards, pending counters, alert, feed, RBAC, 10 tests)
  dashboard-admin.spec.ts          → Playwright UAT: admin dashboard S1–S10 (KPI cards, community cards, period charts, feed filter, blocks drawer, 10 tests)
  responsabile-actions.spec.ts     → Playwright UAT: responsabile reject_manager + can_publish_announcements S1–S10 (reject comp/rimborso, publish toggle, RBAC, 10 tests)
  notification-settings.spec.ts   → Playwright UAT: notification settings UI S1–S10 (tab notifiche, toggle in-app/email, DB verify, 10 tests)
  documents-features.spec.ts      → Playwright UAT: document features S1/S7/S8/S10/S12/S13/S14 (type badges, collab upload, CONTRATTO uniqueness, DA_FIRMARE, checkbox sign gate, admin delete, 7 tests)
  invite-form.spec.ts              → Playwright UAT: dual-mode invite form S1/S4/S6/S7 (toggle default, disabled gate, quick invite DB verify, full invite CF+community, 4 tests)
  notifications-enhanced.spec.ts  → Playwright UAT: notification bell advanced features S1–S6 (badge persistence, mark-read single, mark-all, dismiss, ticket link, /notifiche filter, 6 tests)
  remove-super-admin.spec.ts       → Playwright UAT: super_admin role removal S1–S4 (admin access, form options, login blocked, DB constraint, 4 tests)
  feedback.spec.ts                 → Playwright UAT: feedback tool S1–S5 (submit no screenshot, submit with screenshot, RBAC, admin list, login autofill, 5 tests)
  fixtures/                        → Real Testbusters .docx templates (COCOCO/OCCASIONALE/PIVA) used as stable e2e fixtures

proxy.ts                         → Auth middleware (active check + password change redirect)
vitest.config.ts                 → Vitest configuration
package.json
next.config.ts
```

## Getting Started

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Run unit tests (106 cases) + Playwright e2e (187 tests across 21 spec files)
npm run build      # Production build (TypeScript check included)
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=           # Transactional email (Resend)
APP_URL=                  # e.g. https://staff-manager.testbusters.it (used in email CTAs)
```

## Storage Setup (Supabase)

Before using file uploads, run the migrations in `supabase/migrations/` via the Supabase SQL Editor in order:

- `001_schema.sql` → full schema
- `002_rls.sql` → RLS policies
- `003_must_change_password.sql` → auth column
- `004_documents_storage.sql` → creates `documents` private bucket + storage policies
- `005_add_titolo_to_documents.sql` → adds `titolo` column to documents table
- `006_tickets_storage.sql` → creates `tickets` private bucket + storage policies
- `007_communities_settings.sql` → adds `is_active` column to communities + admin write policy
- `008_avatars_bucket.sql` → creates public `avatars` bucket + storage policies
- `009_contract_templates.sql` → creates `contracts` bucket + contract_templates table
- `010_onboarding.sql` → onboarding_completed flag + tipo_contratto on collaborators

The `compensations` and `expenses` buckets must also be created (private, 10MB limit, PDF/image types).

## Deploy

Standalone Next.js output. Build and start with:
```bash
npm run build
HOSTNAME=0.0.0.0 node .next/standalone/server.js
```
