# Staff Manager — Project Context

## Overview
Gestionale amministrativo interno per collaboratori COMMUNITY di Testbusters e Peer4Med.
Gestisce: anagrafica, compensi, rimborsi, documenti, ticket, contenuti.

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript, `output: 'standalone'`). Proxy: `proxy.ts` (non `middleware.ts`), export `proxy()`.
- **Styling**: Tailwind CSS puro — NO shadcn/ui, NO component library. Dark mode only.
- **Auth**: Supabase Auth — email/password only. Invite-only, no self-service reset.
- **Database**: Supabase Postgres, RLS reale su ogni tabella. Project: `nyajqcjqmgxctlqighql`
- **Storage**: Supabase Storage, bucket privato, signed URLs
- **Export**: SheetJS (xlsx) + CSV nativo
- **Email**: Resend — notifiche transazionali fire-and-forget, from `noreply@testbusters.it`. 7 template HTML (E1–E7) in `lib/email-templates.ts`.
- **Deploy**: Replit. Build: `npm install && npm run build && cp -r .next/static .next/standalone/.next/static`. Run: `HOSTNAME=0.0.0.0 node .next/standalone/server.js`

## Ruoli RBAC
| Ruolo | Accesso |
|---|---|
| `collaboratore` | Solo propri record. Auto-modifica: email, IBAN, tel, indirizzo, tshirt, partita_iva, ha_figli_a_carico, avatar. uscente_senza_compenso: solo /documenti. |
| `responsabile` | Community assegnate. Pre-approvazione + rifiuto diretto (reject_manager) compensi/rimborsi. Pubblica annunci se can_publish_announcements=true (default). |
| `amministrazione` | Tutto. Approvazione finale, pagamenti, export, upload documenti |
| `super_admin` | Come amministrazione + gestione utenti/ruoli/impostazioni |

Member status: `attivo` | `uscente_con_compenso` (vede richieste in corso, no nuovi doc) | `uscente_senza_compenso` (solo doc storici)

## Workflow Compensi
```
BOZZA → INVIATO → PRE_APPROVATO_RESP → APPROVATO_ADMIN → PAGATO
                ↘ INTEGRAZIONI_RICHIESTE ↗  ↘ RIFIUTATO
```
- Rimborsi: stesso flusso, no BOZZA. Integrazioni: testo ≥20 char + checklist motivi.
- Export "Da pagare": Occasionali e P.IVA separati. Anteprima → CSV/xlsx. Segna pagato singolo/massivo.
- Documenti: Admin carica PDF → DA_FIRMARE → Collaboratore firma → FIRMATO. CU batch: ZIP+CSV, dedup per CF.

