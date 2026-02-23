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
| Definizione corso unificata (Staff + Simu) | 🔲 fuori scope | | | Vedere §9 requirements.md — valutare in futuro |

---

---

## Punti aperti da approfondire

| # | Blocco | Punto | Stato |
|---|---|---|---|
| 1 | Documenti + CU batch | **Anno CU nel batch**: confermato — admin specifica l'anno manualmente. Allineare con contabilità a primo utilizzo reale. | ✅ chiuso |
| 2 | Documenti + CU batch | **Formato CSV CU batch**: assunzione `nome_file,nome,cognome`. Allineare con contabilità a primo utilizzo reale. | ⏳ da verificare |
| 3 | Template contratti | **Template reale**: blocco sospeso finché non disponibile un template di esempio. Sblocca anche Onboarding automatizzato. | ⏸ in attesa |

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
