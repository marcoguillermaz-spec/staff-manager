# Staff Manager — Implementation Checklist

> Aggiornare questo file al termine di ogni blocco funzionale (Fase 8 della pipeline).
> È la fonte di verità sullo stato dei lavori. Leggere prima di iniziare un nuovo blocco.

---

## Phase 1 — Core ✅ COMPLETATA

| Blocco | Stato | Unit test | E2E | Note |
|---|---|---|---|---|
| Auth (email/password, invite-only, forced pw change) | ✅ | — | — | proxy.ts, must_change_password |
| Invite utenti (admin crea account + profilo) | ✅ | — | — | /impostazioni, /api/admin/create-user |
| Profilo collaboratore (edit IBAN, tel, indirizzo, tshirt) | ✅ | — | — | /profilo, /api/profile |
| Compensi (wizard 3 step, state machine, timeline, allegati) | ✅ | 14 vitest | — | compensation-transitions.ts |
| Rimborsi (form, state machine, timeline, allegati) | ✅ | 31 vitest | 11 Playwright | expense-transitions.ts, e2e/rimborsi.spec.ts |
| Coda lavoro (admin: PRE_APPROVATO + APPROVATO_ADMIN) | ✅ | — | — | /coda |
| Export (CSV/XLSX, mark-paid bulk, 3 tab) | ✅ | 7 vitest | 8 Playwright | export-utils.ts, e2e/export.spec.ts |

---

## Phase 2 — ✅ COMPLETATA

| Blocco | Stato | Unit test | E2E | Note |
|---|---|---|---|---|
| Documenti + CU batch | ✅ | 11 vitest | 10 Playwright | §4.3 req. Bucket privato `documents`, upload via service role, signed URL 1h, CU batch ZIP+CSV |
| Ticket | ✅ | 6 vitest | 9 Playwright | §4.4 req. Bucket `tickets`, thread messaggi, allegati, notifiche in-app, stati APERTO/IN_LAVORAZIONE/CHIUSO |
| Notifiche in-app | ✅ | 12 vitest | 9 Playwright | §8 req. Bell + badge + dropdown, mark-read, trigger su compensi/rimborsi/documenti |
| Contenuti (Bacheca, Agevolazioni, Guide, Eventi) | ✅ | — | 12 Playwright | §5 req. 4 tab URL-based, CRUD inline, RBAC write per sezione, iframe Luma embed |

---

## Phase 3 — In corso

