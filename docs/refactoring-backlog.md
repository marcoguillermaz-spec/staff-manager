# Refactoring Backlog

Criticità strutturali, di naming DB e architetturali da affrontare in sessioni dedicate.
Non bloccanti per le funzionalità correnti salvo dove indicato **CRITICO/ALTO**.

> Aggiornare questo file ogni volta che emerge una criticità strutturale non risolta nel blocco corrente.

---

## Indice priorità

| ID | Titolo | Impatto |
|----|--------|---------|
| SEC7 | PAT Supabase in plain text in MEMORY.md | CRITICO |
| TC5 | Nessun test RLS su leakage compensation_history | ALTO |
| B1 | `ha_figli_a_carico` semanticamente invertita | ALTO |
| B4 | Typo `data_compenso` vs `data_competenza` nel transition route | ALTO |
| SEC1 | Password temporanea restituita in chiaro dalla API | ALTO |
| S5 | Operazione mark-paid non atomica (no transazione) | ALTO |
| SEC3 | Nessun rate limiting su POST compensi/rimborsi | MEDIO |
| SEC4 | Nessun rate limiting su create-user | MEDIO |
| SEC5 | RLS su compensation_history non testata | MEDIO |
| A1 | Duplicazione logica notification-utils + helpers | MEDIO |
| A2 | Email fire-and-forget senza log di failure | MEDIO |
| S4 | Validazione input route API non standardizzata (manca Zod) | MEDIO |
| S7 | Nessun check `file.size` prima del Buffer upload | MEDIO |
| TC1 | Nessun test unit per `reject_manager` su compensi | MEDIO |
| TC3 | Nessun e2e per mark-paid bulk | MEDIO |
| TC4 | Nessun test per email Resend failure path | MEDIO |
| P3 | `getNotificationSettings` chiamata ad ogni transizione senza cache | MEDIO |
| P4 | `getResponsabiliForCommunity` fa triple join non ottimizzato | MEDIO |
| B2 | Naming disuniforme tabella rimborsi e FK columns | MEDIO |
| B3 | `community_id` nullable su expense_reimbursements | MEDIO |
| A3 | `createServiceClient()` istanziato in ogni route (no singleton) | BASSO |
| A4 | Logica RBAC sparsa nei componenti React | BASSO |
| S1 | `CreateUserForm.tsx` troppo grande (409 righe) | BASSO |
| S2 | `CollaboratoreDetail.tsx` troppo grande (474 righe) | BASSO |
| S3 | `OnboardingWizard.tsx` stato locale complesso (408 righe) | BASSO |
| S6 | Query con `.like('tipo', 'CONTRATTO_%')` non usa `macro_type` | BASSO |
| T1 | `SupabaseClient<any, any, any>` in notification-helpers.ts | BASSO |
| T2 | Cast `action as CompensationAction` senza guardia | BASSO |
| T3 | `Record<string, unknown>` per updatePayload senza narrowing | BASSO |
| T4 | State machine action non è discriminated union | BASSO |
| T5 | Colonna `tipo` in documents non è PostgreSQL ENUM | BASSO |
| TC2 | Nessun test unit per null values in buildCSV | BASSO |
| P2 | Index su `collaborators.user_id` non documentato | BASSO |
| SEC6 | Nessuna rotation policy documentata per RESEND_API_KEY | BASSO |
| N1 | `compensi/nuova/page.tsx` è codice morto (redirect tutti i ruoli) — da rimuovere con `CompensationWizard` | BASSO |
| N2 | `contenuti/page.tsx` accessibile ai collaboratori ma non in nav — valutare redirect a /comunicazioni | BASSO |

---

## B — Naming DB / Semantica schema

### B1 — `collaborators.ha_figli_a_carico` semanticamente invertita
- **Problema**: `ha_figli_a_carico = true` significa che il collaboratore stesso è fiscalmente a carico di un familiare, non che ha figli a carico. Nome colonna invertito.
- **File**: `lib/types.ts`, `supabase/migrations/001_schema.sql:59`, `components/ProfileForm.tsx`
- **Impatto**: ALTO
- **Fix**: Rinominare `ha_figli_a_carico` → `e_fiscalmente_a_carico` + migration ALTER TABLE + aggiornare tutti i riferimenti TS + label UI già corretta ("Sono fiscalmente a carico").

