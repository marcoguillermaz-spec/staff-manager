# Staff Manager — Project Context

## Overview
Internal admin portal for managing collaborators across Testbusters and Peer4Med communities.
Handles: personal profiles, compensations, reimbursements, documents, support tickets, content.

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript, `output: 'standalone'`). Auth proxy: `proxy.ts` (NOT `middleware.ts`), exported as `proxy()`.
- **Styling**: Plain Tailwind CSS — NO shadcn/ui, NO component library. Dark mode only.
- **Auth**: Supabase Auth — email/password only. Invite-only, no self-service password reset.
- **Database**: Supabase Postgres, real RLS on every table. Project ID: `nyajqcjqmgxctlqighql`
- **Storage**: Supabase Storage, private buckets, signed URLs (1h TTL via service role).
- **Export**: SheetJS (xlsx) + native CSV.
- **Email**: Resend — fire-and-forget, from `noreply@testbusters.it`. 8 HTML templates (E1–E8) in `lib/email-templates.ts`. `APP_URL` env var controls all CTA links.
- **Deploy**: Replit. Build: `npm install && npm run build && cp -r .next/static .next/standalone/.next/static`. Run: `HOSTNAME=0.0.0.0 node .next/standalone/server.js`

## RBAC Roles
| Role | Access |
|---|---|
| `collaboratore` | Own records only. Self-editable: email, IBAN, phone, address, tshirt, partita_iva, ha_figli_a_carico, avatar. `uscente_senza_compenso`: read-only access to /documenti only. |
| `responsabile_compensi` | Assigned communities. Pre-approval + direct rejection (reject_manager) of compensations/reimbursements. Can publish announcements if `can_publish_announcements=true` (default). |
| `responsabile_cittadino` | *(under definition — access TBD)* |
| `responsabile_servizi_individuali` | *(under definition — access TBD)* |
| `amministrazione` | Full access. Final approval, payments, export, document upload, user/role/settings management. |

Member status: `attivo` | `uscente_con_compenso` (can view ongoing requests, no new docs) | `uscente_senza_compenso` (historical docs only)

## Compensation Workflow
```
BOZZA → INVIATO → PRE_APPROVATO_RESP → APPROVATO_ADMIN → PAGATO
                ↘ INTEGRAZIONI_RICHIESTE ↗  ↘ RIFIUTATO
```
- Reimbursements: same flow, no BOZZA state. Integration requests require text ≥20 chars + reason checklist.
- Export "Da pagare": Occasionali and P.IVA tabs separated. Preview → CSV/xlsx. Mark paid individually or in bulk.
- Documents: Admin uploads PDF → DA_FIRMARE → Collaborator signs → FIRMATO. CU batch: ZIP+CSV, dedup by tax code.

## Navigation by Role
| Role | Sidebar items |
|---|---|
| `collaboratore` | Dashboard, Profilo, Compensi, Rimborsi, Documenti, Ticket, Contenuti |
| `responsabile_compensi` | Profilo, Approvazioni, Collaboratori, Documenti, Ticket, Contenuti |
| `responsabile_cittadino` | *(to be defined)* |
| `responsabile_servizi_individuali` | *(to be defined)* |
| `amministrazione` | Coda lavoro, Collaboratori, Export, Documenti, Ticket, Contenuti, Impostazioni |

## Known Patterns
- **canTransition visibility**: called without `note` → skip requiresNote check (UI visibility only). Note validation only runs when `note !== undefined` (API path). Without this, "Richiedi integrazioni" button never renders.
- **Invite flow**: `admin.auth.admin.createUser({ email_confirm: true })` + `must_change_password: true`. Always display email+password in the UI as backup in case Resend delivery fails.
- **First login**: proxy checks `must_change_password` → redirect to `/change-password` → `supabase.auth.updateUser` + POST `clear-force-change`.
- **Proxy redirect + cookies**: use `createRedirect(url, supabaseResponse)` which copies Supabase cookies — otherwise the session is lost on redirect.
- **RLS infinite recursion**: `collab_communities_own_read` must NOT make a direct subquery on `collaborators` → use `get_my_collaborator_id()` (security definer).
- **RLS helpers**: `get_my_role()`, `is_active_user()`, `can_manage_community(id)`, `get_my_collaborator_id()` — all `SECURITY DEFINER`.
- **Timeline anonymity**: store `role_label` (not `user_id`) in `compensation_history` / `expense_history`.
- **Playwright form→DB timing**: use `Promise.all([page.waitForResponse(...), async () => { fill; click }()])` before checking DB — without this, DB assertion runs before the API completes, causing false negatives even when DOM already shows the result.
- **Ticket service role**: always use `serviceClient` (service role) for fetch + insert in ticket API routes. Explicit access control in code — do NOT delegate to SSR-side RLS.
- **Supabase SELECT columns**: TypeScript does not validate column names in `.select()`. Non-existent column → silent `fetchError` → 404. Always verify real column names via `information_schema.columns` before using new fields.

## Coding Conventions
- Product UI language: **Italian**. Code/commits: **English** (conventional commits).
- Status/enum values: `UPPER_SNAKE_CASE`. ZodError: use `.issues` (not `.errors`).
- Every API route: verify caller role before any operation.

## Project Structure
Codebase is self-documenting — use Glob/Read/Grep to explore.
For migration history: see `docs/migrations-log.md`.

## Reference Documents
- **Product spec**: [`docs/requirements.md`](docs/requirements.md) — read the relevant section in Phase 1.
- **Progress tracker**: [`docs/implementation-checklist.md`](docs/implementation-checklist.md) — read before each block, update in Phase 8.
- **Tech debt backlog**: [`docs/refactoring-backlog.md`](docs/refactoring-backlog.md) — check in Phase 1, update in Phase 8.
- **Migration history**: [`docs/migrations-log.md`](docs/migrations-log.md) — update in Phase 2 after every migration.

## Workflow Requirements
Mandatory development process: see [`.claude/rules/pipeline.md`](.claude/rules/pipeline.md).

## Phase Plan
Full status in [`docs/implementation-checklist.md`](docs/implementation-checklist.md).

- **Phase 1** ✅ DONE: Auth, User invite, Profile, Compensations, Reimbursements, Work queue, Export
- **Phase 2** ✅ DONE: Documents + CU batch, In-app notifications, Tickets, Content hub
- **Phase 3** ✅ DONE: Advanced settings, Contract templates + Onboarding, Collaborator dashboard, Extended profile, Onboarding flow, Manager dashboard, Admin dashboard, Collaborators section, Manager reject + publish permission, Configurable email notifications, Remove super_admin, Feedback tool
- **Requirements revision** 🔄 IN PROGRESS: Block 1 (roles rename) ✅ — remaining blocks to be defined