## Project Structure
```
app/
  (app)/
    layout.tsx                   → Server auth guard + Sidebar
    page.tsx                     → Dashboard collaboratore (3 card, azioni rapide, cosa mi manca, feed 10 item)
    impostazioni/page.tsx        → 5 tab server component: Utenti (crea), Community (CRUD+responsabili), Collaboratori (member_status), Contratti (template upload), Notifiche (toggle in-app+email per evento)
    compensi/page.tsx            → Collaboratore: lista propri compensi
    compensi/nuova/page.tsx      → Wizard creazione compenso (3 step)
    compensi/[id]/page.tsx       → Dettaglio + timeline + azioni
    rimborsi/page.tsx            → Collaboratore: lista propri rimborsi
    rimborsi/nuova/page.tsx      → Form single-step creazione rimborso
    rimborsi/[id]/page.tsx       → Dettaglio + timeline + azioni rimborso
    approvazioni/page.tsx        → Responsabile: tab compensi/rimborsi pending (?tab=)
    collaboratori/page.tsx       → Responsabile + admin: lista paginata 20/pag, filtri URL (?filter=all|documenti|stallo&page=N), service role
    collaboratori/[id]/page.tsx  → Dettaglio collaboratore: anagrafica + compensi/rimborsi/documenti, access guard community
    coda/page.tsx                → Admin: tab compensi/rimborsi PRE_APPROVATO+APPROVATO (?tab=)
    export/page.tsx              → Admin: export APPROVATO_ADMIN in CSV/XLSX + bulk mark-paid (?tab=occasionali|piva|rimborsi)
    documenti/page.tsx           → Admin: 3 tab (lista/carica/cu-batch). Collaboratore: solo lista (?tab=)
    documenti/[id]/page.tsx      → Dettaglio documento + signed URL + DocumentSignFlow
    ticket/page.tsx              → Lista ticket (collaboratore: propri; admin/responsabile: tutti + colonna Collaboratore)
    ticket/nuova/page.tsx        → Form creazione nuovo ticket
    ticket/[id]/page.tsx         → Dettaglio ticket: thread messaggi + form risposta + cambio stato
    contenuti/page.tsx           → 4 tab URL-based (?tab=bacheca|agevolazioni|guide|eventi), fetch per tab, RBAC canWrite
    notifiche/page.tsx           → Pagina notifiche completa (Suspense wrapper → NotificationPageClient)
  login/page.tsx             → Email/password only
  change-password/page.tsx   → Cambio password obbligatorio primo accesso
  onboarding/page.tsx        → Wizard standalone post-login: prefill da collaborators, redirect a / se già completato
  pending/page.tsx           → Utente autenticato ma non ancora attivato
  api/
    auth/clear-force-change/ → POST: azzera must_change_password (service role)
    admin/create-user/       → POST: crea auth user + profilo (service role), tipo_contratto obbligatorio, onboarding_completed=false, crea collaborators per collaboratore+responsabile
    admin/communities/       → GET: lista comunità (?all=1 admin: include inattive) + POST: crea
    admin/communities/[id]/  → PATCH: rinomina + toggle is_active
    admin/responsabili/[userId]/communities/ → PUT: sostituisce assegnazioni community responsabile
    admin/responsabili/[userId]/publish-permission/ → PATCH: toggle can_publish_announcements per responsabile
    admin/members/[id]/status/ → PATCH: aggiorna member_status collaboratore
    admin/members/[id]/data-ingresso/ → PATCH: aggiorna data_ingresso (admin/super_admin)
    admin/contract-templates/ → GET: lista template + POST: upload/replace .docx per tipo (OCCASIONALE/COCOCO/PIVA)
    admin/blocks/clear-flag/  → POST: azzera must_change_password (service role, admin/super_admin)
    admin/notification-settings/ → GET: lista 15 settings | PATCH: toggle inapp_enabled/email_enabled per event_key×recipient_role (solo admin)
    profile/route.ts         → PATCH campi profilo self-edit (nome, cognome, codice_fiscale, data_nascita, luogo_nascita, comune, telefono, indirizzo, iban, tshirt, partita_iva, ha_figli_a_carico)
    profile/avatar/route.ts  → POST upload avatar → bucket `avatars` (service role) → aggiorna foto_profilo_url
    compensations/route.ts   → GET (lista role-filtered) + POST (crea)
    compensations/[id]/route.ts → GET dettaglio + storia + allegati
    compensations/[id]/transition/route.ts → POST state machine (service role)
    compensations/[id]/attachments/route.ts → POST registra file caricato
    compensations/communities/route.ts → GET community del collaboratore
    expenses/route.ts        → GET (lista) + POST (crea, sempre INVIATO)
    expenses/[id]/route.ts   → GET dettaglio + storia + allegati rimborso
    expenses/[id]/transition/route.ts → POST state machine rimborsi (service role)
    expenses/[id]/attachments/route.ts → POST registra allegato rimborso
    export/mark-paid/route.ts    → POST bulk APPROVATO_ADMIN→PAGATO + history (compensations|expenses)
    documents/route.ts           → GET lista (RLS) + POST crea documento (FormData, upload service role)
    documents/[id]/route.ts      → GET dettaglio + genera signed URL
    documents/[id]/sign/route.ts → POST collaboratore carica firmato (FormData, upload service role)
    documents/cu-batch/route.ts  → POST ZIP+CSV, match collaboratore, dedup, upload, notifiche batch
    notifications/route.ts       → GET lista paginata (?page/limit/unread_only) + conteggio unread reale | PATCH mark-all-read
    notifications/[id]/route.ts  → PATCH (mark singola letta) + DELETE (dismiss)
    tickets/route.ts             → GET (lista role-filtered, enrichita con nome collaboratore per admin) + POST (crea)
    tickets/[id]/route.ts        → GET (dettaglio + messaggi + signed URL allegati + role labels autori)
    tickets/[id]/messages/route.ts → POST messaggio + allegato opzionale (FormData, service role, notifica reply)
    tickets/[id]/status/route.ts → PATCH cambio stato APERTO/IN_LAVORAZIONE/CHIUSO (admin/responsabile)
    announcements/route.ts       → GET (pinned desc → data desc) + POST (admin/super_admin/responsabile)
    announcements/[id]/route.ts  → PATCH + DELETE (admin/super_admin/responsabile)
    benefits/route.ts            → GET + POST (admin/super_admin)
    benefits/[id]/route.ts       → PATCH + DELETE (admin/super_admin)
    resources/route.ts           → GET + POST, tag come string[] (admin/super_admin)
    resources/[id]/route.ts      → PATCH + DELETE (admin/super_admin)
    events/route.ts              → GET (start_datetime asc) + POST (admin/super_admin)
    events/[id]/route.ts         → PATCH + DELETE (admin/super_admin)
    onboarding/complete/route.ts → POST: salva anagrafica collaborators (upsert), genera contratto docxtemplater → bucket contracts, onboarding_completed=true

components/
  onboarding/
    OnboardingWizard.tsx     → Wizard 2-step client: step 1 = dati anagrafici (tutti required, isPiva mostra P.IVA), step 2 = genera contratto + download; router.push('/') al completamento
  impostazioni/
    CreateUserForm.tsx        → Form crea utente con toggle dual-mode: "Invito rapido" (email + nome + cognome + tipo_contratto required) e "Invito completo" (anagrafica opzionale as-is). CTA "Conferma".
    CommunityManager.tsx      → CRUD community + assegnazione responsabile→community (checkbox multi-select)
    MemberStatusManager.tsx   → Lista collaboratori + dropdown member_status + inline data_ingresso
    ContractTemplateManager.tsx → Admin: upload/replace .docx per tipo (OCCASIONALE/COCOCO/PIVA) + sezione segnaposto
    NotificationSettingsManager.tsx → Admin: griglia toggle in-app+email per ogni evento×ruolo (15 righe, update ottimistico + revert on error)
  ProfileForm.tsx            → Form profilo: tutti i campi anagrafici editabili (tranne email/data_ingresso), avatar, dati fiscali, guide collassabili
  Sidebar.tsx                → Navigazione per ruolo, gestisce sign-out + ospita NotificationBell + avatar
  NotificationBell.tsx       → Bell icon + badge unread + dropdown notifiche (polling 30s, mark-read singola al click, segna-tutte esplicito, dismiss ×, loading/error state, avviso troncata, link Vedi tutte)
  notifications/
    NotificationPageClient.tsx → Pagina /notifiche completa: filtro "Solo non lette", paginazione 20/pag, mark-read/dismiss per riga
  compensation/
    StatusBadge.tsx          → Pill colorata per stato (CompensationStatus | ExpenseStatus)
    PaymentOverview.tsx      → Server component: breakdown pagamenti per anno (PAGATO) + in attesa
    CompensationWizard.tsx   → Wizard 3 step (client)
    CompensationList.tsx     → Tabella con filtro stato
    CompensationDetail.tsx   → Scheda read-only
    Timeline.tsx             → Lista eventi storia (accetta HistoryEvent[])
    ActionPanel.tsx          → Bottoni azione + modal integrazioni/pagamento
  expense/
    ExpenseList.tsx          → Tabella rimborsi con filtro stato
    ExpenseDetail.tsx        → Scheda read-only rimborso
    ExpenseActionPanel.tsx   → Bottoni azione rimborso + modal integrazioni/pagamento
    ExpenseForm.tsx          → Form single-step (categoria, data, importo, descrizione + file)
  export/
    ExportSection.tsx        → Client: tab bar, bottoni CSV/XLSX/mark-paid, modal riferimento pagamento
    ExportTable.tsx          → Tabella con checkbox (riga + select-all), colonne per tab
  documents/
    DocumentList.tsx         → Documenti raggruppati per macro-tipo (CONTRATTO/RICEVUTA/CU); badge tipo violet/teal/blue; colonna collab (admin); delete button per admin su CONTRATTO
    DocumentUploadForm.tsx   → Biforcata admin/non-admin: admin → selector collaboratore + optgroup tipo + toggle firma (solo CONTRATTO); non-admin → form semplificata, stato_firma forzato NON_RICHIESTO server-side
    DocumentSignFlow.tsx     → Collaboratore: download originale + checkbox conferma obbligatoria + upload firmato → POST /api/documents/[id]/sign
    DocumentDeleteButton.tsx → Client component: elimina CONTRATTO (admin only) via DELETE /api/documents/[id] + redirect /documenti
    CUBatchUpload.tsx        → Admin: ZIP + CSV + anno → POST /api/documents/cu-batch, mostra success/dup/errori
  ticket/
    TicketStatusBadge.tsx    → Pill badge stato (APERTO=text-green-300, IN_LAVORAZIONE=text-yellow-300, CHIUSO=text-gray-400)
    TicketList.tsx           → Tabella con filtro stato/priorità, colonna Collaboratore per admin/responsabile
    TicketForm.tsx           → Form creazione (categoria dropdown fissa, oggetto, messaggio iniziale opzionale)
    TicketThread.tsx         → Thread messaggi server-side con label "Tu"/ruolo, banner chiuso, signed URL allegati
    TicketMessageForm.tsx    → Form risposta (textarea + file) + bottoni cambio stato (admin/responsabile)
  admin/
    types.ts                 → Tipi TypeScript condivisi dashboard admin (AdminDashboardData, AdminKPIs, AdminBlockItem, …)
    BlocksDrawer.tsx         → Drawer laterale situazioni di blocco, raggruppate per tipo, con azioni dirette
    AdminDashboard.tsx       → Dashboard admin client (KPI card, community cards, urgenti, feed filtrable, Recharts period metrics, blocks drawer)
  responsabile/
    CollaboratoreDetail.tsx  → Client: anagrafica + sezioni compensi/rimborsi/documenti con Pre-approva/Integrazioni inline
  contenuti/
    AnnouncementBoard.tsx    → CRUD annunci inline (pin, community_id, ordinamento pinned desc → data desc)
    BenefitList.tsx          → CRUD benefit con badge scadenza (Attivo/In scadenza/Scaduto), codice sconto
    ResourceList.tsx         → CRUD risorse con tag comma→string[], chip visualizzazione, link + file_url
    EventList.tsx            → CRUD eventi con datetime, location, Luma URL + iframe embed inline

lib/
  supabase/client.ts / server.ts
  types.ts                   → Role, enums, labels, Compensation/Expense/HistoryEvent interfaces
  nav.ts                     → NAV_BY_ROLE
  compensation-transitions.ts → State machine pura: canTransition, applyTransition (9 azioni, incl. reject_manager)
  expense-transitions.ts     → State machine pura: canExpenseTransition, applyExpenseTransition (7 azioni, incl. reject_manager)
  export-utils.ts            → Tipi ExportItem/ExportTab, buildCSV (BOM+;), buildXLSXWorkbook (SheetJS)
  documents-storage.ts       → buildStoragePath, getSignedUrl, getDocumentUrls (signed URL 1h via service role)
  notification-utils.ts      → helper puri per payload notifiche (collaboratore + responsabile side, 8 builder)
  notification-helpers.ts    → DB helpers: getNotificationSettings (→ SettingsMap), getCollaboratorInfo, getResponsabiliForCommunity/Collaborator/User
  email.ts                   → Resend wrapper fire-and-forget (from noreply@testbusters.it)
  email-templates.ts         → 8 template HTML brandizzati E1–E8 (logo Testbusters + footer legale). APP_URL (default: http://localhost:3000) controlla tutti i link CTA — impostare in produzione via env.

supabase/migrations/
  001_schema.sql  002_rls.sql  003_must_change_password.sql
  004_documents_storage.sql  → Bucket privato `documents` + storage policies
  005_add_titolo_to_documents.sql → ALTER TABLE documents ADD COLUMN titolo text (backfill automatico)
  006_tickets_storage.sql    → Bucket privato `tickets` + storage policies (10MB, PDF/image/doc)
  007_communities_settings.sql → ADD COLUMN communities.is_active boolean DEFAULT true + policy communities_admin_write
  008_avatars_bucket.sql       → Bucket pubblico `avatars` + storage policies (2MB, jpg/png/webp)
  009_contract_templates.sql   → luogo_nascita/comune su collaborators, tipi CONTRATTO_COCOCO/PIVA, tabella contract_templates, bucket contracts
  010_onboarding.sql           → onboarding_completed su user_profiles (DEFAULT false, backfill true), tipo_contratto su collaborators, nome/cognome nullable
  011_contract_fields.sql      → ADD COLUMN provincia_nascita, provincia_residenza, civico_residenza su collaborators
  012_notification_settings.sql → notification_settings table + 15 righe default (inapp+email toggle per event_key×recipient_role)
  013_responsabile_publish_permission.sql → can_publish_announcements boolean DEFAULT true su user_profiles
  014_document_macro_type.sql → ADD COLUMN macro_type TEXT GENERATED ALWAYS (stored) + unique partial index uq_one_contratto_per_collaborator

__tests__/
  compensation-transitions.test.ts → 20 test vitest (state machine compensi, incl. reject_manager)
  expense-transitions.test.ts      → 36 test vitest (state machine rimborsi, incl. reject_manager)
  export-utils.test.ts             → 7 test vitest (buildCSV: BOM, header, colonne, importo, null)
  cu-batch-parser.test.ts          → 11 test vitest (parseCSV + isDuplicate)
  notification-utils.test.ts       → 12 test vitest (buildCompensationNotification + buildExpenseNotification)
  ticket-notification.test.ts      → 6 test vitest (buildTicketReplyNotification)

e2e/
  rimborsi.spec.ts    → 11 test Playwright UAT (flusso completo rimborsi S1-S10)
  export.spec.ts      → 8 test Playwright UAT (accesso, tab, CSV/XLSX download, mark-paid, verifica DB)
  documents.spec.ts   → 10 test Playwright UAT (upload admin, CU batch, firma collaboratore, verifica DB S1-S10)
  notifications.spec.ts → 9 test Playwright UAT (bell, badge, dropdown, mark-read, navigate, DB verify S1-S9)
  ticket.spec.ts        → 9 test Playwright UAT (creazione, thread, notifica reply, stati, DB verify S1-S9)
  contenuti.spec.ts     → 12 test Playwright UAT (navigazione tab, CRUD 4 sezioni, iframe embed, RBAC S1-S12)
  impostazioni.spec.ts  → 11 test Playwright UAT (community CRUD, member_status, assegnazione responsabile S1-S11)
  profilo.spec.ts       → 11 test Playwright UAT (avatar upload, dati fiscali, guide, payment overview S1-S11)
  dashboard.spec.ts     → 10 test Playwright UAT (card compensi/rimborsi/docs, azioni rapide, feed S1-S10)
  contratti.spec.ts     → 10 test Playwright UAT (tab Contratti, upload template, crea collaboratore + contratto, profilo esteso S1-S10)
  fixtures/
    Contratto_Cococo_Testbusters.docx       → Template reale CoCoCo (540KB, fixture stabile)
    Contratto_Occasionale_Testbusters.docx  → Template reale Occasionale (204KB)
    Contratto_PIVA_Testbusters.docx         → Template reale P.IVA (204KB)
  onboarding.spec.ts    → 10 test Playwright UAT (wizard anagrafica, genera contratto, proxy redirect, PIVA field, responsabile S1-S10)
  collaboratori.spec.ts → 10 test Playwright UAT (lista filtri, dettaglio, azioni inline, RBAC S1-S10)
  dashboard-responsabile.spec.ts → 10 test Playwright UAT (CommCards, pending counters, alert pending, feed, RBAC S1-S10)
  dashboard-admin.spec.ts → 10 test Playwright UAT (KPI card, community cards, period metrics Recharts, feed filter, blocks drawer S1-S10)
  responsabile-actions.spec.ts → 10 test Playwright UAT (reject_manager compensi/rimborsi, can_publish_announcements toggle, RBAC S1-S10)
  notification-settings.spec.ts → 10 test Playwright UAT (tab Notifiche, toggle in-app/email, DB verify, XPath sibling selector S1-S10)
  documents-features.spec.ts  → 7 test Playwright UAT (macro-tipo badge, collab upload, unicità CONTRATTO, DA_FIRMARE, checkbox conferma firma, elimina S1/S7/S8/S10/S12/S13/S14)
  notifications-enhanced.spec.ts → 6 test Playwright UAT (badge persistenza, mark-read singola, segna-tutte, dismiss, link ticket, filtro non lette S1–S6)
  invite-form.spec.ts          → 4 test Playwright UAT (toggle default, disabled gate, invito rapido DB verify, invito completo CF+community S1/S4/S6/S7)

playwright.config.ts   vitest.config.ts   proxy.ts   next.config.ts   .env.local.example
```

