# Staff Manager — Implementation Checklist

> Aggiornare questo file al termine di ogni blocco funzionale (Fase 8 della pipeline).
> È la fonte di verità sullo stato dei lavori. Leggere prima di iniziare un nuovo blocco.
> **In revisione** — da ricompilare al termine della revisione di `docs/requirements.md` (Step D del piano attivo in `MEMORY.md`).

---

## Log

| Data | Blocco | Stato | Test | Note |
|---|---|---|---|---|
| 2026-02-26 | Blocco 1 — Revisione ruoli e utenze di test | ✅ | tsc ✅, build ✅, vitest 106/106 ✅, e2e ⏸ (sospeso temporaneamente) | `017_roles_rename.sql` applicata. Bug fix `importo`/`data_compenso` in transition route. |
| 2026-02-26 | Blocco 2 — Ristrutturazione menu collaboratore | ✅ | tsc ✅, build ✅, vitest 106/106 ✅, e2e ⏸ (sospeso), smoke test OK | 8 voci nav, unified Compensi e Rimborsi, TicketQuickModal, Profilo e Documenti tabs, 3 nuove pagine (eventi/comunicazioni/opportunita). |
| 2026-02-27 | Blocco 3 — Correzioni sezione profilo + consolidamento OCCASIONALE | ✅ | tsc ✅, build ✅, vitest 106/106 ✅, e2e ⏸ (sospeso) | Rename `ha_figli_a_carico` → `sono_un_figlio_a_carico`, add `importo_lordo_massimale` + progress bar + guide modale, rimozione P.IVA e COCOCO, consolidamento OCCASIONALE. Migrations 018-020. |

---

## Blocco 1 — Revisione ruoli e utenze di test ✅

> Requisito: `docs/requirements.md` §2 — Ruoli e permessi, Utenze di test
> Dipendenze: nessuna

| Sotto-blocco | Stato | Note |
|---|---|---|
| 1a — Type system + migration DB | ✅ | `lib/types.ts` + `017_roles_rename.sql` |
| 1b — Mass replace `responsabile` nel codice | ✅ | ~40 file aggiornati |
| 1c — Login page + E2E credentials | ✅ | `login/page.tsx` + 20 spec files aggiornati |

### Sotto-blocco 1a — Type system e migration

**`lib/types.ts`**
- Rimuovere `'responsabile'` dal tipo `Role`
- Aggiungere `'responsabile_cittadino'` | `'responsabile_compensi'` | `'responsabile_servizi_individuali'`
- Aggiornare `ROLE_LABELS`

**`supabase/migrations/017_roles_rename.sql`**
- Aggiorna `CHECK constraint` su `user_profiles.role` con i nuovi valori
- `UPDATE user_profiles SET role = 'responsabile_compensi' WHERE role = 'responsabile'`
- Aggiorna tutte le RLS policy che referenziano `'responsabile'`
- Rename email utenze esistenti:
  - `responsabile@test.com` → `responsabile_compensi@test.com`
  - `responsabile_test@test.com` → `responsabile_compensi_test@test.com`
  - `admin-test@example.com` → `admin@test.com`
- Crea 4 nuovi utenti Supabase Auth (password `Testbusters123`):
  - `responsabile_cittadino@test.com` (ruolo: `responsabile_cittadino`)
  - `responsabile_servizi_individuali@test.com` (ruolo: `responsabile_servizi_individuali`)
  - `responsabile_cittadino_test@test.com` (ruolo: `responsabile_cittadino`)
  - `responsabile_servizi_individuali_test@test.com` (ruolo: `responsabile_servizi_individuali`)

### Sotto-blocco 1b — Mass replace nel codice

File core:
- `lib/nav.ts` — chiave `responsabile` → `responsabile_compensi`
- `lib/compensation-transitions.ts` — `allowedRoles`
- `lib/expense-transitions.ts` — `allowedRoles`

API routes (~40 file) — tutti i RBAC check su `'responsabile'`:
- `app/api/compensations/`, `app/api/expenses/`, `app/api/documents/`
- `app/api/tickets/`, `app/api/announcements/`, `app/api/admin/`

Componenti UI:
- `components/impostazioni/CreateUserForm.tsx` — dropdown ruoli
- `components/impostazioni/CommunityManager.tsx` — assegnazione responsabile → community
- `components/responsabile/CollaboratoreDetail.tsx`, `TicketList.tsx`, `TicketMessageForm.tsx` — label display

Unit test da aggiornare:
- `__tests__/compensation-transitions.test.ts`
- `__tests__/expense-transitions.test.ts`

### Sotto-blocco 1c — Login page e E2E

**`app/login/page.tsx`** — aggiorna `TEST_USERS` array con le 9 utenze definite in §2

**`e2e/*.spec.ts`** (19 file) — sostituzioni:
- `responsabile@test.com` → `responsabile_compensi@test.com`
- `admin-test@example.com` → `admin@test.com`

### Punti aperti
- `responsabile_cittadino`: permessi, navigazione e visibilità → da definire in blocco dedicato
- `responsabile_servizi_individuali`: idem

---

## Blocco 2 — Ristrutturazione menu collaboratore ✅

> Requisito: `docs/requirements.md` §3 — Navigazione collaboratore
> Dipendenze: Blocco 1

| Sotto-blocco | Stato | Note |
|---|---|---|
| 2a — Nav 8 voci + comingSoon flag | ✅ | `lib/nav.ts` + `components/Sidebar.tsx` |
| 2b — Profilo e Documenti (tab merge) | ✅ | `profilo/page.tsx` + redirect `documenti/page.tsx` |
| 2c — Compensi e Rimborsi unificati | ✅ | `compensi/page.tsx` rewrite + `TicketQuickModal` |
| 2d — Rimozione CTA creazione compenso | ✅ | `CompensationList.tsx`, `page.tsx` dashboard, `compensi/nuova/page.tsx` |
| 2e — Nuove pagine: eventi, comunicazioni, opportunita | ✅ | 3 nuove route, read-only |

---

## Blocco 3 — Correzioni sezione profilo + consolidamento OCCASIONALE ✅

> Requisito: `docs/requirements.md` §3 Modello dati, §12 Profilo
> Dipendenze: Blocco 1, Blocco 2

| Sotto-blocco | Stato | Note |
|---|---|---|
| 3a — Rename `ha_figli_a_carico` → `sono_un_figlio_a_carico` | ✅ | Migration 018, 46 occorrenze in 16 file |
| 3b — Campo `importo_lordo_massimale` + progress bar | ✅ | Migration 019, ProfileForm + PaymentOverview |
| 3c — Consolidamento OCCASIONALE (rimozione COCOCO/PIVA) | ✅ | Migration 020, rimozione P.IVA, aggiornamento e2e |

---

## Legenda

| Simbolo | Significato |
|---|---|
| ✅ | Completato: build ✅, unit test ✅, Playwright ⏸ sospeso (istruzione temporanea), checklist firmata, CLAUDE.md aggiornato |
| 🔄 | In corso (blocco attivo) |
| 🔲 | Non iniziato |
| ⏸ | Sospeso / bloccato da dipendenza |
