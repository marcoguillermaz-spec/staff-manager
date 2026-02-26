# Staff Manager — Project Context

## Overview
Gestionale amministrativo interno per collaboratori COMMUNITY di Testbusters e Peer4Med.
Gestisce: anagrafica, compensi, rimborsi, documenti, ticket, contenuti.

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript, `output: 'standalone'`). Proxy: `proxy.ts` (non `middleware.ts`), export `proxy()`.
- **Styling**: Tailwind CSS puro — NO shadcn/ui, NO component library. Dark mode only.
- **Auth**: Supabase Auth — email/password only. Invite-only, no self-service reset.
- **Database**: Supabase Postgres, RLS reale su ogni tabella. Project: `nyajqcjqmgxctlqighql`
- **Storage**: Supabase Storage, bucket privato, signed URLs (1h TTL via service role).
- **Export**: SheetJS (xlsx) + CSV nativo.
- **Email**: Resend — fire-and-forget, from `noreply@testbusters.it`. 8 template HTML (E1–E8) in `lib/email-templates.ts`. `APP_URL` env controlla i link CTA.
- **Deploy**: Replit. Build: `npm install && npm run build && cp -r .next/static .next/standalone/.next/static`. Run: `HOSTNAME=0.0.0.0 node .next/standalone/server.js`

## Ruoli RBAC
| Ruolo | Accesso |
|---|---|
| `collaboratore` | Solo propri record. Auto-modifica: email, IBAN, tel, indirizzo, tshirt, partita_iva, ha_figli_a_carico, avatar. `uscente_senza_compenso`: solo /documenti. |
| `responsabile_compensi` | Community assegnate. Pre-approvazione + rifiuto diretto (reject_manager) compensi/rimborsi. Pubblica annunci se `can_publish_announcements=true` (default). |
| `responsabile_cittadino` | *(in definizione — accesso TBD)* |
| `responsabile_servizi_individuali` | *(in definizione — accesso TBD)* |
| `amministrazione` | Tutto. Approvazione finale, pagamenti, export, upload documenti, gestione utenti/ruoli/impostazioni. |

Member status: `attivo` | `uscente_con_compenso` (vede richieste in corso, no nuovi doc) | `uscente_senza_compenso` (solo doc storici)

## Workflow Compensi
```
BOZZA → INVIATO → PRE_APPROVATO_RESP → APPROVATO_ADMIN → PAGATO
                ↘ INTEGRAZIONI_RICHIESTE ↗  ↘ RIFIUTATO
```
- Rimborsi: stesso flusso, no BOZZA. Integrazioni: testo ≥20 char + checklist motivi.
- Export "Da pagare": Occasionali e P.IVA separati. Anteprima → CSV/xlsx. Segna pagato singolo/massivo.
- Documenti: Admin carica PDF → DA_FIRMARE → Collaboratore firma → FIRMATO. CU batch: ZIP+CSV, dedup per CF.

## Navigation per ruolo
| Ruolo | Voci sidebar |
|---|---|
| `collaboratore` | Dashboard, Profilo, Compensi, Rimborsi, Documenti, Ticket, Contenuti |
| `responsabile_compensi` | Profilo, Approvazioni, Collaboratori, Documenti, Ticket, Contenuti |
| `responsabile_cittadino` | *(da definire)* |
| `responsabile_servizi_individuali` | *(da definire)* |
| `amministrazione` | Coda lavoro, Collaboratori, Export, Documenti, Ticket, Contenuti, Impostazioni |

## Known Patterns
- **canTransition visibility**: chiamata senza `note` → skip requiresNote check (UI visibility). Validazione nota solo quando `note !== undefined` (path API).
- **Invite flow**: `admin.auth.admin.createUser({ email_confirm: true })` + `must_change_password: true`. Mostrare email+password nell'UI come backup in caso di mancato recapito Resend.
- **Primo accesso**: proxy controlla `must_change_password` → `/change-password` → `supabase.auth.updateUser` + POST `clear-force-change`.
- **Proxy redirect + cookies**: usare `createRedirect(url, supabaseResponse)` che copia i cookie Supabase — altrimenti la sessione si perde nel redirect.
- **RLS infinite recursion**: `collab_communities_own_read` NON deve fare subquery diretta su `collaborators` → usare `get_my_collaborator_id()` (security definer).
- **RLS helpers**: `get_my_role()`, `is_active_user()`, `can_manage_community(id)`, `get_my_collaborator_id()` — tutti `SECURITY DEFINER`.
- **Anonimato timeline**: salvare `role_label` (non `user_id`) in `compensation_history` / `expense_history`.
- **Playwright timing form→DB**: `Promise.all([page.waitForResponse(...), async () => { fill; click }()])` prima di verificare il DB — senza, la verifica corre prima del completamento API.
- **Ticket service role**: nelle API route ticket usare sempre `serviceClient` per fetch + insert. Access control esplicito nel codice, non delegato a RLS lato SSR.
- **Supabase SELECT colonne**: TypeScript non valida i nomi colonna nel `.select()`. Colonna inesistente → `fetchError` silenzioso → 404. Verificare nomi reali con `information_schema.columns` prima di usare nuovi campi.

## Coding Conventions
- UI: **italiano**. Codice/commit: **inglese** (conventional commits).
- Status/enum: `MAIUSCOLO_SNAKE`. ZodError: `.issues` (non `.errors`).
- Ogni route API: verificare ruolo chiamante prima di qualsiasi operazione.

## Project Structure
Struttura codebase autodocumentante — usare Glob/Read/Grep per esplorare.
Per la storia delle migration: `docs/migrations-log.md`.

## Documenti di riferimento
- **Specifica prodotto**: [`docs/requirements.md`](docs/requirements.md) — leggere la sezione pertinente in Fase 1.
- **Stato avanzamento**: [`docs/implementation-checklist.md`](docs/implementation-checklist.md) — leggere prima di ogni blocco, aggiornare in Fase 8.
- **Backlog tecnico**: [`docs/refactoring-backlog.md`](docs/refactoring-backlog.md) — verificare in Fase 1, aggiornare in Fase 8.
- **Migration history**: [`docs/migrations-log.md`](docs/migrations-log.md) — aggiornare in Fase 2 dopo ogni migration.

## Workflow Requirements
Processo di sviluppo obbligatorio: vedi [`.claude/rules/pipeline.md`](.claude/rules/pipeline.md).

## Phase Plan
Stato dettagliato in [`docs/implementation-checklist.md`](docs/implementation-checklist.md).

- **Phase 1** ✅ COMPLETATA: Auth, Invite utenti, Profilo, Compensi, Rimborsi, Coda lavoro, Export
- **Phase 2** ✅ COMPLETATA: Documenti + CU batch, Notifiche in-app, Ticket, Contenuti
- **Phase 3** ✅ COMPLETATA: Impostazioni avanzate, Template contratti + Onboarding, Dashboard collaboratore, Profilo esteso, Onboarding flow, Dashboard responsabile, Dashboard admin, Sezione Collaboratori, Responsabile reject + publish permission, Notifiche email configurabili, Rimozione super_admin, Feedback tool
- **Revisione requisiti** 🔄 IN CORSO: Blocco 1 (roles rename) ✅ — altri blocchi da definire