## Navigation per ruolo
| Ruolo | Voci sidebar |
|---|---|
| collaboratore | Dashboard, Profilo, Compensi, Rimborsi, Documenti, Ticket, Contenuti |
| responsabile | Profilo, Approvazioni, Collaboratori, Documenti, Ticket, Contenuti |
| amministrazione / super_admin | Coda lavoro, Collaboratori, Export, Documenti, Ticket, Contenuti, Impostazioni |

## Known Patterns
- **canTransition visibility**: chiamata senza `note` → skip requiresNote check (UI visibility). La validazione della nota avviene solo quando `note !== undefined` (path API). Altrimenti il button "Richiedi integrazioni" non viene mai renderizzato.
- **Invite flow**: `admin.auth.admin.createUser({ email, password, email_confirm: true })` + `user_profiles { must_change_password: true }`. Dopo la creazione: invia email invito (E8, fire-and-forget via Resend) + mostra nell'UI email e password copiabili come backup in caso di mancato recapito.
- **Primo accesso**: proxy controlla `must_change_password` → `/change-password` → `supabase.auth.updateUser` + POST `clear-force-change`.
- **Proxy redirect + cookies**: usare `createRedirect(url, supabaseResponse)` che copia i cookie Supabase — altrimenti la sessione si perde nel redirect.
- **RLS infinite recursion**: `collab_communities_own_read` NON deve fare subquery diretta su `collaborators` → usare `get_my_collaborator_id()` (security definer).
- **RLS helpers**: `get_my_role()`, `is_active_user()`, `can_manage_community(id)`, `get_my_collaborator_id()` — tutti `security definer`.
- **Anonimato timeline**: salvare `role_label` (non user_id) in compensation_history / expense_history.
- **Filtro default**: "Solo azioni richieste" attivo di default per Responsabile e Admin.
- **Pagamenti massivi**: checkbox multi-selezione + bulk "Segna pagato", `paid_at` automatico.
- **Playwright timing form→DB**: usare `Promise.all([page.waitForResponse(res => res.url().includes('/api/...') && res.request().method() === 'POST', {timeout:15_000}), async () => { fill; click; }()])` prima di verificare il DB — senza questo, la verifica DB corre prima che l'API abbia completato, causando falsi negativi anche se il DOM mostra già il risultato.
- **Ticket service role**: nelle API route dei ticket usare sempre `serviceClient` (service role) per fetch + insert, con access control esplicito nel codice (non delegare a RLS lato SSR).

