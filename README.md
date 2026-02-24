# Staff Manager

Internal portal for managing collaborators, compensation/reimbursement approvals, documents, and support tickets. Role-based access control (email/password, invite-only) via Supabase Auth.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript, `output: 'standalone'`)
- **Styling**: Tailwind CSS — no component libraries
- **Auth**: Supabase Auth (email/password, invite-only, forced password change on first login)
- **Database**: Supabase Postgres with Row Level Security
- **Testing**: Vitest + @vitest/coverage-v8

## Roles

| Role | Access |
|------|--------|
| `collaboratore` | Own profile, compensation requests, reimbursements, documents, support tickets |
| `responsabile` | Approve compensations/reimbursements for assigned communities; own profile, documents, and support tickets |
| `amministrazione` | Full approval queue, payments, user management, exports |
| `super_admin` | Same as amministrazione + settings |

## Compensation Flow (State Machine)

```
BOZZA → INVIATO → PRE_APPROVATO_RESP → APPROVATO_ADMIN → PAGATO
                ↘ INTEGRAZIONI_RICHIESTE ↗
                                        ↘ RIFIUTATO
```

| Action | From | To | Role |
|--------|------|----|------|
| submit | BOZZA | INVIATO | collaboratore |
| withdraw | INVIATO | BOZZA | collaboratore |
| resubmit | INTEGRAZIONI_RICHIESTE | INVIATO | collaboratore |
| approve_manager | INVIATO / INTEGRAZIONI_RICHIESTE | PRE_APPROVATO_RESP | responsabile |
| request_integration | INVIATO | INTEGRAZIONI_RICHIESTE | responsabile |
| approve_admin | PRE_APPROVATO_RESP | APPROVATO_ADMIN | amministrazione / super_admin |
| reject | PRE_APPROVATO_RESP | RIFIUTATO | amministrazione / super_admin |
| mark_paid | APPROVATO_ADMIN | PAGATO | amministrazione / super_admin |

## Reimbursement Flow (State Machine)

No BOZZA state — reimbursements are submitted directly as INVIATO.

```
INVIATO → PRE_APPROVATO_RESP → APPROVATO_ADMIN → PAGATO
        ↘ INTEGRAZIONI_RICHIESTE ↗
                                ↘ RIFIUTATO
```

| Action | From | To | Role |
|--------|------|----|------|
| resubmit | INTEGRAZIONI_RICHIESTE | INVIATO | collaboratore |
| approve_manager | INVIATO / INTEGRAZIONI_RICHIESTE | PRE_APPROVATO_RESP | responsabile |
| request_integration | INVIATO | INTEGRAZIONI_RICHIESTE | responsabile |
| approve_admin | PRE_APPROVATO_RESP | APPROVATO_ADMIN | amministrazione / super_admin |
| reject | PRE_APPROVATO_RESP | RIFIUTATO | amministrazione / super_admin |
| mark_paid | APPROVATO_ADMIN | PAGATO | amministrazione / super_admin |

## Project Structure