### B2 — Naming disuniforme tabella rimborsi e FK columns
- **Problema**: Tabella `expense_reimbursements`, interfaccia TS `Expense`, FK nelle tabelle collegate si chiama `reimbursement_id`. Tre naming diversi per lo stesso concetto.
- **File**: `app/api/expenses/route.ts`, `lib/types.ts:375-412`, `supabase/migrations/001_schema.sql:147-180`
- **Impatto**: MEDIO
- **Fix**: Standardizzare tutto su `expense_reimbursements`; rinominare FK `reimbursement_id` → `expense_id` in `expense_attachments` e `expense_history`.

### B3 — `community_id` nullable su `expense_reimbursements`
- **Problema**: `expense_reimbursements.community_id` non è `NOT NULL`, ma è richiesto logicamente da ogni rimborso. Rimborsi orfani causano anomalie in query di aggregazione.
- **File**: `supabase/migrations/001_schema.sql:150`
- **Impatto**: MEDIO
- **Fix**: Verificare se esistono rimborsi senza community_id → se no, aggiungere `NOT NULL`.

### B4 — Typo `data_compenso` vs `data_competenza` nel transition route
- **Problema**: Nel codice del transition route si accede a `comp.data_compenso` ma la colonna reale è `data_competenza`. Causa runtime error su accesso a proprietà inesistente.
- **File**: `app/api/compensations/[id]/transition/route.ts:160,215`
- **Impatto**: ALTO
- **Fix**: Correggere il typo usando il nome colonna reale `data_competenza`.

---

## A — Architettura / Accoppiamento

### A1 — Duplicazione logica tra notification-utils.ts e notification-helpers.ts
- **Problema**: I due file sono sempre importati insieme. Non esiste layer di astrazione unificato. Ogni route di transizione ha 6+ import da questi due file.
- **File**: `lib/notification-utils.ts`, `lib/notification-helpers.ts`, `app/api/compensations/[id]/transition/route.ts:9-19`
- **Impatto**: MEDIO
- **Fix**: Creare `lib/notification-service.ts` che re-esporta builder + helpers da un unico entry point.

### A2 — Email fire-and-forget senza log di failure
- **Problema**: `sendEmail(...).catch(() => {})` silenzia ogni errore Resend. Se il provider è down, nessun utente riceve notifiche e nessun admin viene avvisato.
- **File**: `lib/email.ts:5-20` (usato in 8+ route)
- **Impatto**: MEDIO
- **Fix**: Aggiungere log asincrono su errore (console.error o tabella `email_errors`) per visibilità operativa.

### A3 — `createServiceClient()` istanziato in ogni route (no singleton)
- **Problema**: Ogni API route crea una nuova istanza del service client con le stesse credenziali. Violazione DRY.
- **File**: tutti i route handler in `app/api/`
- **Impatto**: BASSO
- **Fix**: Creare `lib/supabase/service-client.ts` con singleton esportato e riusarlo.

### A4 — Logica RBAC sparsa nei componenti React
- **Problema**: `CreateUserForm` e `NotificationSettingsManager` embeddano check di ruolo inline. Cambiare un permesso richiede cercare nei componenti.
- **File**: `components/impostazioni/CreateUserForm.tsx:97-98`, `components/impostazioni/NotificationSettingsManager.tsx`
- **Impatto**: BASSO
- **Fix**: Creare `lib/auth-guards.ts` con funzioni pure (`canCreateFullUser(role)`, ecc.) e importarle nei componenti.

---

## S — Struttura / Code quality

### S1 — `CreateUserForm.tsx` troppo grande (409 righe)
- **Problema**: Un singolo componente gestisce mode toggle, validazione form, risultato invito e display credenziali.
- **File**: `components/impostazioni/CreateUserForm.tsx`
- **Impatto**: BASSO
- **Fix**: Estrarre `InviteResultCard` (display email/password) e tenere solo la form logic nel componente principale.

