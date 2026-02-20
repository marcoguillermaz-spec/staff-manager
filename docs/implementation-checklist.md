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

## Phase 2 — In corso

| Blocco | Stato | Unit test | E2E | Note |
|---|---|---|---|---|
| Documenti + CU batch | ✅ | 11 vitest | 10 Playwright | §4.3 req. Bucket privato `documents`, upload via service role, signed URL 1h, CU batch ZIP+CSV |
| Ticket | 🔲 | — | — | Vedere §4.4 requirements.md |
| Notifiche in-app | ✅ | 12 vitest | 9 Playwright | §8 req. Bell + badge + dropdown, mark-read, trigger su compensi/rimborsi/documenti |
| Contenuti (Bacheca, Agevolazioni, Guide, Eventi) | 🔲 | — | — | Vedere §5 requirements.md |

---

## Phase 3 — Pianificata

| Blocco | Stato | Note |
|---|---|---|
| Template contratti | 🔲 | Allegati per ruolo, autonomia community |
| Onboarding automatizzato | 🔲 | Nuovi ingressi sporadici, flusso autonomo |
| Impostazioni avanzate | 🔲 | Gestione ruoli, community, configurazioni |
| Definizione corso unificata (Staff + Simu) | 🔲 fuori scope | Vedere §9 requirements.md — valutare in futuro |

---

---

## Punti aperti da approfondire

| # | Blocco | Punto | Stato |
|---|---|---|---|
| 1 | Documenti + CU batch | **Anno CU nel batch**: confermato — admin specifica l'anno manualmente. Allineare con contabilità a primo utilizzo reale. | ✅ chiuso |
| 2 | Documenti + CU batch | **Formato CSV CU batch**: assunzione `nome_file,nome,cognome`. Allineare con contabilità a primo utilizzo reale. | ⏳ da verificare |

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
