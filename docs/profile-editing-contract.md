# Profile Editing Contract

> **Mandatory reference for any block touching collaborator profile data.**
> Every block that modifies the collaborator profile schema, field permissions, or edit flows
> must verify alignment across all three entry points and update this document accordingly.

---

## Entry Points

| Entry point | Route / Component | Auth | Notes |
|---|---|---|---|
| **Onboarding** | `POST /api/onboarding/complete` | Collaboratore (self) | First-time only; `onboarding_completed` must be false |
| **Self-edit** | `PATCH /api/profile` | Collaboratore (self) | Ongoing edits after onboarding |
| **Admin edit** | `PATCH /api/admin/collaboratori/[id]/profile` | `amministrazione` | All fields including IBAN |
| **Responsabile edit** | `PATCH /api/admin/collaboratori/[id]/profile` | `responsabile_compensi` (own communities only) | All fields except IBAN |
| **Username only** | `PATCH /api/admin/collaboratori/[id]` | `amministrazione`, `responsabile_compensi` (own communities) | Atomic username update |

---

## Field Permission Matrix

| Campo | Onboarding | Self-edit | Admin | Responsabile |
|---|---|---|---|---|
| `nome` | ✅ required | ✅ | ✅ | ✅ |
| `cognome` | ✅ required | ✅ | ✅ | ✅ |
| `username` | — (readonly preview) | ❌ not editable | ✅ (409 on conflict) | ✅ (409 on conflict) |
| `codice_fiscale` | ✅ required | ✅ | ✅ | ✅ |
| `data_nascita` | ✅ required | ✅ | ✅ | ✅ |
| `luogo_nascita` | ✅ required | ✅ | ✅ | ✅ |
| `provincia_nascita` | ✅ required | ✅ | ✅ | ✅ |
| `comune` | ✅ required | ✅ | ✅ | ✅ |
| `provincia_residenza` | ✅ required | ✅ | ✅ | ✅ |
| `indirizzo` | ✅ required | ✅ | ✅ | ✅ |
| `civico_residenza` | ✅ required | ✅ | ✅ | ✅ |
| `telefono` | ✅ required | ✅ | ✅ | ✅ |
| `iban` | ✅ required | ✅ | ✅ | ❌ sensitive |
| `tshirt_size` | ✅ required | ✅ | ✅ | ✅ |
| `sono_un_figlio_a_carico` | ✅ | ✅ | ✅ | ✅ |
| `importo_lordo_massimale` | — | ✅ | ✅ | ✅ |
| `email` | — | ✅ (via auth API) | — | ❌ |
| `foto_profilo_url` | — | ✅ (avatar upload) | — | ❌ |
| `data_ingresso` | — | ❌ | ✅ (admin only) | ❌ |
| `tipo_contratto` | — | ❌ | ✅ (admin only) | ❌ |

---

## Validation Rules (must be consistent across all entry points)

| Campo | Rule | Zod pattern |
|---|---|---|
| `codice_fiscale` | 16 alphanumeric uppercase | `/^[A-Z0-9]{16}$/` |
| `iban` | Uppercase, no spaces, country code prefix | `/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/` |
| `provincia_*` | 2 uppercase letters | `/^[A-Z]{2}$/` |
| `username` | Lowercase, alphanumeric + underscore, 3–50 chars | `/^[a-z0-9_]+$/` |

---

## Dependency Check Protocol

Before starting any block that touches profile data:

1. **Schema change** (new column): update this matrix + all 5 entry points
2. **Validation change**: update both Zod schemas (self-edit + onboarding) AND server validation in admin/responsabile route
3. **Permission change** (new role gets access): update this matrix + the relevant API route + CollaboratoreDetail UI
4. **Field rename**: search all 5 entry points via Grep before declaring file list

---

## Known Constraints

- `IBAN` is treated as sensitive: visible to collaboratore and admin only.
- `username` is the import key for compensation ingestion — uniqueness is enforced at DB level (UNIQUE constraint) and via 409 error at API level.
- Community check for `responsabile_compensi`: verified via `user_community_access` JOIN `collaborator_communities` on the collaborator's ID.
- `onboarding_completed=false` guard is on `POST /api/onboarding/complete` only — repeated calls are rejected.