```
app/
  (app)/
    page.tsx                     → Dashboard collaboratore (cards, quick actions, cosa mi manca, feed) + responsabile (CommCard per community, cosa devo fare, feed pending) + admin/super_admin (KPI, community cards, urgenti, feed filtrable, period metrics, blocks drawer)
    layout.tsx                   → Protected layout (auth guard + Sidebar)
    profilo/page.tsx             → Profile editor (avatar, fiscal data, editable IBAN/phone/address/tshirt)
    impostazioni/page.tsx        → Settings: 4-tab server component — Users (create), Community (CRUD + responsabile assignment), Collaborators (member_status), Contratti (template upload)
    compensi/page.tsx            → Collaboratore: list own compensations
    compensi/nuova/page.tsx      → Compensation creation wizard (3 steps)
    compensi/[id]/page.tsx       → Compensation detail + timeline + actions
    rimborsi/page.tsx            → Collaboratore: list own reimbursements
    rimborsi/nuova/page.tsx      → Reimbursement creation form (single step)
    rimborsi/[id]/page.tsx       → Reimbursement detail + timeline + actions
    approvazioni/page.tsx        → Responsabile: pending queue (?tab=compensi|rimborsi)
    collaboratori/page.tsx       → Responsabile + admin: paginated list (20/page) with URL-driven filters (all/doc-da-firmare/stallo)
    collaboratori/[id]/page.tsx  → Collaborator detail: anagrafica + compensi/rimborsi/documenti + inline pre-approva/integrazioni
    coda/page.tsx                → Admin: pre-approved + approved queue (?tab=compensi|rimborsi)
    export/page.tsx              → Admin: export approved records as CSV/XLSX + bulk mark-paid (?tab=occasionali|piva|rimborsi)
    documenti/page.tsx           → Admin: 3 tabs (list/upload/cu-batch). Collaboratore: list only (?tab=)
    documenti/[id]/page.tsx      → Document detail with signed URL + sign flow for collaboratore
    ticket/page.tsx              → Ticket list (collaboratore: own; admin/responsabile: all + Collaboratore column)
    ticket/nuova/page.tsx        → Create new ticket form
    ticket/[id]/page.tsx         → Ticket detail: message thread + reply form + status change buttons
    contenuti/page.tsx           → Content hub: 4 URL-based tabs (bacheca/agevolazioni/guide/eventi), per-tab fetch
  api/
    profile/route.ts             → PATCH own profile fields (nome, cognome, codice_fiscale, data_nascita, luogo_nascita, provincia_nascita, comune, provincia_residenza, telefono, indirizzo, civico_residenza, IBAN, tshirt, partita_iva, ha_figli_a_carico)
    profile/avatar/route.ts      → POST upload profile photo → avatars bucket
    auth/change-password/        → POST forced password change
    auth/clear-force-change/     → POST clear must_change_password flag
    admin/create-user/           → POST invite new user (email + role + tipo_contratto required) + create collaborators record, onboarding_completed=false
    admin/communities/           → GET list communities (?all=1 returns inactive too) + POST create
    admin/communities/[id]/      → PATCH rename + toggle is_active
    admin/responsabili/[userId]/communities/ → PUT replace community assignments for a responsabile
    admin/members/[id]/status/   → PATCH update member_status for a collaboratore
    admin/members/[id]/data-ingresso/ → PATCH update data_ingresso (admin only)
    admin/contract-templates/    → GET list templates + POST upload/replace .docx per type (OCCASIONALE/COCOCO/PIVA)
    admin/blocks/clear-flag/     → POST clear must_change_password flag for a user (admin/super_admin only)
    compensations/route.ts       → GET (list, role-filtered) + POST (create)
    compensations/[id]/route.ts  → GET (detail + history + attachments)
    compensations/[id]/transition/route.ts → POST (state machine transition)
    compensations/[id]/attachments/route.ts → POST (register uploaded file)
    compensations/communities/route.ts → GET (collaboratore's communities)
    expenses/route.ts            → GET (list) + POST (create, always INVIATO)
    expenses/[id]/route.ts       → GET (detail + history + attachments)
    expenses/[id]/transition/route.ts → POST (reimbursement state machine)
    expenses/[id]/attachments/route.ts → POST (register uploaded file)
    export/mark-paid/route.ts    → POST (bulk mark APPROVATO_ADMIN → PAGATO + history, admin only)
    documents/route.ts           → GET (list, RLS-filtered) + POST (create, FormData, service-role upload)
    documents/[id]/route.ts      → GET (detail + signed URL generation)
    documents/[id]/sign/route.ts → POST (collaboratore uploads signed PDF, FormData, service-role upload)
    documents/cu-batch/route.ts  → POST (ZIP+CSV batch import, dedup by collaborator+anno, notifications)
    notifications/route.ts       → GET (list + unread count) + PATCH (mark all read)
    tickets/route.ts             → GET (list, role-filtered + enriched with creator name) + POST (create)
    tickets/[id]/route.ts        → GET (detail + messages + signed attachment URLs + author role labels)
    tickets/[id]/messages/route.ts → POST (reply FormData + optional file, service role, notification on reply)
    tickets/[id]/status/route.ts → PATCH (change status APERTO/IN_LAVORAZIONE/CHIUSO, admin/responsabile)
    announcements/route.ts       → GET (pinned first) + POST (admin/super_admin/responsabile)
    announcements/[id]/route.ts  → PATCH + DELETE
    benefits/route.ts            → GET + POST (admin/super_admin)
    benefits/[id]/route.ts       → PATCH + DELETE
    resources/route.ts           → GET + POST with tag[] (admin/super_admin)
    resources/[id]/route.ts      → PATCH + DELETE
    events/route.ts              → GET (ordered by start_datetime asc) + POST (admin/super_admin)
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
    CreateUserForm.tsx            → Create user form (email + role + tipo_contratto required; anagrafica optional pre-fill)
    CommunityManager.tsx          → Community CRUD (create/rename/toggle active) + responsabile→community assignment
    MemberStatusManager.tsx       → Collaborator list with member_status dropdown + data_ingresso inline edit
    ContractTemplateManager.tsx   → Admin: upload/replace .docx templates per type (OCCASIONALE/COCOCO/PIVA) + placeholders reference (including 13 CoCoCo-specific vars)
  Sidebar.tsx                    → Role-based navigation sidebar (hosts NotificationBell)
  NotificationBell.tsx           → Bell icon + unread badge + dropdown (30s polling, mark-read on open)
  ProfileForm.tsx                → Profile edit form (avatar, fiscal data, guide collassabili)
  compensation/
    PaymentOverview.tsx          → Server component: payments by year (PAGATO) + pending balance
  compensation/
    StatusBadge.tsx              → Pill badge for CompensationStatus | ExpenseStatus
    CompensationWizard.tsx       → 3-step creation wizard (client)
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
    DocumentList.tsx             → Documents table with stato_firma badge and detail link
    DocumentUploadForm.tsx       → Admin upload form (FormData → API, service-role storage)
    DocumentSignFlow.tsx         → Collaboratore: download original + upload signed PDF
    CUBatchUpload.tsx            → Admin: ZIP + CSV + year batch import with success/duplicate/error detail
  ticket/
    TicketStatusBadge.tsx        → Pill badge for ticket status (APERTO=green, IN_LAVORAZIONE=yellow, CHIUSO=gray)
    TicketList.tsx               → Ticket table with status/priority filters + Collaboratore column for admin
    TicketForm.tsx               → Create form (fixed category dropdown, oggetto, optional initial message)
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
  nav.ts                         → NAV_BY_ROLE config
  compensation-transitions.ts    → Pure state machine: canTransition, applyTransition (8 actions)
  expense-transitions.ts         → Pure state machine: canExpenseTransition, applyExpenseTransition (6 actions)
  export-utils.ts                → Pure functions: buildCSV, buildXLSXWorkbook, ExportItem type
  documents-storage.ts           → buildStoragePath, getSignedUrl, getDocumentUrls (1h TTL, service role)
  notification-utils.ts          → buildCompensationNotification, buildExpenseNotification, buildTicketReplyNotification (pure helpers)

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

__tests__/
  compensation-transitions.test.ts → State machine unit tests for compensations (14 cases)
  expense-transitions.test.ts      → State machine unit tests for reimbursements (31 cases)
  export-utils.test.ts             → Unit tests for CSV/XLSX builders (7 cases)
  cu-batch-parser.test.ts          → Unit tests for CU batch CSV parser + dedup logic (11 cases)
  notification-utils.test.ts       → Unit tests for notification payload builders (12 cases)
  ticket-notification.test.ts      → Unit tests for buildTicketReplyNotification (6 cases)

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
npm test           # Run unit tests (81 cases) + Playwright e2e (141 tests across 14 spec files)
npm run build      # Production build (TypeScript check included)
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
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