## Coding Conventions
- UI: **italiano**. Codice/commit: **inglese** (conventional commits).
- Status/enum: MAIUSCOLO_SNAKE. ZodError: `.issues` (non `.errors`).
- Ogni route API server-side: verificare ruolo chiamante prima di qualsiasi operazione.

## Documenti di riferimento

- **Specifica di prodotto completa**: [`docs/requirements.md`](docs/requirements.md)
  → Leggere la sezione pertinente PRIMA di iniziare ogni blocco (Fase 1 pipeline).
- **Stato avanzamento blocchi**: [`docs/implementation-checklist.md`](docs/implementation-checklist.md)
  → Leggere PRIMA di iniziare un nuovo blocco per verificare dipendenze e contesto.
  → Aggiornare OBBLIGATORIAMENTE al termine di ogni blocco (Fase 8 pipeline).

---

## Workflow Requirements (user instructions)

CRITICAL: questi sono vincoli di processo non negoziabili. Valgono per OGNI sviluppo — blocchi funzionali, fix, refactoring, feature minori — anche quando il piano completo è fornito in un singolo prompt. Eseguire sempre una fase alla volta e fermarsi ai gate indicati. Non passare alla fase successiva senza conferma esplicita.

### Pipeline obbligatoria per ogni sviluppo