| Blocco | Stato | Unit test | E2E | Note |
|---|---|---|---|---|
| Impostazioni avanzate | ✅ | — | 11 Playwright | Gestione community (is_active), member_status collaboratori, assegnazione responsabile→community. Migration 007. |
| Template contratti + Onboarding automatizzato | ✅ | — | 10 Playwright | Migration 009. Tabella `contract_templates`, bucket `contracts`, docxtemplater. Tab "Contratti" in Impostazioni. CreateUserForm espanso con anagrafica + contratto. ProfileForm: tutti i campi editabili (tranne email/data_ingresso). |
| Dashboard collaboratore | ✅ | — | 10 Playwright | §11 req. 3 card riepilogative, azioni rapide, "Cosa mi manca", feed 10 item (history+tickets+annunci). Fix: RLS senza user_id su compensations/expenses. |
| Profilo collaboratore esteso | ✅ | — | 11 Playwright | §12 req. Avatar upload (bucket `avatars`), ha_figli_a_carico (semantica: il collaboratore è fiscalmente a carico), P.IVA + guide da resources, data_ingresso admin-managed, PaymentOverview in /compensi. Migration 008. |
| Onboarding flow | ✅ | — | 10 Playwright | Migration 010. Wizard 2-step post-primo-login: dati anagrafici (tutti obbligatori) + genera contratto. tipo_contratto obbligatorio nell'invite admin. Proxy redirect a /onboarding se onboarding_completed=false. collaborators per entrambi i ruoli. |
| Campi CoCoCo + estensione profilo (province, civico) | ✅ | — | 10 Playwright | Migration 011. 3 nuovi campi su collaborators (provincia_nascita, provincia_residenza, civico_residenza). UI split: città/provincia nascita, comune/provincia residenza, via/civico. dual-name vars COCOCO in onboarding/complete. ContractTemplateManager: 13 segnaposto CoCoCo. |
| Responsabile — completamento nav + fixture e2e | ✅ | — | 10 Playwright | Profilo + Documenti nav per responsabile. Sign API: responsabile può caricare firmato. e2e/fixtures/ con 3 template reali Testbusters. beforeAll cleanup-first pattern. |
| Sezione Collaboratori responsabile | ✅ | — | 10 Playwright | Lista paginata 20/pag, filtri URL-driven (tutti/doc-da-firmare/stallo), dettaglio con azioni inline Pre-approva + Integrazioni. RBAC: responsabile filtrato per community, admin vede tutto, collaboratore redirect. Service role in server pages. |
| Dashboard responsabile | ✅ | — | 10 Playwright | Per-community CommCards (pending compensi/rimborsi/doc DA_FIRMARE con stile ambra/blu), "Cosa devo fare" alert, feed (compensi/rimborsi inviati + annunci), azioni rapide. Fix: join embedded PostgREST → query separate. |
| Dashboard admin | ✅ | — | 10 Playwright | 6 KPI card, community cards grid, urgenti >3gg, feed filtrable (cognome like + community dropdown), period metrics Recharts (importo pagato + compensi approvati + nuovi collab), collab breakdown (stato + contratto), blocks drawer (must_change_password, onboarding_incomplete, stalled). |
| Verifica requisiti ruolo collaboratore + responsabile | ✅ | 93 vitest | 10 Playwright | C-01: email self-edit per tutti i ruoli. C-03: member_status enforcement (route guard + year filter docs). R-01: reject_manager per responsabile (INVIATO/INTEGRAZIONI → RIFIUTATO). R-02: can_publish_announcements toggle per responsabile. Migration 013. |
| Email notifications + Notification Settings | ✅ | 93 vitest | 10 Playwright | 7 template HTML Resend (E1–E7). Migration 012 (notification_settings, 15 righe). Tab Notifiche in Impostazioni. Helpers getNotificationSettings/getCollaboratorInfo/getResponsabili*. Tutti i trigger in-app+email integrati in comp/expense/doc/ticket routes. |
| Definizione corso unificata (Staff + Simu) | 🔲 fuori scope | | | Vedere §9 requirements.md — valutare in futuro |

---

---

## Punti aperti da approfondire

| # | Blocco | Punto | Stato |
|---|---|---|---|
| 1 | Documenti + CU batch | **Anno CU nel batch**: confermato — admin specifica l'anno manualmente. Allineare con contabilità a primo utilizzo reale. | ✅ chiuso |
| 2 | Documenti + CU batch | **Formato CSV CU batch**: assunzione `nome_file,nome,cognome`. Allineare con contabilità a primo utilizzo reale. | ⏳ da verificare |
| 3 | Template contratti | **Template reale**: `Contratto_Cococo_Testbusters.docx` caricato in storage. Onboarding COCOCO end-to-end verificato con test e2e S7. | ✅ chiuso |

---

## Legenda

| Simbolo | Significato |
|---|---|
| ✅ | Completato: build ✅, unit test ✅, Playwright ✅, checklist firmata, CLAUDE.md aggiornato |
| 🔄 | In corso (blocco attivo) |
| 🔲 | Non iniziato |
| ⏸ | Sospeso / bloccato da dipendenza |

---

## Log blocchi completati