### S2 — `CollaboratoreDetail.tsx` troppo grande (474 righe)
- **Problema**: Anagrafica + compensi + rimborsi + documenti tutto inline in un unico componente client.
- **File**: `components/responsabile/CollaboratoreDetail.tsx`
- **Impatto**: BASSO
- **Fix**: Spezzare in `CollaboratoreHeader`, `CollaboratoreCompensazioni`, `CollaboratoreDocumenti`.

### S3 — `OnboardingWizard.tsx` stato locale complesso (408 righe)
- **Problema**: Step 1 e 2 rigidamente accoppiati nello stato. Logica generazione contratto inline.
- **File**: `components/onboarding/OnboardingWizard.tsx`
- **Impatto**: BASSO
- **Fix**: Estrarre step logic in sub-component; spostare generazione contratto in hook dedicato.

### S4 — Validazione input nelle route API non standardizzata
- **Problema**: `admin/create-user` usa Zod, ma `tickets/route.ts` e `documents/route.ts` validano manualmente con if-chain. Incoerenza strutturale.
- **File**: `app/api/tickets/route.ts:82-91`, `app/api/documents/route.ts:68-72`
- **Impatto**: MEDIO
- **Fix**: Standardizzare tutte le route su Zod; creare schema condivisi per payload ricorrenti (es. `PaginationSchema`, `AttachmentSchema`).

### S5 — Operazione mark-paid non atomica
- **Problema**: `POST /api/export/mark-paid` aggiorna compensazioni + inserisce history in step separati. Se il secondo step fallisce il record rimane in stato inconsistente.
- **File**: `app/api/export/mark-paid/route.ts:47-84`
- **Impatto**: ALTO
- **Fix**: Wrappare in PostgreSQL stored procedure (RPC) per atomicità, oppure implementare rollback esplicito su errore.

### S6 — Query documenti usa `.like('tipo', 'CONTRATTO_%')` invece di `macro_type`
- **Problema**: La colonna generata `macro_type` esiste esattamente per questo scopo ma non è usata in modo sistematico.
- **File**: `app/api/documents/route.ts:109`
- **Impatto**: BASSO
- **Fix**: Sostituire tutti i filtri `.like('tipo', '...')` con `.eq('macro_type', '...')`.

### S7 — Nessun check `file.size` prima del Buffer upload
- **Problema**: Le route di upload non validano la dimensione del file prima della conversione in Buffer. Il bucket ha policy da 10MB ma il check avviene a posteriori (dopo che il server ha già letto il body).
- **File**: `app/api/documents/route.ts:128-137`, `app/api/tickets/[id]/messages/route.ts:77-95`
- **Impatto**: MEDIO
- **Fix**: Aggiungere `if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File troppo grande' }, { status: 413 })` prima dell'upload.

---

## T — Type safety

### T1 — `SupabaseClient<any, any, any>` in notification-helpers.ts
- **Problema**: Il tipo del service client è `any`, perdendo tutti i type hint e l'autocomplete IDE.
- **File**: `lib/notification-helpers.ts:7`
- **Impatto**: BASSO
- **Fix**: Usare il tipo corretto `SupabaseClient<Database>` importando il type generato da supabase-codegen.

### T2 — Cast `action as CompensationAction` senza type guard
- **Problema**: `action` è castato con `as` dopo validazione Zod. Il cast è ridondante e nasconde il fatto che Zod già garantisce il tipo.
- **File**: `app/api/compensations/[id]/transition/route.ts:87`, `app/api/expenses/[id]/transition/route.ts:82`
- **Impatto**: BASSO
- **Fix**: Rimuovere il cast `as`; lasciare che TypeScript inferisca il tipo dall'output Zod.

### T3 — `Record<string, unknown>` per updatePayload senza narrowing
- **Problema**: `updatePayload` costruito come `Record<string, unknown>` non ha garanzie sulla shape prima dell'insert in DB.
- **File**: `app/api/compensations/[id]/transition/route.ts:95`, `app/api/expenses/[id]/transition/route.ts:89`
- **Impatto**: BASSO
- **Fix**: Tipare come `Partial<Compensation>` o `Partial<Expense>`.