**Fase 0 — Orientamento sessione** *(solo all'inizio di ogni nuova sessione o ripresa da summary)*
- Verificare `MEMORY.md` per lezioni/pattern rilevanti per il blocco corrente.
- Se il contesto è stato compresso (summary): leggere `docs/implementation-checklist.md` per riallinearsi allo stato.
- Non rileggere file già presenti nel contesto corrente — usare la line reference già acquisita.

**Fase 1 — Requisiti**
- Leggere `docs/implementation-checklist.md` per verificare lo stato corrente e le dipendenze del blocco.
- Leggere **solo la sezione pertinente** di `docs/requirements.md` per il blocco in lavorazione — non l'intero file.
- Riformulare i requisiti del blocco in modo sintetico.
- Per ricerche ampie nel codebase (>3 Glob/Grep indipendenti): delegare a un Task agent Explore per proteggere il contesto principale.
- Se qualcosa è ambiguo, usare AskUserQuestion PRIMA di scrivere codice.
- Output atteso: riepilogo funzionalità, elenco file da creare/modificare, eventuali domande aperte.
- *** STOP — presentare riepilogo requisiti e lista file da toccare. Attendere conferma esplicita prima di procedere. ***

**Fase 1.5 — Design review** *(per blocchi che introducono pattern nuovi, modificano la struttura DB, o toccano >5 file)*
- Presentare schema del design: flusso dati, strutture dati coinvolte, trade-off principali.
- Indicare eventuali alternative scartate e motivazione.
- Per blocchi semplici (≤3 file, nessuna migration, nessun nuovo pattern): questa fase può essere saltata indicandolo esplicitamente.
- *** STOP — attendere conferma del design prima di scrivere codice. ***

**Fase 2 — Implementazione**
- Scrivere il codice. Rispettare le Coding Conventions del progetto.
- Non aggiungere feature non richieste. Non refactoring non richiesto.
- **Dopo ogni nuova migration** (`supabase/migrations/NNN_*.sql`): applicare **immediatamente** al DB remoto via Management API (`curl` con `SUPABASE_ACCESS_TOKEN` da `.env.local`) + verificare con query SELECT sulla colonna/struttura creata. Non attendere i test e2e per scoprire migrazioni mancanti.
- **Sintassi PostgREST join** (`table!relation`, `!inner`): verificare l'esistenza della FK constraint prima di usarla. Se FK assente → query a due step (fetch separati + merge in-memory). Query di verifica: `SELECT conname FROM pg_constraint WHERE conrelid='tablename'::regclass AND contype='f';`
- **Security checklist** (prima del commit intermedio): per ogni route API nuova/modificata verificare: (1) auth check presente prima di qualsiasi operazione, (2) input validato (Zod o equivalente), (3) nessun dato sensibile esposto nella response, (4) RLS non aggirata implicitamente.
- Output atteso: file creati/modificati elencati con path.

**Fase 3 — Build + unit test**
- Eseguire `npx tsc --noEmit` e `npm run build`. Devono terminare senza errori.
- Eseguire `npx vitest run` per i nuovi test unitari. Devono passare tutti.
- Output atteso: riportare solo la riga summary (es. `✓ 6 passed | 81/81`), NON l'output completo — riduce consumo token.
- Se qualcosa fallisce: incollare solo le righe di errore, correggere e rieseguire. Non proseguire con errori aperti.
- Dopo build + test verdi: **fare commit intermedio** (`git add … && git commit`) — permette di comprimere il diff nelle sessioni successive e isola il lavoro in caso di rollback.

**Fase 3b — API integration tests** *(solo se il blocco crea o modifica route API)*
- Per ogni route API coinvolta, scrivere test core in `__tests__/api/<nome-route>.test.ts` con vitest + fetch:
  - Happy path: status code atteso + campi chiave nel response body
  - Auth: chiamata senza token → 401
  - Authz: ruolo non autorizzato → 403
  - Validation: payload invalido o campo obbligatorio mancante → 400
  - Business rules: violazione di vincolo applicativo (es. duplicato, stato invalido) → codice errore corretto
  - DB state: dopo scrittura, verificare il record atteso con service role
- Focus sui casi core — non esaurire ogni combinazione, coprire i path critici. La selezione è a discrezione del developer.
- Eseguire `npx vitest run __tests__/api/` — tutti verdi.
- Output: solo riga summary. Non proseguire con errori aperti.

**Fase 4 — Definizione UAT**
- Identificare solo gli scenari **core** di copertura: happy path, edge case principale, verifica DB post-operazione. Evitare scenari ridondanti o puramente UI senza valore aggiunto.
- Elencare gli scenari Playwright (S1, S2, …) con: azione, dato di input, verifica attesa.
- *** STOP — presentare la lista scenari e attendere conferma esplicita prima di scrivere l'e2e spec. ***

**Fase 5 — Playwright e2e**
- Scrivere `e2e/<blocco>.spec.ts` in base agli scenari approvati.
- Eseguire `npx playwright test e2e/<blocco>.spec.ts`.
- **Prima di scrivere locatori CSS**: leggere il file del componente target (Read tool) e derivare le classi dal JSX reale — mai assumere classi dalla memoria. Distinguere classi condivise (es. `px-5 py-4` su header e righe) da classi univoche (es. `space-y-2` solo sulle righe).
- Output atteso: riportare solo la riga summary (es. `9 passed (45s)`), NON l'output completo.
- Se qualcosa fallisce: incollare solo lo scenario fallito con errore, correggere e rieseguire. Non proseguire con test rossi.
- Selettori: usare classi CSS esplicite (es. `span.text-green-300`), mai `getByText()` per stati.

**Fase 5.5 — Smoke test manuale** *(prima della checklist formale)*
- Eseguire 3-5 passi rapidi nel browser con l'utenza appropriata per verificare il flusso principale.
- Obiettivo: intercettare problemi banali (UI bloccata, redirect errato, dati non salvati) prima di presentare la Fase 6.
- Non sostituisce i test automatici — è un controllo di sanità rapido.
- Output: "smoke test OK" oppure elencare il problema e correggerlo prima di procedere.

**Fase 6 — Checklist esiti**
Presentare questa checklist compilata con i risultati effettivi:

```
## Checklist blocco — [Nome Blocco]

### Build & Test
- [ ] `tsc --noEmit`: 0 errori
- [ ] `npm run build`: successo
- [ ] Vitest unit: N/N passati
- [ ] Playwright e2e: N/N passati

### Funzionalità implementate
- [ ] [feature 1]: [esito]
- [ ] [feature 2]: [esito]

### Verifica con utenza reale
Passi per verificare manualmente con mario.rossi@test.com (o ruolo appropriato):
1. [passo]
2. [passo]
…

### Query SQL di verifica
```sql
-- [descrizione]
SELECT …;
```

### File creati / modificati
- `path/to/file.ts` — [descrizione modifica]
```

**Fase 7 — Conferma umana**
- *** STOP — non dichiarare il blocco completo, non aggiornare README/CLAUDE.md, non passare al blocco successivo finché l'utente non risponde con conferma esplicita. ***
- Chiedere: "Confermi che posso aggiornare README e CLAUDE.md e chiudere il blocco?"

**Fase 8 — Chiusura blocco**
- Solo dopo conferma esplicita:
  1. Aggiornare `docs/implementation-checklist.md`: segnare il blocco ✅, aggiungere riga nel Log con data, file, test, note rilevanti.
  2. Aggiornare `CLAUDE.md` (Project Structure).
  3. Aggiornare `README.md` (Project Structure + conteggio test).
  4. Aggiornare `MEMORY.md` **solo se sono emerse lezioni nuove** non già documentate — evitare duplicazioni.
     - Se MEMORY.md supera ~150 righe attive: estrarre il topic in un file separato (es. `playwright-patterns.md`) e sostituire con link.
  5. Se durante l'implementazione sono emerse criticità strutturali o di design: aprire `docs/refactoring-backlog.md`, verificare duplicati, aggiungere le nuove voci ordinate per topic.
  6. Fare commit finale (`README.md` + `docs/implementation-checklist.md` + `docs/refactoring-backlog.md` se modificato — **mai** `CLAUDE.md` né `MEMORY.md`).
  7. Eseguire `git push` immediatamente dopo il commit.
  8. Eseguire `/compact` per liberare la memoria di contesto della sessione corrente.

---

### Regole trasversali
- **Playwright UAT**: `npx playwright test e2e/` — usa selettori CSS classe (es. `span.text-green-300`) per badge di stato. Mai `getByText()` per valori di stato (cattura partial match dalla Timeline raw DB).
- **Anche se il piano è già scritto**: eseguire comunque fase per fase con i gate. Il piano pre-scritto sostituisce solo la Fase 1, non comprime le fasi successive.
- **Gate bloccanti**: le istruzioni "STOP" sono hard stop. Non interpretarli come suggerimenti.
- **Non rileggere file già in contesto**: se un file è già stato letto nella sessione corrente, non rileggerlo — riferirsi alla line reference già acquisita.
- **Explore agent per ricerche ampie**: se una ricerca richiede >3 query Glob/Grep indipendenti, delegare a `Task subagent_type=Explore` per proteggere il contesto principale dalla verbosità dei risultati.
- **Output sintetici**: riportare sempre solo la riga summary di build/test. Incollare dettaglio solo in caso di errore.
- **MEMORY.md compatto**: mantenere sotto ~150 righe. Oltre questa soglia: estrarre topic in file separati e linkare.
- **Migration immediata**: ogni `supabase/migrations/*.sql` va applicata al DB remoto subito dopo la scrittura (Management API + verifica SELECT). Mai lasciare una migration scritta ma non applicata prima dei test e2e.
- **FK check prima di join PostgREST**: prima di `table!relation` verificare FK con `SELECT conname FROM pg_constraint WHERE conrelid='tablename'::regclass AND contype='f'`. Se FK assente: query a due step.
- **Locatori da JSX reale**: prima di scrivere ogni locatore e2e, leggere il componente (Read tool). Individuare classi univoche per ogni elemento target — non assumere dalla memoria.

## Phase Plan

Stato dettagliato in [`docs/implementation-checklist.md`](docs/implementation-checklist.md).

- **Phase 1** ✅ COMPLETATA: Auth, Invite utenti, Profilo, Compensi, Rimborsi, Coda lavoro, Export
- **Phase 2** ✅ COMPLETATA: Documenti + CU batch ✅, Notifiche in-app ✅, Ticket ✅, Contenuti ✅
- **Phase 3** ✅ COMPLETATA: Impostazioni avanzate ✅, Template contratti + Onboarding automatizzato ✅, Dashboard collaboratore ✅, Profilo collaboratore esteso ✅, Onboarding flow ✅, Dashboard responsabile ✅, Dashboard admin ✅, Sezione Collaboratori ✅, Responsabile reject + publish permission ✅, Notifiche email configurabili ✅