### Onboarding flow — completato 2026-02-23
- File: `app/onboarding/page.tsx`, `components/onboarding/OnboardingWizard.tsx`, `app/api/onboarding/complete/route.ts`, `e2e/onboarding.spec.ts`
- Migration: `010_onboarding.sql` — onboarding_completed su user_profiles, tipo_contratto su collaborators, nome/cognome nullable
- Modificati: `proxy.ts` (check onboarding_completed), `app/api/admin/create-user/route.ts` (tipo_contratto obbligatorio, onboarding_completed=false, collaborators per entrambi i ruoli, rimossa generazione contratto al momento dell'invito), `components/impostazioni/CreateUserForm.tsx` (tipo rapporto required per entrambi i ruoli), `lib/types.ts` (UserProfile + Collaborator aggiornati), `app/(app)/layout.tsx` (nome/cognome nullable)
- Test: — unit + 10 Playwright (S1–S10, tutti verdi)
- Pattern: wizard 2-step: step 1 = dati anagrafici (tutti required), step 2 = genera contratto via docxtemplater → onboarding_completed=true. Il download è step intermedio; l'utente clicca "Ho scaricato" per accedere alla dashboard.
- Flow test e2e con browser.newPage() in beforeAll per condividere il contesto browser tra S2–S7 (sessione persistente durante il flusso).

### Dashboard admin — completato 2026-02-24
- File: `components/admin/types.ts`, `components/admin/BlocksDrawer.tsx`, `components/admin/AdminDashboard.tsx`, `app/api/admin/blocks/clear-flag/route.ts`, `e2e/dashboard-admin.spec.ts`
- Modificati: `app/(app)/page.tsx` (branch amministrazione/super_admin con fetch service role + render AdminDashboard)
- Packages: recharts 3.7.0 (già installato)
- Test: 0 unit + 10 Playwright (S1–S10, tutti verdi, 47s)
- Pattern: server page fetches tutto con service role (parallel Promise.all); AdminDashboard è un client component che riceve i dati serializzati come prop. Feed filtrato client-side su ~50 item pre-fetchati. Collab breakdown: query su collaborators → map aggregation in-memory. Urgenti = items in stato actionable con created_at < now-3gg. Block items aggregati da 4 sorgenti (pwd, onboarding, stalled comps, stalled exps).

### Email notifications + Notification Settings — completato 2026-02-24
- File: `lib/email.ts`, `lib/email-templates.ts`, `lib/notification-helpers.ts`, `app/api/admin/notification-settings/route.ts`, `components/impostazioni/NotificationSettingsManager.tsx`, `e2e/notification-settings.spec.ts`
- Migration: `012_notification_settings.sql` — tabella `notification_settings` + 15 righe default (applicata al DB remoto)
- Modificati: `lib/notification-utils.ts` (5 nuovi builder), `app/(app)/impostazioni/page.tsx` (tab Notifiche), `app/api/compensations/[id]/transition/route.ts`, `app/api/expenses/[id]/transition/route.ts`, `app/api/expenses/route.ts`, `app/api/documents/route.ts`, `app/api/tickets/route.ts`, `app/api/tickets/[id]/messages/route.ts`, `app/api/tickets/[id]/status/route.ts`
- Packages: `resend` (già installato)
- Test: 93 vitest + 10 Playwright (S1–S10, tutti verdi, 35s)
- Chiave tecnica: `Svc` type in helpers → `SupabaseClient<any, any, any>` (non `ReturnType<typeof createServiceClient>` — incompatibile con client generic params dei route handlers)
- Pattern Playwright: `page.locator('div').filter({ has: h3 }).first()` cattura il container ESTERNO. Fix: usare `h3.locator('xpath=following-sibling::div[1]')` per selezionare il sibling immediato.
- Notifiche email fire-and-forget: `sendEmail(...).catch(() => {})` — non blocca la risposta HTTP in caso di errore Resend.

### Verifica requisiti collaboratore + responsabile — completato 2026-02-24
- File: `supabase/migrations/013_responsabile_publish_permission.sql`, `app/api/admin/responsabili/[userId]/publish-permission/route.ts`, `e2e/responsabile-actions.spec.ts`
- Modificati: `lib/compensation-transitions.ts` (reject_manager), `lib/expense-transitions.ts` (reject_manager), `app/api/compensations/[id]/transition/route.ts`, `app/api/expenses/[id]/transition/route.ts`, `components/compensation/ActionPanel.tsx`, `components/expense/ExpenseActionPanel.tsx`, `components/impostazioni/CommunityManager.tsx`, `app/(app)/impostazioni/page.tsx`, `app/(app)/contenuti/page.tsx`, `app/api/profile/route.ts` (email self-edit), `components/ProfileForm.tsx`, `app/(app)/compensi/page.tsx`, `app/(app)/rimborsi/page.tsx`, `app/(app)/ticket/page.tsx`, `app/(app)/documenti/page.tsx`, `app/(app)/documenti/[id]/page.tsx`, `components/documents/DocumentSignFlow.tsx`
- Migration: `013_responsabile_publish_permission.sql` — ADD COLUMN can_publish_announcements boolean DEFAULT true on user_profiles
- Test: 93 vitest + 10 Playwright (S1–S10, tutti verdi)
- C-01: email self-edit via admin.updateUserById (service role, no confirmation) + client-side session refresh
- C-03: uscente_senza_compenso → redirect /documenti da compensi/rimborsi/ticket/contenuti. uscente_con_compenso → year filter su documenti. canSign=false per uscente_senza_compenso.
- R-01: reject_manager → RIFIUTATO da INVIATO/INTEGRAZIONI. Notifica: remap reject_manager → 'reject' via notifAction var in API routes.
- R-02: toggle can_publish_announcements per responsabile in Impostazioni > Community. canWriteAnnouncements = role check AND (role ≠ responsabile OR can_publish_announcements=true).

### Dashboard responsabile — completato 2026-02-24
- File: `app/(app)/page.tsx` (branch responsabile aggiunto), `e2e/dashboard-responsabile.spec.ts`
- Nessuna migration necessaria — dati già esistenti
- Test: — unit + 10 Playwright (S1–S10, tutti verdi)
- Pattern: 3 round sequenziali di query con service role (nessun join embedded — PostgREST embedded join da service client fallisce silenziosamente restituendo null). Round 1: community IDs. Round 2: community names + collaborator IDs + announcements. Round 3: dati paralleli (collaborators, pending comps/exps, docs, stallo).
- CommCard: stile ambra (text-amber-300) per pending > 0 su compensi/rimborsi; stile blu (text-blue-300) per docs > 0. Grey (text-gray-600) quando zero.
- Feed: compensi INVIATO (con nome collaboratore via collabByCollabId map) + rimborsi INVIATO + annunci. Ticket rimosso (richiederebbe un 4° round per ottenere user_ids → ticket_ids).

### Sezione Collaboratori responsabile — completato 2026-02-24
- File: `app/(app)/collaboratori/page.tsx`, `app/(app)/collaboratori/[id]/page.tsx`, `components/responsabile/CollaboratoreDetail.tsx`, `e2e/collaboratori.spec.ts`
- Nessuna migration necessaria — dati già esistenti
- Test: — unit + 10 Playwright (S1–S10, tutti verdi)
- Pattern: service role client usato direttamente nelle server page (stessa modalità di `app/onboarding/page.tsx`) per evitare dipendenze da RLS coverage dei join `collaborators` → `collaborator_communities` → `user_community_access`.
- Filtri URL-driven (no client JS): `?filter=all|documenti|stallo&page=N` — filter chips sono `<Link>` puri.
- Colonna DB state machine: `stato` (non `status`) sia su `compensations` che `expense_reimbursements`.
- Azioni inline (Pre-approva / Richiedi integrazioni): chiamate alle API `/api/compensations/[id]/transition` e `/api/expenses/[id]/transition` già esistenti + `router.refresh()` per aggiornamento server component.
- E2e S7: bottone "Richiedi" è disabled quando nota < 20 char — test verifica `.toBeDisabled()` invece di `.click()` sulla versione disabilitata.

### Responsabile — completamento nav + fixture e2e — completato 2026-02-23
- File: `e2e/fixtures/` (3 template reali: Cococo, Occasionale, PIVA)
- Modificati: `lib/nav.ts` (Profilo + Documenti per responsabile), `app/api/documents/[id]/sign/route.ts` (role check esteso a responsabile), `e2e/contratti.spec.ts` (fixture reali, cleanup-first beforeAll, afterAll senza delete fixture)
- Test: 10 Playwright (S1–S10, tutti verdi)
- Pattern: `beforeAll` — il cleanup utenti deve essere la PRIMA operazione, prima di qualsiasi `fs.readFileSync`, per evitare che un'eccezione lasci utenti orfani. `afterAll` — non fare `fs.unlinkSync` su fixture path (usare `os.tmpdir()` per discriminare file temporanei). `deleteAuthUser` — cancellare i documenti FK-linkati prima di eliminare l'utente auth.

### Campi CoCoCo + estensione profilo — completato 2026-02-23
- File: `supabase/migrations/011_contract_fields.sql`, `e2e/contratti.spec.ts`, `e2e/profilo.spec.ts`, `components/impostazioni/ContractTemplateManager.tsx`
- Modificati: `lib/types.ts` (3 campi), `app/api/profile/route.ts` (SELF_EDIT_FIELDS), `app/api/onboarding/complete/route.ts` (schema + vars dual-name), `components/onboarding/OnboardingWizard.tsx`, `components/ProfileForm.tsx`, `components/impostazioni/CreateUserForm.tsx`, `app/api/admin/create-user/route.ts`, `app/onboarding/page.tsx`, `app/(app)/profilo/page.tsx`
- Migration: `011_contract_fields.sql` — ADD COLUMN provincia_nascita, provincia_residenza, civico_residenza su collaborators
- Test: 0 unit + 10 Playwright (S1–S10 contratti, tutti verdi); 11 Playwright (profilo, tutti verdi)
- Pattern: vars dict dual-name — stessa chiave per campo OCCASIONALE e corrispondente campo COCOCO nello stesso dict. docxtemplater usa `nullGetter: () => ''` → variabili non presenti nel template vengono ignorate silenziosamente.
- Onboarding e2e S7: creazione test user via service role direttamente (bypass UI) + `must_change_password=false` + `onboarding_completed=false` → login → proxy redirect a /onboarding → wizard → CONTRATTO_COCOCO DA_FIRMARE.

### Template contratti + Onboarding automatizzato — completato 2026-02-23
- File: `supabase/migrations/009_contract_templates.sql`, `app/api/admin/contract-templates/route.ts`, `components/impostazioni/ContractTemplateManager.tsx`, `e2e/contratti.spec.ts`
- Modificati: `app/api/admin/create-user/route.ts` (anagrafica + collaborators insert + docxtemplater generation), `components/impostazioni/CreateUserForm.tsx` (full anagrafica + contract section), `app/api/profile/route.ts` (expanded fields), `components/ProfileForm.tsx` (all fields editable), `app/(app)/profilo/page.tsx`, `app/(app)/impostazioni/page.tsx` (tab Contratti), `lib/types.ts`
- Migration: `009_contract_templates.sql` — luogo_nascita/comune su collaborators, nuovi tipi CONTRATTO_COCOCO/PIVA, tabella contract_templates, bucket contracts
- Packages: docxtemplater 3.68.2 + pizzip 3.2.0
- Test: — unit + 10 Playwright (S1–S10, tutti verdi)
- Pattern: docxtemplater richiede `nullGetter: () => ''` per variabili non valorizzate — altrimenti genera eccezione. Generazione in create-user è best-effort: se il template è assente o la generazione fallisce, l'utente viene creato ugualmente.
- Onboarding: create-user API ora crea il record `collaborators` quando role=collaboratore (era un gap storico). I dati anagrafici per la generazione contratto vengono raccolti dall'admin al momento dell'invito.
- Placeholder syntax: `{variabile}` (singola graffa, docxtemplater default)

### Dashboard collaboratore — completato 2026-02-23
- File: `app/(app)/page.tsx` (riscritta da placeholder), `e2e/dashboard.spec.ts`
- Nessuna migration necessaria — dati già esistenti
- Test: — unit + 10 Playwright (S1–S10, tutti verdi)
- Fix critico: `compensations` e `expense_reimbursements` usano `collaborator_id` (non `user_id`) — RLS filtra tramite join `collaborator_id → collaborators.user_id = auth.uid()`. Non aggiungere `.eq('user_id', ...)` su queste tabelle.
- Pattern Playwright: con `{ page }` fixture in `test.describe.serial`, ogni test ha un browser context SEPARATO — chiamare `login()` esplicitamente all'inizio di ogni test, non solo del primo.
- Feed: service role client inline per `ticket_messages` (stesso pattern API routes)

### Profilo collaboratore esteso — completato 2026-02-23
- File: `app/api/profile/avatar/route.ts`, `app/api/admin/members/[id]/data-ingresso/route.ts`, `components/ProfileForm.tsx`, `components/Sidebar.tsx`, `components/compensation/PaymentOverview.tsx`, `e2e/profilo.spec.ts`
- Migration: `008_avatars_bucket.sql` (bucket pubblico `avatars`, 2MB, jpg/png/webp)
- Modificati: `app/api/profile/route.ts` (aggiunti partita_iva, ha_figli_a_carico), `app/(app)/profilo/page.tsx`, `app/(app)/compensi/page.tsx`, `app/(app)/layout.tsx`, `app/(app)/impostazioni/page.tsx`, `components/impostazioni/MemberStatusManager.tsx`
- Test: — unit + 11 Playwright (S1–S11, tutti verdi)
- Semantica: `ha_figli_a_carico` = il collaboratore STESSO è fiscalmente a carico di un familiare (non "ha dipendenti a carico")
- Guide fiscali: riutilizzano tabella `resources` con tag `detrazioni-figli` e `procedura-piva` — nessuna tabella nuova
- Pattern: bucket `avatars` pubblico → URL pubblico diretto (no signed URL); upload centralizzato in API route con service role

### Contenuti — completato 2026-02-20
- File: `app/(app)/contenuti/page.tsx`, `components/contenuti/` (4 componenti), `app/api/announcements/`, `app/api/benefits/`, `app/api/resources/`, `app/api/events/`
- Modificati: `lib/types.ts` (Announcement, Benefit, Resource, ContentEvent interfaces), `CLAUDE.md` (pipeline ottimizzata: Fase 0, output sintetici, MEMORY.md compatto, commit intermedio)
- Test: — unit + 12 Playwright (S1–S12, tutti verdi)
- RBAC: Bacheca → admin/super_admin/responsabile; Agevolazioni/Guide/Eventi → solo admin/super_admin
- Pattern Playwright: inline edit form sostituisce il card content → il locatore `:has(h3:has-text(...))` non trova più i figli dopo il click su "Modifica". Fix: separare il click dal fill usando selettore page-level dopo l'apertura del form

### Ticket — completato 2026-02-20
- File: `app/api/tickets/`, `components/ticket/`, `app/(app)/ticket/`
- Migration: `006_tickets_storage.sql` (bucket privato `tickets`, 10MB)
- Modificati: `lib/types.ts` (TICKET_CATEGORIES, TicketStatus labels, Ticket/TicketMessage interfaces), `lib/notification-utils.ts` (buildTicketReplyNotification), `lib/nav.ts` (Ticket per collaboratore), `app/(app)/coda/page.tsx` (tab "Ticket aperti")
- Test: 6 vitest (ticket-notification) + 9 Playwright (S1–S9, tutti verdi)
- Pattern: `waitForResponse` + `Promise.all` per sincronizzare invio form e verifica DB in Playwright — senza questo la verifica DB corre prima che l'API abbia completato
- Pattern: `serviceClient` (service role) per tutti gli accessi a `tickets`/`ticket_messages` nelle API route (bypassa RLS, access control esplicito nel codice)

### Notifiche in-app — completato 2026-02-20
- File: `lib/notification-utils.ts`, `app/api/notifications/route.ts`, `components/NotificationBell.tsx`
- Modificati: `components/Sidebar.tsx`, `lib/types.ts`, transizioni compensi + rimborsi
- Test: 12 vitest (notification-utils) + 9 Playwright (S1–S9, tutti verdi)
- Pattern: `test.describe.serial` condivide il browser context — usare sign-out (`Esci`) prima di switchare utente
- Pattern: `buildCompensationNotification` / `buildExpenseNotification` in `lib/notification-utils.ts` — helper puri testabili

### Documenti + CU batch — completato 2026-02-20
- File: `app/api/documents/`, `components/documents/`, `app/(app)/documenti/`, `lib/documents-storage.ts`
- Migration: `004_documents_storage.sql` (bucket + policies), `005_add_titolo_to_documents.sql` (colonna titolo)
- Test: 11 vitest (cu-batch-parser) + 10 Playwright (S1–S10, tutti verdi)
- Architettura: upload Storage centralizzato nelle API route con service role (nessuna storage policy client-side)
- Punto aperto rimasto: formato CSV CU batch da allineare con contabilità a primo utilizzo reale

### Export — completato 2026-02-20
- File: `lib/export-utils.ts`, `app/api/export/mark-paid/route.ts`, `components/export/`, `app/(app)/export/page.tsx`
- Test: 7 vitest + 8 Playwright (tutti verdi)
- Dipendenza aggiunta: `xlsx`

### Rimborsi — completato (data n/d)
- File: `app/(app)/rimborsi/`, `app/api/expenses/`, `components/expense/`
- Test: 31 vitest + 11 Playwright
- Fix RLS: `expenses_responsabile_read` usa doppio JOIN via `collaborator_communities`

### Compensi — completato (data n/d)
- File: `app/(app)/compensi/`, `app/api/compensations/`, `components/compensation/`
- Test: 14 vitest
- Pattern chiave: `canTransition` senza `note` per check UI visibilità bottoni