### T4 — State machine action non usa discriminated union
- **Problema**: Le azioni della state machine non sono discriminated union. Lo switch/if-chain non ha exhaustive check da TypeScript, rendendo facile dimenticare un caso aggiungendo nuove azioni.
- **File**: `app/api/compensations/[id]/transition/route.ts:97-113`
- **Impatto**: BASSO
- **Fix**: Definire `type TransitionPayload = { action: 'approve_manager' } | { action: 'request_integration'; note: string } | ...` e usarlo come discriminated union.

### T5 — Colonna `tipo` in `documents` è `text + CHECK` invece di PostgreSQL ENUM
- **Problema**: Nessuna garanzia compile-time che un valore non valido venga inserito direttamente via SQL.
- **File**: `supabase/migrations/001_schema.sql:205`
- **Impatto**: BASSO
- **Fix**: Creare `CREATE TYPE document_tipo AS ENUM (...)` e migrare la colonna.

---

## SEC — Sicurezza / Auth

### SEC1 — Password temporanea restituita in chiaro dalla create-user API
- **Problema**: `POST /api/admin/create-user` risponde con `{ email, password }` in plain text nel body JSON. Visibile nel browser network tab e nei log server.
- **File**: `app/api/admin/create-user/route.ts:159-162`
- **Impatto**: ALTO
- **Fix**: Valutare magic link Supabase invece di password temporanea. Se si mantiene la password, comunicarla solo via email (mai nel response body).

### SEC2 — Email invito non contiene link diretto con token
- **Problema**: Il template email invito non include un link all'app con token pre-autenticato. L'utente deve ricordare email/password da console admin.
- **File**: `lib/email-templates.ts` (template E8)
- **Impatto**: MEDIO
- **Fix**: Usare `supabase.auth.admin.generateLink({ type: 'magiclink', email })` per aggiungere link one-time nell'email invito.

### SEC3 — Nessun rate limiting su POST compensi/rimborsi
- **Problema**: Un collaboratore autenticato può inviare richieste illimitate, potenziale spam o DoS applicativo.
- **File**: `app/api/compensations/route.ts`, `app/api/expenses/route.ts`
- **Impatto**: MEDIO
- **Fix**: Aggiungere check applicativo: massimo N compensi in stato BOZZA/INVIATO per collaboratore (es. 20). Alternativamente rate limit su middleware.

### SEC4 — Nessun rate limiting su create-user
- **Problema**: Un admin compromesso può creare utenti illimitati.
- **File**: `app/api/admin/create-user/route.ts`
- **Impatto**: MEDIO
- **Fix**: Rate limit per admin user (es. 10 utenti/ora) tramite middleware o check DB.

### SEC5 — RLS su `compensation_history` non verificata da test
- **Problema**: Non esiste test che verifica che un collaboratore non possa leggere la history di compensi altrui.
- **File**: `supabase/migrations/002_rls.sql`
- **Impatto**: MEDIO
- **Fix**: Aggiungere test RLS: collaboratore B chiama GET `/api/compensations/[id_di_A]/` → deve ricevere 403/404.

### SEC6 — Nessuna rotation policy documentata per `RESEND_API_KEY`
- **Problema**: `RESEND_API_KEY` in `.env.local` senza procedura di rotation documentata.
- **File**: `lib/email.ts:3`, `.env.local.example`
- **Impatto**: BASSO
- **Fix**: Documentare in README: "Ruotare RESEND_API_KEY ogni 90 giorni" + aggiungere nota in `.env.local.example`.

### SEC7 — Supabase Personal Access Token in plain text in MEMORY.md
- **Problema**: `SUPABASE_ACCESS_TOKEN` (PAT con accesso Management API) è archiviato in chiaro nel file di memoria persistente.
- **File**: `~/.claude/projects/.../memory/MEMORY.md`
- **Impatto**: CRITICO
- **Fix**: Revocare immediatamente il token in Supabase org settings → generare nuovo → aggiornare MEMORY.md con solo un placeholder (es. `sbp_...`).

