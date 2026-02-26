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
| C1 | Implementazione Blocco 1 (roles rename + new roles + credentials) | ✅ fatto — codice + migration pronti |
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

*(Sezione vuota — da popolare al termine di ogni blocco se emergono lezioni nuove non già in CLAUDE.md)*
