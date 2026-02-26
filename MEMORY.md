# MEMORY — Staff Manager

> Leggere in Fase 0 di ogni nuova sessione o ripresa da summary.
> Due sezioni: **Piano attivo** (stato corrente della sessione in corso) e **Lezioni/Pattern** (conoscenza accumulata).

---

## Piano attivo — Revisione requisiti strutturali (branch: feat/requirements-check)

### Contesto
Gli Stakeholders hanno chiarito e re-ingegnerizzato alcuni componenti di base del progetto.
È in corso una revisione strutturale dei requisiti che richiederà l'aggiornamento di blocchi funzionali già implementati.
Lavoriamo su due worktree paralleli: `feat/requirements-check` (questo) e `main` (altro tab).

### Obiettivo
Ripartire da un set di requisiti solido e aggiornato, mantenendo il più possibile del lavoro esistente e intervenendo su dipendenze, logiche e struttura.

### Steps — stato avanzamento

| Step | Descrizione | Stato |
|------|-------------|-------|
| A | Aggiornare `CLAUDE.md`: aggiungere sezione "Modifiche strutturali da requisiti" con il processo guidato | ✅ fatto |
| B | Reset `docs/implementation-checklist.md`: azzerare e predisporre struttura vuota | ✅ fatto |
| C | Revisione guidata `docs/requirements.md`: confronto sezione per sezione tra requisiti esistenti e nuovi (approvazione utente per ogni modifica) | 🔄 in corso — Blocco 1 completato, altri blocchi da definire |
| C1 | Implementazione Blocco 1 (roles rename + new roles + credentials) | ✅ chiuso — tsc ✅, build ✅, vitest 106/106 ✅, e2e ⏸, commit + push ✅ |
| D | Nuova `docs/implementation-checklist.md`: ricostruire la checklist basandosi sul `requirements.md` aggiornato | 🔄 parziale — Blocco 1 ✅, altri blocchi da pianificare |
| E | Completamento `CLAUDE.md`: aggiungere review di `refactoring-backlog.md` in Fase 1 + eventuali aggiustamenti pipeline emersi da C+D | ⬜ da fare |

> **Regola**: non passare allo step successivo senza conferma esplicita. Steps C e D dipendono dall'ordine — senza requirements.md aggiornato non si ricostruisce la checklist.

### Processo per modifiche strutturali da requisiti (da formalizzare in Step A)
1. Aggiornare `docs/requirements.md` con il nuovo requisito (approvazione utente)
2. Analizzare impatti sui blocchi già implementati
3. Aggiornare `docs/implementation-checklist.md` e `docs/refactoring-backlog.md`
4. **STOP** — presentare piano di intervento e attendere conferma esplicita
5. Eseguire seguendo la pipeline standard di `CLAUDE.md`

---

## Lezioni / Pattern

### Worktree setup (Blocco 1 — 2026-02-26)
- **Turbopack rifiuta symlink node_modules**: in un worktree, non usare `ln -s` per condividere `node_modules`. Eseguire `npm install` direttamente nel worktree.
- **Dev server su porta separata**: il worktree deve girare su porta diversa (`PORT=3001`). Aggiornare `playwright.config.ts` `baseURL` di conseguenza.
- **`.env.local` non condiviso**: ogni worktree ha la propria `.env.local`. Copiare da `main` al setup iniziale (`cp ../staff-manager/.env.local .env.local`).

### Migration pitfalls (Blocco 1 — 2026-02-26)
- **CHECK constraint prima del data migration**: `ALTER TABLE DROP CONSTRAINT` PRIMA di `UPDATE` sul campo vincolato. Fare l'UPDATE con il vecchio valore violato PRIMA di aggiornare il constraint causa errore.
- **auth.identities.email è colonna generata**: non aggiornare `email` direttamente su `auth.identities`. Aggiornare solo `identity_data = jsonb_set(identity_data, '{email}', '"nuovo@email"')` con `WHERE identity_data->>'email' = 'vecchio@email'`.
- **Migration non applicata = errore di processo**: scoprire in Fase 5 che la migration non è applicata è un errore. Ogni migration va applicata subito dopo la scrittura (Fase 2), con verifica SELECT.

### Supabase SELECT su colonne inesistenti (Blocco 1 — 2026-02-26)
- TypeScript non valida i nomi di colonna nel `.select()` di Supabase (non usa tipi DB generati). Selezionare una colonna inesistente (es. `importo` invece di `importo_lordo`) causa `fetchError` a runtime → 404 silenzioso. Verificare i nomi colonna effettivi con `information_schema.columns` quando si aggiunge un nuovo `.select()`.