---

## P — Performance

### P1 — Join PostgREST in GET compensations non arricchisce dati collaboratore
- **Problema**: La route admin non include nome/cognome del collaboratore nella select, obbligando il frontend a fare join in-memory o una seconda fetch.
- **File**: `app/api/compensations/route.ts:44-47`
- **Impatto**: BASSO
- **Fix**: Aggiungere `collaborators(nome, cognome)` nella select quando il chiamante è admin/responsabile.

### P2 — Index su `collaborators.user_id` non documentato
- **Problema**: `UNIQUE` su `collaborators.user_id` crea automaticamente un index in Postgres, ma non è esplicito nella migration. Confonde chi legge lo schema.
- **File**: `supabase/migrations/001_schema.sql:45`
- **Impatto**: BASSO
- **Fix**: Aggiungere commento `-- UNIQUE crea index automatico su user_id` oppure creare l'indice esplicitamente.

### P3 — `getNotificationSettings` eseguita ad ogni transizione senza cache
- **Problema**: 15 righe lette dal DB ad ogni transizione compenso/rimborso. Con 100 transizioni/giorno = 1500 query identiche.
- **File**: `lib/notification-helpers.ts` (getNotificationSettings), usato in transition routes
- **Impatto**: MEDIO
- **Fix**: Aggiungere cache in-memory con TTL 5 minuti (es. `Map` + timestamp) oppure pre-caricare in startup.

### P4 — `getResponsabiliForCommunity` fa triple join non ottimizzato
- **Problema**: La funzione esegue: select user_community_access → filter user_profiles → fetch collaborators → chiamata `auth.admin.listUsers()` globale. Inefficiente su organizzazioni grandi.
- **File**: `lib/notification-helpers.ts:62-101`
- **Impatto**: MEDIO
- **Fix**: Convertire in PostgreSQL RPC che ritorna già `PersonInfo[]` in una singola query con JOIN.

---

## TC — Test coverage

### TC1 — Nessun test unit per `reject_manager` in compensation-transitions
- **Problema**: L'azione `reject_manager` esiste nella state machine ma non è coperta dai 20 test vitest esistenti.
- **File**: `__tests__/compensation-transitions.test.ts`
- **Impatto**: MEDIO
- **Fix**: Aggiungere test: `INVIATO → reject_manager → RIFIUTATO` e `INTEGRAZIONI_RICHIESTE → reject_manager → RIFIUTATO`.

### TC2 — Nessun test unit per null values in `buildCSV`
- **Problema**: `buildCSV` usa `?? ''` per campi null ma nessun test verifica l'output per un item con `importo=null`.
- **File**: `__tests__/export-utils.test.ts`
- **Impatto**: BASSO
- **Fix**: Aggiungere test `buildCSV([{ ...item, importo: null }])` → verifica colonna vuota.

### TC3 — Nessun e2e per mark-paid bulk
- **Problema**: `POST /api/export/mark-paid` con array di ID multipli non è coperto da nessun test Playwright.
- **File**: `e2e/export.spec.ts`
- **Impatto**: MEDIO
- **Fix**: Aggiungere scenario `S9: seleziona 3 compensi → bulk mark-paid → verifica DB status=PAGATO`.

### TC4 — Nessun test per failure path email Resend
- **Problema**: `sendEmail().catch(() => {})` non è mai testato. Il path di errore non viene mai esercitato.
- **File**: `lib/email.ts`, `__tests__/`
- **Impatto**: MEDIO
- **Fix**: Aggiungere test vitest con mock Resend che lancia eccezione → verifica che il catch non propaghi.

### TC5 — Nessun test RLS su leakage `compensation_history`
- **Problema**: Non esiste test (unit o e2e) che verifica che un collaboratore non possa leggere la history di compensi altrui.
- **File**: `__tests__/`, `supabase/migrations/002_rls.sql`
- **Impatto**: ALTO
- **Fix**: Aggiungere test: collaboratore B chiama `GET /api/compensations/[id_compenso_di_A]` → risposta 403 o 404.
