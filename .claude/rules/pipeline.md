# Workflow Requirements

CRITICAL: questi sono vincoli di processo non negoziabili. Valgono per OGNI sviluppo — blocchi funzionali, fix, refactoring, feature minori — anche quando il piano completo è fornito in un singolo prompt. Eseguire sempre una fase alla volta e fermarsi ai gate indicati. Non passare alla fase successiva senza conferma esplicita.

---

## Pipeline obbligatoria per ogni sviluppo

**Fase 0 — Orientamento sessione** *(solo all'inizio di ogni nuova sessione o ripresa da summary)*
- Verificare `MEMORY.md`: controllare la sezione **Piano attivo** (se presente) per riallinearsi a sessioni in corso, poi **Lezioni/Pattern** per pattern rilevanti al blocco corrente.
- Se il contesto è stato compresso (summary): leggere `docs/implementation-checklist.md` per riallinearsi allo stato.
- Non rileggere file già presenti nel contesto corrente — usare la line reference già acquisita.

**Fase 1 — Requisiti**
- Leggere `docs/implementation-checklist.md` per verificare lo stato corrente e le dipendenze del blocco.
- Leggere **solo la sezione pertinente** di `docs/requirements.md` — non l'intero file.
- Verificare `docs/refactoring-backlog.md`: se ci sono voci che intersecano il blocco corrente, includerle nel piano di lavoro o segnalarle esplicitamente.
- Riformulare i requisiti del blocco in modo sintetico.
- Per ricerche ampie nel codebase (>3 Glob/Grep indipendenti): delegare a un Task agent Explore.
- Se qualcosa è ambiguo: usare AskUserQuestion PRIMA di scrivere codice.
- Output atteso: riepilogo funzionalità, elenco file da creare/modificare, eventuali domande aperte.
- *** STOP — presentare riepilogo requisiti e lista file da toccare. Attendere conferma esplicita. ***

**Fase 1.5 — Design review** *(blocchi con pattern nuovi, modifiche DB, o >5 file)*
- Presentare schema del design: flusso dati, strutture dati coinvolte, trade-off principali.
- Indicare eventuali alternative scartate e motivazione.
- Per blocchi semplici (≤3 file, nessuna migration, nessun nuovo pattern): saltare indicandolo esplicitamente.
- *** STOP — attendere conferma del design prima di scrivere codice. ***

**Fase 2 — Implementazione**
- Scrivere il codice. Rispettare le Coding Conventions del progetto.
- Non aggiungere feature non richieste. Non refactoring non richiesto.
- **Dopo ogni nuova migration** (`supabase/migrations/NNN_*.sql`): applicare **immediatamente** al DB remoto via Management API (`curl` con `SUPABASE_ACCESS_TOKEN` da `.env.local`) + verificare con query SELECT + aggiungere riga in `docs/migrations-log.md`. **Non attendere i test per scoprire migrazioni mancanti** — scoprirle in fasi successive è un errore di processo.
- **Sintassi PostgREST join** (`table!relation`, `!inner`): verificare FK prima di usarla. Se FK assente → query a due step. Query di verifica: `SELECT conname FROM pg_constraint WHERE conrelid='tablename'::regclass AND contype='f';`
- **Security checklist** (prima del commit intermedio): per ogni route API nuova/modificata: (1) auth check prima di qualsiasi operazione, (2) input validato (Zod), (3) nessun dato sensibile nella response, (4) RLS non aggirata implicitamente.
- Output atteso: file creati/modificati elencati con path.

**Fase 3 — Build + unit test**
- Eseguire `npx tsc --noEmit` e `npm run build`. Devono terminare senza errori.
- Eseguire `npx vitest run`. Devono passare tutti.
- Output atteso: solo riga summary (es. `✓ 106/106`). NON l'output completo.
- Se qualcosa fallisce: incollare solo le righe di errore, correggere e rieseguire. Non proseguire con errori aperti.
- Dopo build + test verdi: **fare commit intermedio** (`git add … && git commit`).

**Fase 3b — API integration tests** *(solo se il blocco crea o modifica route API)*
- Scrivere test core in `__tests__/api/<nome-route>.test.ts` con vitest:
  - Happy path: status code atteso + campi chiave nel response body
  - Auth: senza token → 401
  - Authz: ruolo non autorizzato → 403
  - Validation: payload invalido → 400
  - Business rules: violazione vincolo applicativo → codice errore corretto
  - DB state: dopo scrittura, verificare il record con service role
- Eseguire `npx vitest run __tests__/api/` — tutti verdi.
- Output: solo riga summary. Non proseguire con errori aperti.

**Fase 4 — Definizione UAT**
- Identificare solo gli scenari **core**: happy path, edge case principale, verifica DB post-operazione.
- Elencare gli scenari Playwright (S1, S2, …) con: azione, input, verifica attesa.
- *** STOP — presentare lista scenari e attendere conferma esplicita prima di scrivere l'e2e spec. ***

**Fase 5 — Playwright e2e**
- Scrivere `e2e/<blocco>.spec.ts` in base agli scenari approvati.
- Eseguire `npx playwright test e2e/<blocco>.spec.ts`.
- **Prima di scrivere locatori CSS**: leggere il file del componente target (Read tool) e derivare le classi dal JSX reale — mai assumere dalla memoria.
- Output atteso: solo riga summary (es. `9 passed (45s)`).
- Se qualcosa fallisce: incollare solo lo scenario fallito con errore, correggere e rieseguire.
- Selettori: usare classi CSS esplicite (es. `span.text-green-300`), mai `getByText()` per stati.

**Fase 5.5 — Smoke test manuale** *(prima della checklist formale)*
- Eseguire 3-5 passi rapidi nel browser con l'utenza appropriata per verificare il flusso principale.
- Output: "smoke test OK" oppure elencare il problema e correggerlo prima di procedere.

**Fase 6 — Checklist esiti**
Presentare questa checklist compilata:

```
## Checklist blocco — [Nome Blocco]

### Build & Test
- [ ] tsc --noEmit: 0 errori
- [ ] npm run build: successo
- [ ] Vitest unit: N/N passati
- [ ] Vitest API: N/N passati *(se Fase 3b eseguita)*
- [ ] Playwright e2e: N/N passati *(⏸ sospeso se CLAUDE.local.md attivo)*

### Funzionalità implementate
- [ ] [feature 1]: [esito]

### Verifica con utenza reale
1. [passo]

### Query SQL di verifica
SELECT …;

### File creati / modificati
- path/to/file.ts — descrizione
```

**Fase 7 — Conferma umana**
- *** STOP — non dichiarare il blocco completo, non aggiornare documenti, non passare al blocco successivo finché l'utente non risponde con conferma esplicita. ***

**Fase 8 — Chiusura blocco**
Solo dopo conferma esplicita:
1. Aggiornare `docs/implementation-checklist.md`: segnare il blocco ✅, aggiungere riga nel Log.
2. Aggiornare `CLAUDE.md` **solo se** il blocco introduce pattern non ovvi, modifica la RBAC, o aggiunge una convenzione non esistente. Non aggiornare per semplici aggiunte di file — Claude le inferisce dal codice.
3. Aggiornare `README.md` (Project Structure + conteggio test).
4. Aggiornare `MEMORY.md` **solo se** sono emerse lezioni nuove non già documentate.
   - Se MEMORY.md supera ~150 righe attive: estrarre il topic in un file separato e sostituire con link.
5. Se sono emerse criticità strutturali: aprire `docs/refactoring-backlog.md`, verificare duplicati, aggiungere voci.
6. Commit: `docs/implementation-checklist.md` + `README.md` + `docs/refactoring-backlog.md` se modificato + `docs/migrations-log.md` se modificato. `CLAUDE.md` e `MEMORY.md` in commit separato se aggiornati.
7. Eseguire `git push` immediatamente dopo il commit.
8. Eseguire `/compact` per liberare il contesto della sessione corrente.

---

## Pipeline per modifiche strutturali da requisiti

Attivare quando gli Stakeholders introducono variazioni al perimetro funzionale che impattano blocchi già implementati. Questa pipeline **precede** la pipeline standard ed è il suo prerequisito.

**Fase R1 — Aggiornamento requisiti**
- Confrontare la modifica con la sezione pertinente di `docs/requirements.md` attuale.
- Proporre il testo aggiornato sezione per sezione.
- *** STOP — attendere approvazione esplicita per ogni sezione prima di scrivere. ***

**Fase R2 — Analisi impatti**
- Identificare tutti i blocchi già implementati impattati dalla modifica.
- Per ogni blocco: elencare file coinvolti, logiche da aggiornare, test da rivedere.
- Verificare `docs/refactoring-backlog.md`: voci esistenti da deprecare, integrare o aggiornare?
- Output atteso: matrice impatti (blocco → file → tipo modifica) + delta refactoring-backlog.

**Fase R3 — Piano di intervento**
- Aggiornare `docs/implementation-checklist.md` con il nuovo piano.
- Aggiornare `docs/refactoring-backlog.md` (depreca voci obsolete, aggiungi criticità emerse).
- *** STOP — presentare piano completo e attendere conferma esplicita prima di toccare qualsiasi file di codice. ***

**Fase R4 — Esecuzione**
- Leggere `docs/implementation-checklist.md` — il piano per ogni blocco è già definito e approvato.
- Procedere blocco per blocco seguendo la pipeline standard (Fasi 0–8).
- Aggiornare `MEMORY.md` sezione Piano attivo ad ogni step completato.

---

## Regole trasversali

- **Permessi tool**: l'utente ha autorizzato l'esecuzione autonoma di tutti i comandi (Bash, curl, npx, tsc, vitest, playwright, git) **tranne** i gate STOP espliciti. Procedere senza chiedere conferma per qualsiasi comando tecnico.
- **Gate bloccanti**: le istruzioni "STOP" sono hard stop. Non interpretarli come suggerimenti.
- **Anche se il piano è già scritto**: eseguire comunque fase per fase con i gate. Il piano pre-scritto sostituisce solo la Fase 1, non comprime le fasi successive.
- **Non rileggere file già in contesto**: riferirsi alla line reference già acquisita.
- **Explore agent per ricerche ampie**: se una ricerca richiede >3 query Glob/Grep indipendenti, delegare a `Task subagent_type=Explore`.
- **Output sintetici**: solo riga summary di build/test. Dettaglio solo in caso di errore.
- **MEMORY.md compatto**: mantenere sotto ~150 righe attive. Oltre: estrarre topic in file separati e linkare.
- **Migration immediata**: ogni migration va applicata al DB remoto + verificata con SELECT + loggata in `docs/migrations-log.md` subito dopo la scrittura.
- **FK check prima di join PostgREST**: `SELECT conname FROM pg_constraint WHERE conrelid='tablename'::regclass AND contype='f'`. Se FK assente: query a due step.
- **Locatori da JSX reale**: prima di ogni locatore e2e, leggere il componente (Read tool). Classi univoche — non assumere dalla memoria.
- **Playwright UAT**: selettori CSS classe (es. `span.text-green-300`) per badge di stato. Mai `getByText()` per valori di stato.
